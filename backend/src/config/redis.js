let redisClient = null;
let connectPromise = null;
let createRedisClient = null;
let hasLoggedMissingPackage = false;
let hasLoggedUnavailableRedis = false;

const isRedisConfigured = () => Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);

const loadRedisPackage = () => {
  if (createRedisClient) {
    return createRedisClient;
  }

  try {
    ({ createClient: createRedisClient } = require('redis'));
    return createRedisClient;
  } catch (error) {
    if (!hasLoggedMissingPackage) {
      console.warn('Redis package is not installed yet. Falling back to local booking lock mode.');
      hasLoggedMissingPackage = true;
    }
    return null;
  }
};

const buildRedisOptions = () => {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL };
  }

  return {
    socket: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
    },
    password: process.env.REDIS_PASSWORD || undefined,
  };
};

const connectRedis = async () => {
  if (!isRedisConfigured()) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (connectPromise) {
    return connectPromise;
  }

  const clientFactory = loadRedisPackage();
  if (!clientFactory) {
    return null;
  }

  const client = clientFactory(buildRedisOptions());
  client.on('end', () => {
    redisClient = null;
    connectPromise = null;
  });
  client.on('error', (error) => {
    if (!hasLoggedUnavailableRedis) {
      console.warn(`Redis connection warning: ${error.message}`);
      hasLoggedUnavailableRedis = true;
    }
  });

  connectPromise = client.connect()
    .then(() => {
      redisClient = client;
      hasLoggedUnavailableRedis = false;
      connectPromise = null;
      console.log('✅ Redis connected: distributed booking locks enabled');
      return redisClient;
    })
    .catch((error) => {
      if (!hasLoggedUnavailableRedis) {
        console.warn(`Redis unavailable, local booking lock fallback enabled: ${error.message}`);
        hasLoggedUnavailableRedis = true;
      }
      connectPromise = null;
      return null;
    });

  return connectPromise;
};

const getRedisClient = () => (redisClient?.isOpen ? redisClient : null);

module.exports = {
  connectRedis,
  getRedisClient,
  isRedisConfigured,
};
