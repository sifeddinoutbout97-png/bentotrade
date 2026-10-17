/**
 * BentoTrade - MetaApi Provisioning & Regional Client Helper
 */

export const provisioningBaseUrl = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
export const STANDARD_REGIONS = ['new-york', 'london', 'vint-hill', 'singapore', 'tokyo'];

export function normalizeServerName(server: string): string {
  if (!server) return 'FundedNext-Server 3';
  const trimmed = server.trim();
  const match = trimmed.match(/^FundedNext-Server\s*(\d+)$/i);
  if (match) {
    return `FundedNext-Server ${match[1]}`;
  }
  return trimmed;
}

export async function safeFetch(url: string, options: any, stepName: string) {
  try {
    const res = await fetch(url, options);
    return res;
  } catch (err: any) {
    const causeMsg = err.cause?.message || err.cause?.code || JSON.stringify(err.cause) || err.message;
    throw new Error(`[${stepName}] fetch failed for URL "${url}": ${err.message} | cause: ${causeMsg}`);
  }
}

export async function getOrCreateAndDeployAccount(login: string, server: string, platform: string, password: string | undefined, token: string) {
  const headers = {
    'auth-token': token,
    'Content-Type': 'application/json',
  };

  const loginStr = String(login);
  const normalizedServer = normalizeServerName(server);

  // 1. Fetch accounts list from provisioning API
  const accountsRes = await safeFetch(`${provisioningBaseUrl}/users/current/accounts`, { headers }, 'MetaApi-FetchAccounts');
  if (!accountsRes.ok) {
    const errText = await accountsRes.text();
    throw new Error(`Failed to fetch MetaApi accounts (${accountsRes.status}): ${errText}`);
  }

  const accountsData = await accountsRes.json();
  const accountList = Array.isArray(accountsData) ? accountsData : (accountsData.items || []);

  // Find matching account by login
  const matchingAccounts = accountList.filter((a: any) => String(a.login) === loginStr);
  let account = matchingAccounts.find(
    (a: any) => a.server && a.server.toLowerCase() === normalizedServer.toLowerCase() && a.state === 'DEPLOYED' && a.connectionStatus === 'CONNECTED'
  ) || matchingAccounts.find(
    (a: any) => a.server && a.server.toLowerCase() === normalizedServer.toLowerCase()
  ) || matchingAccounts.find(
    (a: any) => a.state === 'DEPLOYED' && a.connectionStatus === 'CONNECTED'
  ) || matchingAccounts[0];

  let metaApiAccountId = account?._id || account?.id;

  if (!account || !metaApiAccountId) {
    if (!password || !password.trim()) {
      throw new Error(`MetaApi account for login ${loginStr} on ${normalizedServer} not found. Please click "Disconnect Uplink" and enter your MT5 Investor/Master password so MetaApi can authenticate.`);
    }

    console.log(`[MetaApi] Account ${loginStr} on ${normalizedServer} not found. Creating cloud account...`);
    let createPayload: any = {
      name: `BentoTrade-${loginStr}`,
      type: 'cloud',
      login: loginStr,
      password: password,
      server: normalizedServer,
      platform: platform === 'mt4' ? 'mt4' : 'mt5',
      magic: 1000,
    };

    let createHeaders = {
      ...headers,
      'transaction-id': crypto.randomUUID().replace(/-/g, ''),
    };

    let createRes = await safeFetch(`${provisioningBaseUrl}/users/current/accounts`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify(createPayload),
    }, 'MetaApi-CreateAccount');

    if (!createRes.ok) {
      const errText = await createRes.text();
      let errData: any = {};
      try { errData = JSON.parse(errText); } catch {}

      if (createRes.status === 400 && errData?.code === 'E_SRV_NOT_FOUND' && errData?.details?.serversByBrokers) {
        const suggestedServers = errData.details.serversByBrokers;
        const bestMatch = suggestedServers.find((s: string) => s.toLowerCase().includes(normalizedServer.toLowerCase().replace(/\s+/g, ''))) || suggestedServers[0];
        if (bestMatch) {
          console.log(`[MetaApi] Retrying account creation with suggested server: "${bestMatch}"`);
          createPayload.server = bestMatch;
          createHeaders['transaction-id'] = crypto.randomUUID().replace(/-/g, '');
          createRes = await safeFetch(`${provisioningBaseUrl}/users/current/accounts`, {
            method: 'POST',
            headers: createHeaders,
            body: JSON.stringify(createPayload),
          }, 'MetaApi-CreateAccountRetry');
        }
      }

      if (!createRes.ok) {
        const finalErrText = await createRes.text();
        throw new Error(`Failed to create MetaApi account for login ${loginStr} on server ${normalizedServer} (${createRes.status}): ${finalErrText}`);
      }
    }

    const createdData = await createRes.json();
    metaApiAccountId = createdData._id || createdData.id;
  } else if (password && password.trim().length > 0) {
    console.log(`[MetaApi] Updating account ${metaApiAccountId} password/server on MetaApi...`);
    await safeFetch(`${provisioningBaseUrl}/users/current/accounts/${metaApiAccountId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        password: password,
        server: normalizedServer,
      }),
    }, 'MetaApi-UpdateAccount').catch(() => {});
  }

  // 3. Always fetch full account metadata & region from Provisioning API
  let fullAccount: any = null;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const detailRes = await safeFetch(`${provisioningBaseUrl}/users/current/accounts/${metaApiAccountId}`, { headers }, `MetaApi-GetAccountDetail-${attempt}`);
    if (detailRes.ok) {
      fullAccount = await detailRes.json();
      if (fullAccount.state === 'DEPLOYED' && fullAccount.connectionStatus === 'CONNECTED') {
        break;
      }
      if (fullAccount.state !== 'DEPLOYED') {
        await safeFetch(`${provisioningBaseUrl}/users/current/accounts/${metaApiAccountId}/deploy`, { method: 'POST', headers }, 'MetaApi-Deploy').catch(() => {});
      }
    }
    if (attempt < 6) {
      await new Promise(r => setTimeout(r, 2500));
    }
  }

  if (!fullAccount) {
    const detailRes = await safeFetch(`${provisioningBaseUrl}/users/current/accounts/${metaApiAccountId}`, { headers }, 'MetaApi-GetAccountDetail-Final');
    if (detailRes.ok) {
      fullAccount = await detailRes.json();
    } else {
      throw new Error(`Failed to fetch full account metadata for account ID ${metaApiAccountId}`);
    }
  }

  const region = fullAccount.region || 'new-york';
  return { metaApiAccountId, region, fullAccount };
}

export async function fetchAccountInformationWithMultiRegionFallback(metaApiAccountId: string, initialRegion: string, headers: any) {
  const regionsToTry = [initialRegion, ...STANDARD_REGIONS.filter(r => r !== initialRegion)];
  let lastError: any = null;

  for (const reg of regionsToTry) {
    const regionalBaseUrl = `https://mt-client-api-v1.${reg}.agiliumtrade.ai`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const url = `${regionalBaseUrl}/users/current/accounts/${metaApiAccountId}/account-information`;
        const res = await safeFetch(url, { headers }, `MetaApi-AccountInfo-${reg}-attempt${attempt}`);
        if (res.ok) {
          return await res.json();
        }
        const errText = await res.text();
        if (res.status === 404 && errText.includes('NotFoundError')) {
          break; // try next region
        }
        if ([400, 504].includes(res.status) || errText.includes('E_NOT_SYNCHRONIZED')) {
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 2500));
            continue;
          }
        }
        throw new Error(`Failed to fetch account info on region ${reg} (${res.status}): ${errText}`);
      } catch (err: any) {
        lastError = err;
        if (err.message && err.message.includes('NotFoundError')) {
          break; // try next region
        }
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2500));
          continue;
        }
      }
    }
  }

  throw lastError || new Error(`Failed to fetch account information for account ID ${metaApiAccountId} across all regions.`);
}
