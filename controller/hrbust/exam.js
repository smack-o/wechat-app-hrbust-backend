
const cheerio = require('cheerio')
const moment = require('moment')
const executingQueue = require('../../utils/superagent')
const {
  requestHeader,
  checkLogin,
  url,
} = require('../../utils/hrbust')

moment.locale('zh-cn', {
  meridiem: (hour, minute) => {
    if (hour < 9) {
      return '早上'
    } if (hour < 11 && minute < 30) {
      return '上午'
    } if (hour < 13 && minute < 30) {
      return '中午'
    } if (hour < 18) {
      return '下午'
    }
    return '晚上'
  },
})

// 爬教务在线，更新课表、创建新课表
const getExam = async (ctx) => {
  const isLogin = await checkLogin(ctx, {
    // autoCaptcha: true,
  })
  if (!isLogin) return

  // let username = ctx.session.username
  // if (!username) {
  //   ctx.throw(400, '未登陆')
  // }

  let cookie = ctx.session.hrbustCookie
  const { page = 1 } = ctx.query
  const curl = `${url.exam_url}?pagingPageVLID=${page || 1}&pagingNumberPerVLID=10&sortDirectionVLID=-1&sortColumnVLID=s.examRoom.exam.endTime&`

  const response = await executingQueue((superagent, ip) => superagent
    .post(curl)
    .proxy(ip)
    .charset()
    .set(requestHeader)
    .set('Cookie', cookie))

  const body = response.text
  const $ = cheerio.load(body)
  const datalist = $('.datalist').find('tr')
  const list = []

  const allPageCount = $('.classicLookSummary').find('b').eq(2).text()
  if (parseInt(page) <= parseInt(allPageCount)) {
    datalist.each((index, item) => {
      if (index === 0) {
        return
      }
      const innerItems = $(item).find('td')
      const time = innerItems.eq(2).text()
      const startTime = moment(time.split('--')[0])
      const nowTime = moment()
      // const calendar = startTime.week() === nowTime.week()
      //   ? startTime.subtract().calendar().replace('下', '本')
      //   : startTime.subtract().calendar()
      const endOf = startTime.endOf('minute').fromNow().replace('内', '后')
      list.push({
        course: innerItems.eq(1).text(),
        time: `${startTime.format('A')} ${time.split(' ')[1].split('--').join('~')}`,
        date: startTime.format('YYYY年MM月DD日'),
        dateExtend: nowTime > startTime ? '已结束' : endOf,
        position: innerItems.eq(3).text(),
        info: innerItems.eq(4).text(),
        ending: nowTime > startTime ? 1 : 0,
      })
    })
  }

  ctx.body = {
    data: list,
    status: 200,
  }
}

module.exports = {
  getExam,
}
