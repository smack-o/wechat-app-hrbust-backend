const superagent = require('superagent')
const cheerio = require('cheerio')
const Students = require('../../models/Students')
const Users = require('../../models/Users')
const { requestHeader, url, SimulateLogin } = require('../../utils/hrbust')
const { redis } = require('../../utils')

// 登录处理函数
const login = async (ctx) => {
  const { username, password, captcha } = ctx.request.query
  if (!captcha) {
    ctx.throw(400, '请输入验证码')
  }
  if (!username || !password)
    ctx.throw(400, '请求参数错误，登录需要用户名和密码')
  const { hrbustCookie, openid } = ctx.session

  try {
    const Login = new SimulateLogin({
      username,
      password,
      simulateIp: ctx.ip,
      cookie: hrbustCookie,
      captcha,
      autoCaptcha: false,
    })
    const result = await Login.login()
    const { name } = Login

    // 更新Student数据库
    const student = await Students.findOneAndUpdate(
      {
        username,
      },
      {
        username,
        password,
        name,
      },
      {
        upsert: true,
        returnNewDocument: true,
      }
    )

    // 同步更新User数据库，关联student
    await Users.findOneAndUpdate(
      {
        openid,
      },
      {
        student,
      }
    )

    // console.log(result)
    ctx.session.username = Login.username
    ctx.session.hrbustCookie = result.cookie
    ctx.body = {
      data: result,
      status: 200,
      message: '登录成功',
    }
  } catch (e) {
    if (e.code) {
      ctx.throw(400, e.message)
    } else {
      ctx.throw(e)
    }
  }
}

const getCaptcha = async (ctx) => {
  try {
    const Login = new SimulateLogin({
      simulateIp: ctx.ip,
    })
    const captcha = await Login.getCaptcha()
    ctx.session.hrbustCookie = Login.cookie
    ctx.body = {
      status: 200,
      message: '获取验证码成功',
      data: {
        captcha,
      },
    }
  } catch (e) {
    if (e.code) {
      ctx.throw(400, e.message)
    } else {
      ctx.throw(e)
    }
  }
}

// 获取当前周数，（应该存在redis中缓存，本期不做）
const getWeek = async (ctx) => {
  let username = ctx.session.username

  if (!username) {
    ctx.throw(401, '未登陆')
  }
  let { grade } = await Students.findOne({ username })
  if (!grade) {
    grade = parseInt(username.substr(0, 2))
  }

  // redis 数据
  const weekRedis = await redis.getAsync('hrbust_week')

  let weekData = null

  if (weekRedis) {
    weekData = JSON.parse(weekRedis)
  } else {
    const response = await superagent
      .get(url.indexListLeft)
      .charset()
      .set(requestHeader)
      .catch((e) => ctx.throw(400, e))

    const body = response.text
    const $ = cheerio.load(body)
    const result = $('#date span').text()
    const thisWeek = result.replace(/\s/g, '')
    const week =
      thisWeek && thisWeek.match(/第(\w*)周/) && thisWeek.match(/第(\w*)周/)[1]
        ? parseInt(thisWeek.match(/第(\w*)周/)[1])
        : 1
    // eslint-disable-next-line
    const [f, onlineYear, onlineQuarter] = thisWeek.match(/(\w*)(秋|春)/)

    // 春秋学期计算规则不一样【手动捂脸】，这个规则没问题了
    let year
    const quarterMap = { 春: 1, 秋: 0 }
    if (quarterMap[onlineQuarter] === 1) {
      // 春
      year = parseInt(onlineYear) - 2001
    } else {
      // 秋
      year = parseInt(onlineYear) - 2000
    }

    weekData = {
      week,
      year,
      quarter: quarterMap[onlineQuarter],
    }
    // 数据存入 redis

    redis.setAsync('hrbust_week', JSON.stringify(weekData), 'EX', 60 * 60 * 48)
  }

  const term = (weekData.year - grade) * 2 + weekData.quarter

  ctx.body = {
    data: { term, week: weekData.week },
    status: 200,
  }
}

// 登录处理函数
const logout = async (ctx) => {
  const { openid } = ctx.session
  await Users.findOneAndUpdate(
    {
      openid,
    },
    {
      student: null,
    }
  )
  ctx.session = null
  ctx.body = {
    status: 200,
    message: '解绑成功',
  }
}

module.exports = {
  login,
  logout,
  getCaptcha,
  getWeek,
}
