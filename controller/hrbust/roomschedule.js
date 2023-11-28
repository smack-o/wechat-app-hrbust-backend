const superagent = require('superagent')
const cheerio = require('cheerio')
const { redis } = require('../../utils/redis')

const {
  requestHeader,
  checkLogin,
  url,
} = require('../../utils/hrbust')


// http://jwzx.hrbust.edu.cn/academic/teacher/teachresource/roomschedulequery.jsdo?groupId=&moduleId=1070&randomString=20191104190632RdiDfW
const roomschedulequery = async (ctx) => {
  const isLogin = await checkLogin(ctx)
  if (!isLogin) return

  let cookie = ctx.session.hrbustCookie

  const reqData = {
    aid: -1,
    buildingid: -1,
    room: -1,
    whichweek: -1,
    week: 1,
    ...ctx.query,
  }

  const roomQueryKey = `queryroom_${[reqData.aid, reqData.buildingid, reqData.room].join('_')}`

  // redis 数据
  const resultRedis = await redis.get(roomQueryKey)

  if (resultRedis) {
    ctx.body = {
      data: JSON.parse(resultRedis),
      status: 200,
    }
    return
  }

  const response = await superagent
    .post(url.roomschedulequery)
    .charset()
    .send(reqData)
    .set(requestHeader)
    .set('Cookie', cookie)
  const body = response.text
  const $ = cheerio.load(body)

  const result = {
    aids: [],
    buildingids: [],
    rooms: [],
    whichweeks: [],
    weeks: [],
  }

  Object.keys(result).forEach(key => {
    $(`select[name=${key.substr(0, key.length - 1)}]`).children('option').each((i, item) => {
      const text = $(item).text()
      if (text !== '请选择') {
        result[key].push({
          id: $(item).attr('value'),
          label: text,
        })
      }
    })
  })

  // 写入 redis
  redis.set(roomQueryKey, JSON.stringify(result), 'EX', 60 * 60 * 24 * 5)

  ctx.body = {
    data: result,
    status: 200,
  }
}


// 获取成绩
const roomschedule = async (ctx) => {
  const isLogin = await checkLogin(ctx)
  if (!isLogin) return

  let cookie = ctx.session.hrbustCookie
  // const {
  //   aid = 353,
  //   buildingid = 584,
  //   room = 638,
  //   whichweek = 10,
  //   week = 1,
  // } = ctx.query
  const reqData = {
    aid: -1,
    buildingid: -1,
    room: -1,
    whichweek: -1,
    week: -1,
    ...ctx.query,
  }

  const roomScheduleKey = `roomschedule_${Object.values(reqData).join('_')}`

  // redis 数据
  const resultRedis = await redis.get(roomScheduleKey)

  if (resultRedis) {
    ctx.body = {
      data: JSON.parse(resultRedis),
      status: 200,
    }
    return
  }

  const response = await superagent
    .post(url.roomschedule_url)
    .charset()
    .send({
      room: -1,
      ...ctx.query,
    })
    .set(requestHeader)
    .set('Cookie', cookie)

  const body = response.text
  const $ = cheerio.load(body)

  const resultKeys = ['room', 'seatAmount', 'courseAmount', 'examAmount', '', 'roomType', 'infoList']
  const result = {
    list: [],
  }

  $('.infolist_common').each((infoI, info) => {
    const roomInfo = {
      infoList: [0, 0, 0, 0, 0],
    }
    $(info).children('td').each((itemI, item) => {
      if ($(item).attr('id') === 'roomid343') {
        // 教室占用情况
        $($(item).find('tr')[1]).children('td').each((roomItemI, roomItem) => {
          const fontDom = $(roomItem).find('font')
          let type = 0 // 无占用
          // console.log(roomItemI)
          if (fontDom) {
            const color = $(fontDom).attr('color')
            switch (color) {
              case '#FF0000':
                type = 1 // 课程
                break
              case '#FF6600':
                type = 2 // 课程考试
                break
              case '#006600':
                type = 3 // 其它
                break
              default:
                type = 0
                break
            }
            roomInfo.infoList[parseInt(roomItemI / 2)] = type
          }
        })
      } else if (resultKeys[itemI]) {
        // 教室其它信息
        roomInfo[resultKeys[itemI]] = $(item).text()
      }
    })
    result.list.push(roomInfo)
  })

  // 写入 redis
  redis.set(roomScheduleKey, JSON.stringify(result), 'EX', 60 * 60 * 24 * 2)

  ctx.body = {
    data: result,
    status: 200,
  }
}

module.exports = {
  roomschedule,
  roomschedulequery,
}
