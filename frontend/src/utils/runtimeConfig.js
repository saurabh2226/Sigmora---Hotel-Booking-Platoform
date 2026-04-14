const browserConfig = typeof window !== 'undefined' ? window.__SIGMORA_CONFIG__ || {} : {};
const viteConfig = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};

const readConfig = (key, fallback = '') => {
  const runtimeValue = browserConfig[key];
  if (runtimeValue !== undefined && runtimeValue !== null && runtimeValue !== '') {
    return runtimeValue;
  }

  const buildValue = viteConfig[key];
  if (buildValue !== undefined && buildValue !== null && buildValue !== '') {
    return buildValue;
  }

  return fallback;
};

export const PUBLIC_CONFIG = {
  apiUrl: readConfig('VITE_API_URL', 'https://sigmora.onrender.com/api/v1'),
  razorpayKey: readConfig('VITE_RAZORPAY_KEY_ID', ''),
  googleMapsKey: readConfig('VITE_GOOGLE_MAPS_KEY', readConfig('VITE_GOOGLE_MAPS_API_KEY', '')),
};

export const API_ORIGIN = PUBLIC_CONFIG.apiUrl.replace(/\/api\/v1\/?$/, '');
