const cheerio = require('cheerio')
const charset = require('superagent-charset')
const superagent = charset(require('superagent'))
const moment = require('moment')
const fs = require('fs')
const path = require('path')
const discernCaptcha = require('./discernCaptcha')
const { getErrorData } = require('../constants/errorCode')
const Students = require('../models/Students')
const to = require('./awaitErrorCatch')

moment.locale('zh-cn')

// 请求头
const requestHeader = {
  'Accept-Encoding': 'gzip, deflate',
  Origin: 'http://jwzx.hrbust.edu.cn',
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
  'Host': 'jwzx.hrbust.edu.cn',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'

}
// const getCaptcha = require('./captcha.js')
// const mongoUtils = require('../../spider/mongoUtils')

let captchaCount = 0

// 爬虫 url
const url = {
  login_url: 'http://jwzx.hrbust.edu.cn/academic/common/security/login.jsp',
  captcha_url: 'http://jwzx.hrbust.edu.cn/academic/getCaptcha.do',
  check_url: 'http://jwzx.hrbust.edu.cn/academic/j_acegi_security_check?',
  index: 'http://jwzx.hrbust.edu.cn/academic/index.jsp',
  indexHeader: 'http://jwzx.hrbust.edu.cn/academic/showHeader.do',
  indexListLeft: 'http://jwzx.hrbust.edu.cn/academic/listLeft.do',
  index_new: 'http://jwzx.hrbust.edu.cn/academic/index_new.jsp',
  studentId: 'http://jwzx.hrbust.edu.cn/academic/student/currcourse/currcourse.jsdo?year=40&term=2',
  loginError: 'http://jwzx.hrbust.edu.cn/academic/common/security/login.jsp?login_error=1',
  grade_url: 'http://jwzx.hrbust.edu.cn/academic/manager/score/studentOwnScore.do?groupId=&moduleId=2020',
  exam_url: 'http://jwzx.hrbust.edu.cn/academic/manager/examstu/studentQueryAllExam.do',
  news_url: 'http://jwzx.hrbust.edu.cn/homepage/infoArticleList.do?columnId=354',
  news_detail_url: 'http://jwzx.hrbust.edu.cn/homepage/infoSingleArticle.do?',
  roomschedule_url: 'http://jwzx.hrbust.edu.cn/academic/teacher/teachresource/roomschedule_week.jsdo',
  roomschedulequery: 'http://jwzx.hrbust.edu.cn/academic/teacher/teachresource/roomschedulequery.jsdo'
}

/**
 * new SimulateLogin(arguments)
 * SimulateLogin return a cookie
 * @param {object}
   * @param {string} username   用户名
   * @param {string} password   密码
   * @param {string} cookie     理工的cookie信息
   * @param {string} simulateIp
   * @param {string} captcha
 */

class SimulateLogin {
  constructor(option = {}) {
    const {
      autoCaptcha = false,
      username,
      password,
      simulateIp,
      cookie = '',
      captcha = '',
      openid = '',
    } = option
    this.autoCaptcha = autoCaptcha
    this.username = username
    this.password = password
    this.captcha = captcha
    this.cookie = cookie
    this.openid = openid
    this.discernCount = 0
    if (simulateIp) {
      requestHeader['X-Forwarded-For'] = simulateIp
    }
  }

  async login() {
    const data = await this.checkCookie()

    // cookie 合法 不需要登录
    if (data.isValidCookie) {
      return {
        cookie: this.cookie,
        ...data,
      }
    }

    // 输入验证码登录
    if (!this.autoCaptcha) {
      return this.loginHandler()
    }
    return this.autoDiscernCaptcha()
  }

