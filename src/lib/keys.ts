
export type AIProvider = 'gemini' | 'deepseek' | 'unknown';

export const STORAGE_KEYS = {
  ACTIVATION_KEY: 'bentotrade_universal_key',
  DETECTED_PROVIDER: 'bentotrade_detected_provider'
};

export const detectProvider = (key: string): AIProvider => {
  if (!key) return 'unknown';
  if (key.startsWith('AIzaSy')) return 'gemini';
  if (key.startsWith('sk-')) return 'deepseek';
  return 'unknown';
};

export const saveActivationKey = (key: string) => {
  const provider = detectProvider(key);
  localStorage.setItem(STORAGE_KEYS.ACTIVATION_KEY, key);
  localStorage.setItem(STORAGE_KEYS.DETECTED_PROVIDER, provider);
  return provider;
};

export const getActivationKey = () => {
  return localStorage.getItem(STORAGE_KEYS.ACTIVATION_KEY);
};

export const getDetectedProvider = (): AIProvider => {
  return (localStorage.getItem(STORAGE_KEYS.DETECTED_PROVIDER) as AIProvider) || 'unknown';
};

export const clearKeys = () => {
  localStorage.removeItem(STORAGE_KEYS.ACTIVATION_KEY);
  localStorage.removeItem(STORAGE_KEYS.DETECTED_PROVIDER);
};

export const isAIActive = () => {
  const key = getActivationKey();
  const provider = getDetectedProvider();
  return !!key && provider !== 'unknown';
};
