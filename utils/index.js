// const debug = require('debug')('techmeme-backend:error');
const { promisify } = require('util')
const redisClient = require('./redis')

const config = require('../config/config')

// redisClient.getAsync = (...args) => {
//   // return promisify(redisClient.get).bind(redisClient)
//   return promisify(redisClient.get).bind(redisClient)(...args).catch(err => {
//     console.error('get redis error: ', err)
//     return Promise.resolve()
//   }).then(res => {
//     console.log('get data from redis success');
//     return res;
//   })
// }

// redisClient.setAsync = (...args) => {
//   // return promisify(redisClient.get).bind(redisClient)
//   return promisify(redisClient.set).bind(redisClient)(...args).catch(err => {
//     console.error('set redis error: ', err)
//     return Promise.resolve()
//   }).then(res => {
//     console.log('set data to redis success');
//     return res;
//   })
// }


const PRODUCTION = process.env.NODE_ENV === 'production'

let mongodb = 'mongodb://127.0.0.1:27017/hrbust'
let sessionSecret = 'test'

if (PRODUCTION) {
  const { mongo } = config
  mongodb = `mongodb://${mongo.user}:${mongo.password}@${mongo.host}:${mongo.port}/${mongo.database}?authSource=${mongo.authSource}`;
  ({ sessionSecret } = config)
}

module.exports = {
  mongodb,
  sessionSecret,
  redis: redisClient,
}