  async autoDiscernCaptcha() {
    this.discernCount += 1
    if (this.discernCount > 40) {
      // 自动识别超过30次，就不再自动识别了
      return Promise.reject((getErrorData({
        message: '自动识别验证码次数过多',
        code: 400002,
      })))
    }
    const captchaData = await this.discernCaptchaHandler()
    // console.log(captchaData)
    // 验证码识别错误
    if (captchaData.error) {
      return this.autoDiscernCaptcha()
    }

    this.captcha = captchaData.text
    let result
    try {
      result = await this.loginHandler()
    } catch (e) {
      // 教务在线验证码校验错误，需要再次尝试
      if (e.message.match(/验证码/)) {
        // handler captcha again, then handler login again
        return this.autoDiscernCaptcha()
      }

      return Promise.reject((getErrorData({
        error: e,
        code: 400002,
      })))
    }
    return result
  }

  // 异步获取验证码
  async getCaptcha() {
    await this.getCookie()
    const buffer = await this.getCaptchaBuffer()
    // base 拼接
    return `data:image/png;base64, ${buffer.toString('base64')}`
  }

  // 检查是否登录，并返回当前学期、周数
  checkCookie() {
    return new Promise(resolve => {
      superagent
        .get(url.indexListLeft)
        .charset()
        .set(requestHeader)
        .set('Cookie', this.cookie)
        .redirects(0)
        .end((err, response) => {
          if (err) {
            console.error('get index is error')
            resolve({
              isValidCookie: false,
            })
          } else {
            const body = response.text
            const $ = cheerio.load(body)
            const result = $('#date span').text()
            const thisWeek = result.replace(/\s/g, '')
            const weekMatch = thisWeek.match(/第(\w*)周/) || []
            this.week = weekMatch[1] ? parseInt(weekMatch[1]) : 1
            const terms = thisWeek.match(/(\w*)(秋|春)/)
            this.year = parseInt(terms[1]) - 1980
            const termsObj = {
              春: 1,
              秋: 2,
            }
            this.term = termsObj[terms[2]]
            // 如果 lenght是0 证明未登陆 cookie 失效
            const flag = $('#menu li').length === 0
            resolve({
              isValidCookie: !flag,
            })
          }
        })
    })
  }

  // 获取 cookie
  getCookie() {
    return superagent
      .post(url.login_url)
      .set(requestHeader)
      .redirects(0)
      .then((res) => {
        this.cookie = res.headers['set-cookie'][0].split(';')[0]
        return Promise.resolve(this.cookie)
      })
      .catch(error => {
        return Promise.reject((getErrorData({
          error,
          code: 400004,
        })))
      })
  }

  // 获取验证码
  getCaptchaBuffer() {
    return superagent
      .get(url.captcha_url)
      .buffer(true)
      .set(requestHeader)
      .set('Cookie', this.cookie)
      .then(response => {
        const dataBuffer = Buffer.from(response.body, 'base64')
        return Promise.resolve(dataBuffer)
      })
      .catch(error => {
        Promise.reject(getErrorData({
          error,
          code: 400003,
        }))
      })
  }

  // 验证码识别
  async discernCaptchaHandler() {
    const buffer = await this.getCaptchaBuffer()
    const captchaPath = path.resolve(__dirname, `../captchaCache/${captchaCount}.jpg`)
    console.warn(`captchaCount: ${captchaCount}`, buffer)
    captchaCount += 1
    return new Promise((resolve) => {
      fs.writeFile(captchaPath, buffer, (err) => {
        if (err) throw err
        discernCaptcha(captchaPath).then((result) => {
          fs.unlinkSync(captchaPath)
          // 解析验证码出错
          if (result.error || !result.text || result.predictable === 'False') {
            // this.captcha(callback)
            // return
            resolve({
              error: '识别错误',
            })
          }
          let text = ''
          text = result && result.text ? result.text : ''
          resolve({
            text,
          })
        }).catch(() => {
          // 解析验证码出错
          resolve({
            error: '识别错误',
          })
        })
      })
    })
  }

