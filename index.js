import {promisify} from 'node:util';
import {createClient} from 'redis-mock';

export async function redisMockStore(config) {
  const redisCache = createClient(config);

  return buildRedisStoreWithConfig(redisCache, config);
}

const buildRedisStoreWithConfig = (redisCache, config) => {

  const multi = redisCache.multi();
  const getAsync = promisify(redisCache.get).bind(redisCache);
  const ttlAsync = promisify(redisCache.ttl).bind(redisCache);
  const setAsync = promisify(redisCache.set).bind(redisCache);
  const delAsync = promisify(redisCache.del).bind(redisCache);
  const setExAsync = promisify(redisCache.setex).bind(redisCache);
  const msetAsync = promisify(redisCache.mset).bind(redisCache);
  const mgetAsync = promisify(redisCache.mget).bind(redisCache);
  const flushdbAsync = promisify(redisCache.flushdb).bind(redisCache);
  const keysAsync = promisify(redisCache.keys).bind(redisCache);
  const multiExecAsync = promisify(multi.exec).bind(multi);

  const isCacheableValue =
    config.isCacheableValue || (value => value !== undefined && value !== null);

  const set = async (key, value, options) => {
    if (!isCacheableValue(value)) {
      throw new Error(`"${value}" is not a cacheable value`);
    }

    const ttl = (options?.ttl || options?.ttl === 0) ? options.ttl : config.ttl;

    if (ttl) {
      return setExAsync(key, ttl, encodeValue(value));
    } else {
      return setAsync(key, encodeValue(value));
    }
  };
  const get = async (key, options) => {
    const val = await getAsync(key);

    if (val === null) {
      return null;
    }
    return options.parse !== false ? decodeValue(val) : val;
  };
  const del = async (args) => {
    let options = {};
    if (isObject(args.at(-1))) {
      options = args.pop();
    }
    return delAsync(args);
  };
  const mset = async (args) => {
    let options = {};
    if (isObject(args.at(-1))) {
      options = args.pop();
    }
    const ttl = (options.ttl || options.ttl === 0) ? options.ttl : config.ttl;

    // Zips even and odd array items into tuples
    const items = args
      .map((key, index) => {
        if (index % 2 !== 0) return null;
        const value = args[index + 1];
        if (!isCacheableValue(value)) {
          throw new Error(`"${value}" is not a cacheable value`);
        }
        return [key, encodeValue(value)];
      })
      .filter((key) => key !== null);

    if (ttl) {
      for (const kv of items) {
        const [key, value] = kv;
        multi.setex(key, ttl, value);
      }
      return multiExecAsync();
    } else {
      return msetAsync(items);
    }
  };
  const mget = async (...args) => {
    let options = {};
    if (isObject(args.at(-1))) {
      options = args.pop();
    }

    const res = await mgetAsync(args)
    return res.map((val) => {
      if (val === null) {
        return null;
      }

      return options.parse !== false ? decodeValue(val) : val;
    })
  };
  const mdel = async (...args) => {
    let options = {};
    if (isObject(args.at(-1))) {
      options = args.pop();
    }
    if (Array.isArray(args)) {
      args = args.flat();
    }
    return delAsync(args);
  };
  const reset = async () => {
    return flushdbAsync();
  };
  const keys = async (pattern) => {
    return keysAsync(pattern);
  };
  const ttl = async (key) => {
    return ttlAsync(key);
  };

  return {
    name: 'redis-mock',
    getClient: () => redisCache,
    isCacheableValue,
    set: async(key, value, options, cb) => {
      if (typeof options === 'function') {
        cb = options;
        options = {};
      }
      options = options || {};

      if (typeof cb === 'function') {
        try {
          const res = await set(key, value, options)
          cb(null, res)
        } catch (error) {
          cb(error, null)
        }
      } else {
        return set(key, value, options);
      }
    },
    get: async(key, options, cb) => {
      if (typeof options === 'function') {
        cb = options;
        options = {};
      }
      options = options || {};

      if (typeof cb === 'function') {
        try {
          const res = await get(key, options)
          cb(null, res)
        } catch (error) {
          cb(error, null)
        }
      } else {
        return get(key, options);
      }
    },
    del: async(...args) => {
      if (typeof args.at(-1) === 'function') {
        const cb = args.pop();
        try {
          const res = await del(args)
          cb(null, res)
        } catch (error) {
          cb(error, null)
        }
      }
      return del(args);
    },
    mset: async(...args) => {
      if (typeof args.at(-1) === 'function') {
        const cb = args.pop();
        try {
          const res = await mset(args)
          cb(null, res)
        } catch (error) {
          cb(error, null)
        }
      } else {
        return mset(args);
      }
    },
    mget: async(...args) => {
      if (typeof args.at(-1) === 'function') {
        const cb = args.pop();
        try {
          const res = await mget(...args)
          cb(null, res)
        } catch (error) {
          cb(error, null)
        }
      } else {
        return mget(...args);
      }
    },
    mdel: async(...args) => {
      if (typeof args.at(-1) === 'function') {
        const cb = args.pop();
        try {
          const res = await mdel(...args)
          cb(null, res)
        } catch (error) {
          cb(error, null)
        }
      } else {
        return mdel(...args);
      }
    },
    reset: async(cb) => {
      if (typeof cb === 'function') {
        try {
          const res = await reset()
          cb(null, res)
        } catch (error) {
          cb(error, null)
        }
      } else {
        return reset();
      }
    },
    keys: async(pattern = '*', cb) => {
      if (typeof cb === 'function') {
        try {
          const res = await keys(pattern)
          cb(null, res)
        } catch (error) {
          cb(error, null)
        }
      } else {
        return keys(pattern);
      }
    },
    ttl: async(key, cb) => {
      if (typeof cb === 'function') {
        try {
          const res = await ttl(key)
          cb(null, res)
        } catch (error) {
          cb(error, null)
        }
      } else {
        return ttl(key);
      }
    },
  };
};

function encodeValue(value) {
  return JSON.stringify(value) || '"undefined"';
}

function decodeValue(val) {
  return JSON.parse(val);
}

function isObject(object) {
  return typeof object === 'object'
    && !Array.isArray(object)
    && object !== null;
}
