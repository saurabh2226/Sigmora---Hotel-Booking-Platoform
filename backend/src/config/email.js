const nodemailer = require('nodemailer');

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

const hasSmtpConfig = () => Boolean(
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS
);

const getEmailTransportMode = () => (
  hasSmtpConfig() ? 'smtp' : 'json'
);

const createTransporter = () => {
  if (!hasSmtpConfig()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EMAIL_HOST, EMAIL_USER, and EMAIL_PASS must be set for SMTP delivery');
    }

    // In local development, capture emails without sending them.
    const transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    transporter.__deliveryMode = 'json';
    return transporter;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: parseBoolean(process.env.EMAIL_SECURE, false),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    requireTLS: parseBoolean(process.env.EMAIL_REQUIRE_TLS, false),
  });
  transporter.__deliveryMode = 'smtp';
  return transporter;
};

module.exports = createTransporter;
module.exports.getEmailTransportMode = getEmailTransportMode;
module.exports.hasSmtpConfig = hasSmtpConfig;