  // 登录处理
  loginHandler() {
    return superagent
      .post(url.check_url)
      .send({
        j_username: this.username,
        j_password: this.password,
        j_captcha: this.captcha,
      })
      .set(requestHeader)
      .set('Cookie', this.cookie)
      .redirects(0)
      .catch(async (e) => {
        const location = e.response.headers.location
        console.log(location, 'location');
        if (e.response.headers['set-cookie'] && e.response.headers['set-cookie'] && e.response.headers['set-cookie'][0]) {
          this.cookie = e.response.headers['set-cookie'][0].split(';')[0]
        }
        if (location === url.index || location === url.index_new || location === '/academic/index_new.jsp') {
          console.warn('login good')

          // 获取用户名
          await this.getName()
          return Promise.resolve({
            cookie: this.cookie,
            term: this.term,
            year: this.year,
            week: this.week,
          })
          // save student infomation to mongo
          // this.updateMongo()
        }
        return this.errorHandler()
      })
  }

  // 登录成功更新数据库信息
  getName() {
    return superagent
      .get(url.indexHeader)
      .charset()
      .set(requestHeader)
      .set('Cookie', this.cookie)
      .then(async (response) => {
        const body = response.text
        const $ = cheerio.load(body)
        const name = $('#greeting span').text().split('(')[0]
        this.name = name
      })
  }

  // 登录错误处理
  errorHandler() {
    const promise = new Promise((resove, reject) => {
      superagent
        .get(url.loginError)
        .charset()
        .set(requestHeader)
        .set('Cookie', this.cookie)
        .end((error, response) => {
          if (error) {
            return reject((getErrorData({
              error,
              code: 400001,
            })))
          }
          const body = response.text
          const $ = cheerio.load(body)
          const errorText = $('#message').text().replace(/\s/g, '')
          console.log(errorText)
          let code = 400001

          if (/验证码/.test(errorText)) {
            code = 400001
          } else if (/用户名或密码/.test(errorText)) {
            code = 400006
          } else {
            code = 400007
          }

          return reject(getErrorData({
            message: errorText,
            code,
          }))
        })
    })
    return promise
  }
}

// 所有哈理工教务处需要登录的接口，都需要此函数校验是否登录，
// 若未登录返回验证码，并设置新cookie到session种
const checkLogin = async (ctx, option = { autoCaptcha: false }) => {
  const { autoCaptcha } = option
  const { hrbustCookie, username } = ctx.session
  const { captcha } = ctx.query
  if (!username) {
    return ctx.throw(401)
  }

  const { password } = await Students.findOne({ username })
  const Login = new SimulateLogin({
    cookie: hrbustCookie,
    username,
    password,
    autoCaptcha,
    captcha,
  })

  // 验证码登录
  if (captcha) {
    // 自动登录
    const [error] = await to(Login.login())
    if (error) {
      if (error.code) {
        // if (+error.code) {
        // }
        // 如果验证码识别错误，返回验证码
        const captchaBuffer = await Login.getCaptcha()
        ctx.session.hrbustCookie = Login.cookie
        ctx.body = {
          status: error.code,
          message: error.message,
          data: {
            captcha: captchaBuffer,
          },
        }
        return false
        // ctx.throw(400, error.message)
      }
      ctx.throw(error)
      return false
    }
    ctx.session.username = Login.username
    ctx.session.hrbustCookie = Login.cookie
    return true
  }

  const { isValidCookie } = await Login.checkCookie()

  if (isValidCookie) {
    return true
  }

  if (!autoCaptcha) {
    // 如果cookie失效，返回验证码
    const captchaBuffer = await Login.getCaptcha()
    ctx.session.hrbustCookie = Login.cookie
    ctx.body = {
      status: 400005,
      message: '登录已失效',
      data: {
        captcha: captchaBuffer,
      },
    }
    return false
  }

  // 自动登录
  const [error] = await to(Login.login())
  if (error) {
    if (error.code) {
      ctx.throw(400, error.message)
    } else {
      ctx.throw(error)
    }
    return false
  }
  ctx.session.hrbustCookie = Login.cookie
  return true
}

module.exports = {
  url,
  requestHeader,
  SimulateLogin,
  checkLogin,
}
