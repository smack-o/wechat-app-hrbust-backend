'use strict';

const assert = require('assert');
const Redis = require('ioredis');
const config = require('../config/config');

// module.exports = app => {
//   app.addSingleton('redis', createClient);
// };

let count = 0;

function createClient(config) {
  let client;

  if (config.cluster === true) {
    assert(config.nodes && config.nodes.length !== 0, '[egg-redis] cluster nodes configuration is required when use cluster redis');

    config.nodes.forEach(client => {
      assert(client.host && client.port && client.password !== undefined && client.db !== undefined,
        `[egg-redis] 'host: ${client.host}', 'port: ${client.port}', 'password: ${client.password}', 'db: ${client.db}' are required on config`);
    });
     console.info('[egg-redis] cluster connecting');
    client = new Redis.Cluster(config.nodes, config);
  } else if (config.sentinels) {
    assert(config.sentinels && config.sentinels.length !== 0, '[egg-redis] sentinels configuration is required when use redis sentinel');

    config.sentinels.forEach(sentinel => {
      assert(sentinel.host && sentinel.port,
        `[egg-redis] 'host: ${sentinel.host}', 'port: ${sentinel.port}' are required on config`);
    });

    assert(config.name && config.password !== undefined && config.db !== undefined,
      `[egg-redis] 'name of master: ${config.name}', 'password: ${config.password}', 'db: ${config.db}' are required on config`);

     console.info('[egg-redis] sentinel connecting start');
    client = new Redis(config);
  } else {
    assert(config.host && config.port && config.password !== undefined && config.db !== undefined,
      `[egg-redis] 'host: ${config.host}', 'port: ${config.port}', 'password: ${config.password}', 'db: ${config.db}' are required on config`);
     console.info('[egg-redis] server connecting redis://:***@%s:%s/%s',
      config.host, config.port, config.db);
    client = new Redis(config);
  }

  client.on('connect', () => {
     console.info('[egg-redis] client connect success');
  });
  client.on('error', err => {
     console.error('[egg-redis] client error: %s', err);
     console.error(err);
  });

  // app.beforeStart(async () => {
  const index = count++;
  if (config.weakDependent) {
      console.info(`[egg-redis] instance[${index}] is weak dependent and won't block app start`);
    client.once('ready', () => {
        console.info(`[egg-redis] instance[${index}] status OK`);
    });
    return;
  }

  // await awaitFirst(client, [ 'ready', 'error' ]);
    console.info(`[egg-redis] instance[${index}] status OK, client ready`);
  // });

  return client;
}

const PRODUCTION = process.env.NODE_ENV === 'production'

let redisConfig = PRODUCTION ? {
  host: config.redis.host,
  port:  config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
} : {
  host: 'localhost',
  port: 6379,
  password: '',
  db: 0,
}

exports.redis = createClient(redisConfig)
