const { randomUUID } = require('crypto');
const { connectRedis, getRedisClient } = require('../config/redis');

const DEFAULT_LOCK_TTL_MS = Number(process.env.REDIS_LOCK_TTL_MS || 15000);
const DEFAULT_WAIT_TIMEOUT_MS = Number(process.env.REDIS_LOCK_WAIT_MS || 5000);
const DEFAULT_RETRY_DELAY_MS = Number(process.env.REDIS_LOCK_RETRY_MS || 120);

const memoryLocks = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pruneExpiredMemoryLock = (key) => {
  const currentLock = memoryLocks.get(key);
  if (currentLock && currentLock.expiresAt <= Date.now()) {
    clearTimeout(currentLock.timer);
    memoryLocks.delete(key);
  }
};

const acquireMemoryLock = async (key, { ttlMs, waitTimeoutMs, retryDelayMs }) => {
  const deadline = Date.now() + waitTimeoutMs;

  while (Date.now() <= deadline) {
    pruneExpiredMemoryLock(key);
    const currentLock = memoryLocks.get(key);

    if (!currentLock) {
      const token = randomUUID();
      const timer = setTimeout(() => {
        const activeLock = memoryLocks.get(key);
        if (activeLock?.token === token) {
          memoryLocks.delete(key);
        }
      }, ttlMs);

      timer.unref?.();
      memoryLocks.set(key, {
        token,
        expiresAt: Date.now() + ttlMs,
        timer,
      });

      return {
        key,
        token,
        provider: 'memory',
      };
    }

    await sleep(retryDelayMs);
  }

  throw new Error('LOCK_ACQUISITION_TIMEOUT');
};

const releaseMemoryLock = async (lock) => {
  if (!lock) {
    return;
  }

  const currentLock = memoryLocks.get(lock.key);
  if (!currentLock || currentLock.token !== lock.token) {
    return;
  }

  clearTimeout(currentLock.timer);
  memoryLocks.delete(lock.key);
};

const acquireRedisLock = async (key, { ttlMs, waitTimeoutMs, retryDelayMs }) => {
  const client = getRedisClient() || await connectRedis();
  if (!client) {
    return null;
  }

  const deadline = Date.now() + waitTimeoutMs;
  const token = randomUUID();

  while (Date.now() <= deadline) {
    const result = await client.set(key, token, {
      NX: true,
      PX: ttlMs,
    });

    if (result === 'OK') {
      return {
        key,
        token,
        provider: 'redis',
      };
    }

    await sleep(retryDelayMs);
  }

  throw new Error('LOCK_ACQUISITION_TIMEOUT');
};

const releaseRedisLock = async (lock) => {
  if (!lock) {
    return;
  }

  const client = getRedisClient();
  if (!client) {
    return;
  }

  try {
    await client.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      {
        keys: [lock.key],
        arguments: [lock.token],
      }
    );
  } catch (error) {
    console.warn(`Redis lock release warning: ${error.message}`);
  }
};

const acquireLock = async (key, options = {}) => {
  const config = {
    ttlMs: options.ttlMs || DEFAULT_LOCK_TTL_MS,
    waitTimeoutMs: options.waitTimeoutMs || DEFAULT_WAIT_TIMEOUT_MS,
    retryDelayMs: options.retryDelayMs || DEFAULT_RETRY_DELAY_MS,
  };

  const redisLock = await acquireRedisLock(key, config);
  if (redisLock) {
    return redisLock;
  }

  return acquireMemoryLock(key, config);
};

const releaseLock = async (lock) => {
  if (!lock) {
    return;
  }

  if (lock.provider === 'redis') {
    await releaseRedisLock(lock);
    return;
  }

  await releaseMemoryLock(lock);
};

const withLock = async (key, options, task) => {
  const lock = await acquireLock(key, options);

  try {
    return await task(lock);
  } finally {
    await releaseLock(lock);
  }
};

module.exports = {
  withLock,
};
