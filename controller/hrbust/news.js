const superagent = require('superagent')
const cheerio = require('cheerio')
const executingQueue = require('../../utils/superagent')

const {
  requestHeader,
  url,
} = require('../../utils/hrbust')

// 获取成绩
const getNews = async (ctx) => {
  const pageNum = ctx.query.page || 1
  const cUrl = `${url.news_url}&pagingPage=${pageNum}`
  const response = await executingQueue(() => superagent
    .get(cUrl)
    .charset()
    .set(requestHeader))

  const body = response.text
  const $ = cheerio.load(body)
  const list = []
  $('.articleList li').each((index, item) => {
    const href = $(item).find('a').attr('href')
    const title = $(item).find('a').text().replace(/\s/g, '')
    const id = parseInt(href.match(/articleId=(\S*)&/)[1])
    const date = $(item).find('span').text()
    // 是否置顶
    const top = $(item).find('img').attr('title') === '置顶'
    list.push({
      title,
      id,
      date,
      top,
      href,
    })
  })
  ctx.body = {
    data: list,
    status: 200,
  }
}

const getNewsDetail = async (ctx) => {
  const id = ctx.params.id
  const cUrl = `${url.news_detail_url}articleId=${id}&columnId=354`
  const response = await superagent
    .get(cUrl)
    .charset()
    .set(requestHeader)

  const body = response.text
  const $ = cheerio.load(body)
  $('hr').remove()
  $('*').removeAttr('style')
  const dom = $('#article').html()

  await ctx.render('hrbust_news', {
    title: '教务公告',
    content: dom,
  })
}


module.exports = {
  getNews,
  getNewsDetail,
}
