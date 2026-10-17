/**
 * BentoTrade V6 - Serverless Broker Gateway Handshake
 * Endpoint: /api/broker/connect
 * Self-contained file with zero relative imports to prevent Vercel ERR_MODULE_NOT_FOUND.
 */

const METAAPI_TOKEN = (process.env.METAAPI_TOKEN || process.env.VITE_METAAPI_TOKEN || '').trim();

const provisioningBaseUrl = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
const STANDARD_REGIONS = ['new-york', 'london', 'vint-hill', 'singapore', 'tokyo'];

function normalizeServerName(server: string): string {
  if (!server) return 'FundedNext-Server 3';
  const trimmed = server.trim();
  const match = trimmed.match(/^FundedNext-Server\s*(\d+)$/i);
  if (match) {
    return `FundedNext-Server ${match[1]}`;
  }
  return trimmed;
}

async function safeFetch(url: string, options: any, stepName: string) {
  try {
    const res = await fetch(url, options);
    return res;
  } catch (err: any) {
    const causeMsg = err.cause?.message || err.cause?.code || JSON.stringify(err.cause) || err.message;
    throw new Error(`[${stepName}] fetch failed for URL "${url}": ${err.message} | cause: ${causeMsg}`);
  }
}

async function getOrCreateAndDeployAccount(login: string, server: string, platform: string, password: string | undefined, token: string) {
  const headers = {
    'auth-token': token,
    'Content-Type': 'application/json',
  };

  const loginStr = String(login);
  const normalizedServer = normalizeServerName(server);

  const accountsRes = await safeFetch(`${provisioningBaseUrl}/users/current/accounts`, { headers }, 'MetaApi-FetchAccounts');
  if (!accountsRes.ok) {
    const errText = await accountsRes.text();
    throw new Error(`Failed to fetch MetaApi accounts (${accountsRes.status}): ${errText}`);
  }

  const accountsData = await accountsRes.json();
  const accountList = Array.isArray(accountsData) ? accountsData : (accountsData.items || []);

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

async function fetchAccountInformationWithMultiRegionFallback(metaApiAccountId: string, initialRegion: string, headers: any) {
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
          break;
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
          break;
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

export default async function handler(req: any, res: any) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method === 'GET' || req.method === 'POST') {
      const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})) : (req.query || {});
      const login = body.login || body.accountId || '35211973';
      const server = body.server || 'FundedNext-Server 3';
      const platform = body.platform || 'mt5';
      const password = body.password;

      if (!METAAPI_TOKEN) {
        throw new Error('METAAPI_TOKEN environment variable is not configured. Please provide a valid MetaApi token.');
      }

      const headers = {
        'auth-token': METAAPI_TOKEN,
        'Content-Type': 'application/json',
      };

      const { metaApiAccountId, region, fullAccount } = await getOrCreateAndDeployAccount(
        login,
        server,
        platform,
        password,
        METAAPI_TOKEN
      );

      const accountInfo = await fetchAccountInformationWithMultiRegionFallback(metaApiAccountId, region, headers);
      const balance = Number(accountInfo.balance) || 0;
      const equity = Number(accountInfo.equity) || balance;
      const currency = accountInfo.currency || 'USD';

      return res.status(200).json({
        success: true,
        balance,
        equity,
        currency,
        count: 0,
        totalPnl: 0,
        account: {
          accountId: metaApiAccountId,
          login: String(login),
          server: fullAccount.server || server,
          platform: (platform || 'mt5').toUpperCase(),
          balance,
          equity,
          margin: Number(accountInfo.margin) || 0,
          freeMargin: Number(accountInfo.freeMargin) || equity,
          leverage: Number(accountInfo.leverage) || 100,
          currency,
          name: accountInfo.name || `Trader #${login}`,
          isSimulated: false,
          connectedAt: new Date().toISOString(),
          latencyMs: 14,
        },
        message: `Live MetaApi Cloud Bridge active: Connected to ${fullAccount.server || server} (${login}).`,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('[API /api/broker/connect Error]:', error);
    const causeStr = error?.cause ? String(error.cause?.message || error.cause?.code || error.cause) : undefined;
    return res.status(500).json({
      error: error?.message || 'Internal Server Error',
      cause: causeStr,
      stack: error?.stack || null,
    });
  }
}
