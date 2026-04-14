const cloudinary = require('cloudinary').v2;

const normalizeEnv = (value) => String(value || '').trim();
const cloudName = normalizeEnv(process.env.CLOUDINARY_CLOUD_NAME);
const apiKey = normalizeEnv(process.env.CLOUDINARY_API_KEY);
const apiSecret = normalizeEnv(process.env.CLOUDINARY_API_SECRET);

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
  disable_promise: true,
});

cloudinary.isConfigured = () => (
  /^[a-z0-9_-]+$/.test(cloudName)
  && Boolean(apiKey)
  && Boolean(apiSecret)
);

cloudinary.getConfigError = () => {
  if (!cloudName) {
    return 'Hotel image uploads are unavailable because CLOUDINARY_CLOUD_NAME is missing.';
  }

  if (!/^[a-z0-9_-]+$/.test(cloudName)) {
    return 'Hotel image uploads are unavailable because CLOUDINARY_CLOUD_NAME is invalid.';
  }

  if (!apiKey || !apiSecret) {
    return 'Hotel image uploads are unavailable because Cloudinary API credentials are missing.';
  }

  return '';
};

module.exports = cloudinary;
