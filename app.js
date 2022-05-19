
const Koa = require('koa')

const app = new Koa()
const views = require('koa-views')
const json = require('koa-json')
const onerror = require('koa-onerror')
// const bodyparser = require('koa-bodyparser')
const body = require('koa-better-body')
const logger = require('koa-logger')
// const session = require('koa-session-minimal')
const proxy = require('koa-proxies')
// const request = require('request')
// const MongoStore = require('koa-generic-session-mongo')
const session = require('koa-session')
// const session = require('koa-generic-session')
// const redisStore = require('koa-redis')
const moment = require('moment')
const { keys } = require('./config/config')

const { redis } = require('./utils/redis')
// const { mongodb } = require('./utils')
const SESSION = 'SESSION'

const CONFIG = {
  key: 'SESSION_ID', /** (string) cookie key (default is koa.sess) */
  maxAge: 24 * 60 * 60 * 1000,
  httpOnly: true,
  encrypt: false,
  signed: false,
  renew: true,
  store: {
    async get (key) {
      const res = await redis.get(`${SESSION}:${key}`)
      if (!res) return null
      return JSON.parse(res)
    },

    async set (key, value, maxAge) {
      maxAge = typeof maxAge === 'number' ? maxAge : 30 * 24 * 60 * 60 * 1000
      value = JSON.stringify(value)
      await redis.set(`${SESSION}:${key}`, value, 'PX', maxAge)
    },

    async destroy (key) {
      await redis.del(`${SESSION}:${key}`)
    },
  },
  logValue: true,
}

app.use(session(CONFIG, app))

// middleware
app.use(proxy('/homepage', {
  target: 'http://jwzx.hrbust.edu.cn',
  changeOrigin: true,
  // agent: new httpsProxyAgent('http://1.2.3.4:88'), // if you need or just delete this line
  // rewrite: path => path.replace(/\/homepage/, ''),
  logs: false,
}))

app.use(body({
  multipart: true,
  querystring: require('qs'),
}))

// const WXBizDataCrypt = require('../../utils/WXBizDataCrypt')
app.proxy = true
moment.locale('zh-cn')

// error handler
onerror(app)

app.keys = keys

// app.use(session({
//   store: new MongoStore({
//     url: mongodb,
//   }),
// }))

// app.use(session({
//   key: 'SESSION_ID',
//   maxAge: 24 * 60 * 60 * 1000,
//   httpOnly: true,
//   encrypt: true,
//   renew: true,
//   store: redisStore({
//     // Options specified here
//   }),
// }))

// middlewares
// app.use(bodyparser({
//   enableTypes: ['json', 'form', 'text'],
// }))

app.use(json())
app.use(logger())
app.use(require('koa-static')(`${__dirname}/public`))

app.use(views(`${__dirname}/views`, {
  extension: 'ejs',
}))

// error wrapper
app.use(async (ctx, next) => {
  try {
    if (ctx.request.path.indexOf('/api/hrbust') >= 0 && !ctx.session.openid) {
      // 未登录
      ctx.throw(401, '微信登录失效')
      return
    }
    // 登录之后记录 count
    ctx.session.count = ctx.session.count ? ctx.session.count + 1 : 1
    await next()
  } catch (e) {
    switch (e.status) {
      case 204: // No Content
      case 400: // Bad Request
      case 401: // Unauthorized
      case 403: // Forbidden
      case 404: // Not Found
      case 406: // Not Acceptable
      case 409: // Conflict
        ctx.status = e.status
        ctx.body = {
          message: e.message,
          status: e.status,
        }
        break
      default:
      case 500: // Internal Server Error
        console.error(e.stack)
        ctx.status = e.status || 500
        ctx.body = app.env === 'development' ? e.stack : e.message
        break
    }
  }
})

// logger
// app.use(async (ctx, next) => {
//   const start = new Date();
//   await next();
//   const ms = new Date() - start;
//   console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
// });

const routes = {
  index: require('./routes/index'),
  // users: require('./routes/users'),
  // 公共 api
  user: require('./routes/user'),
  // 哈理工 api
  hrbust: require('./routes/hrbust'),
  // 一些公共 api
  other: require('./routes/other'),
  // 后台 api
  backend: require('./routes/backend'),
  cetv2: require('./routes/cetv2'),
  wxmp: require('./routes/wxmp'),
  pdd: require('./routes/pdd'),
}

// routes
// app.use(index.routes(), index.allowedMethods())
// app.use(users.routes(), users.allowedMethods())

Object.keys(routes).forEach(key => {
  const route = routes[key]
  app.use(route.routes(), route.allowedMethods())
})

// error-handling
app.on('error', (err, ctx) => {
  console.error('server error', err, ctx)
})

module.exports = app
