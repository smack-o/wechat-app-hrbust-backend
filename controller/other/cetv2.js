const charset = require('superagent-charset')
const superagent = charset(require('superagent'))
// const path = require('path')
const cheerio = require('cheerio')
const generate = require('nanoid/generate')
const CetTicket = require('../../models/CetTicket')
// model.id = nanoid()
const { redis } = require('../../utils/redis')


const getRandomIp = () => {
  const arr = []
  for (let i = 0; i < 4; i += 1) {
    arr.push(Math.floor(Math.random() * 255))
  }
  return arr.join('.')
}
const options = {
  encoding: 'utf8',
  headers: {
    Origin: 'http://cet-bm.neea.cn',
    Host: 'cet-bm.neea.cn',
    // 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    Referer: 'http://cet-bm.neea.cn/Home/QueryTestTicket',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36',
    // 客户端的 IP 地址
    'X-Forwarded-For': `${getRandomIp()}`,

    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    // 'Accept-Encoding': 'gzip, deflate',
    // 'Cache-Control': 'no-cache',
    // Connection: 'keep-alive',
    // Pragma: 'no-cache',
    // 'Upgrade-Insecure-Requests': 1,
  },
}

const getInfo = async () => {
  // redis 数据
  const cetInfo = await redis.get('cet_info')
  if (cetInfo) {
    console.log('get cet_info from redis')
    return JSON.parse(cetInfo)
  }

  const url = 'http://cet-bm.neea.cn/Home/QueryTestTicket'
  return new Promise((resolve) => {
    superagent
      .get(url)
      .set(options.headers)
      .end((err, response) => {
        const cookie = response && response.headers['set-cookie'] && response.headers['set-cookie']
        const body = response.text
        const $ = cheerio.load(body)

        const title = $($('#submitDIV').parent().children('div')[0]).text().replace(/\s/g, '')

        const provinces = {}
        $('#selProvince').children('option').each((i, item) => {
          const id = $(item).val()
          const name = $(item).text()
          provinces[id] = name
        })

        redis.set('cet_info', JSON.stringify({
          title,
          provinces,
          cookie,
        }), 'EX', 60 * 60 * 24 * 4)

        resolve({
          title,
          provinces,
          cookie,
        })
      })
  })
}

const getCet = async ({
  id = '',
  name = '',
  provinceCode = '',
  yzm = '',
  cookie,
}) => {
  const url = 'http://cet-bm.neea.cn/Home/ToQueryTestTicket'
  // provinceCode: 23
  // IDTypeCode: 1
  // IDNumber:
  // Name:
  // verificationCode: nyvT
  // console.log(url)
  // const sendData = {
  //   provinceCode: '23',
  //   IDTypeCode: '1',
  //   IDNumber: '',
  //   Name: '',
  //   verificationCode: 'xf0f',
  // }
  const sendData = {
    provinceCode,
    IDTypeCode: '1',
    IDNumber: id,
    Name: name,
    verificationCode: yzm,
  }

  const result = await superagent
    .post(url)
    .set({
      ...options.headers,
      Cookie: cookie,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    })
    .send(sendData)
    .then((response) => {
      const bod = response.text
      // const dataP = JSON.parse(bod)

      return Promise.resolve({
        ...JSON.parse(bod || {}),
      })
    })

  return result
}

const queryTicket = async (ctx) => {
  const {
    id = '',
    name = '',
    provinceCode = '',
    yzm = '',
    cookie,
  } = ctx.query

  const cetData = await getCet({
    id,
    name,
    provinceCode,
    yzm,
    cookie,
  })

  if (cetData.ExceuteResultType !== 1) {
    ctx.body = {
      code: 799, // 验证码失效
      data: cetData,
      status: 200,
    }
    return
  }

  const data = JSON.parse(cetData.Message)

  const uuid = `CET_${generate('ABCDEFGHIJKLMNabcdefghijklmn', 8)}`
  // console.log(uuid)

  const { SubjectName, TestTicket: ticket } = data[0]
  const info = await CetTicket.findOne({
    ticket,
  })

  if (info) {
    ctx.body = {
      code: 200,
      data: {
        uuid: info.uuid,
        subjectName: SubjectName,
      },
      status: 200,
    }
    return
  }

  new CetTicket({
    uuid,
    ticket,
    subjectName: SubjectName,
    name,
    id,
  }).save()

  ctx.body = {
    code: 200,
    data: {
      uuid,
      subjectName: SubjectName,
    },
    status: 200,
  }
}

const getCetCaptchaHandler = async (ctx) => {
  let {
    cookie,
  } = ctx.query

  const info = await getInfo()

  const url = `http://cet-bm.neea.cn/Home/VerifyCodeImg?a=${Math.random()}`

  const result = await new Promise((resolve) => {
    superagent
      .get(url)
      .set({
        ...options.headers,
        Cookie: cookie || '',
      })
      .end(async (err, response) => {
        const buffer = Buffer.from(response.body, 'base64')

        try {
          // cookie = response && (response.headers['set-cookie'].join(';'))
          const a = response.headers['set-cookie'][0].split(';')[0]
          const b = response.headers['set-cookie'][1].split(';')[0]
          // console.log(cookie, '2222')
          cookie = `${a}; ${b}`
        } catch (error) {
          // console.log(error)
        }

        resolve({
          base64: `data:image/png;base64, ${buffer.toString('base64')}`,
          cookie,
        })
      })
  })

  // ASP.NET_SessionId=bdm3amndyyfcvpsojxasbdbl; BIGipServercet_pool=577882122.22016.0000
  // ASP.NET_SessionId=ezqc2z2ljwp2oadpcx315mpv; BIGipServercet_pool=477218826.22016.0000

  // console.log({
  //   ...info,
  //   // cookie,
  //   ...result,
  // }, 'info')
  ctx.body = {
    code: 200,
    data: {
      ...info,
      // cookie,
      ...result,
    },
    status: 200,
  }
}

module.exports = {
  queryTicket,
  getCetCaptchaHandler,
}
