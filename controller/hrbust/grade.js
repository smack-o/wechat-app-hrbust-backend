const cheerio = require('cheerio')
const executingQueue = require('../../utils/superagent')
const {
  requestHeader,
  checkLogin,
  url,
} = require('../../utils/hrbust')

// 获取成绩
const getGrade = async (ctx) => {
  const isLogin = await checkLogin(ctx, {
    // autoCaptcha: true,
  })
  if (!isLogin) return

  // let username = ctx.session.username
  // if (!username) {
  //   ctx.throw(400, '未登陆')
  // }

  let cookie = ctx.session.hrbustCookie
  const { year, term } = ctx.query

  const response = await executingQueue((superagent, ip) => superagent
    .post(url.grade_url)
    .proxy(ip)
    .charset()
    .send({
      year,
      term,
      para: 0,
    })
    .set(requestHeader)
    .set('Cookie', cookie))
  // console.log(response)
  const body = response.text
  const $ = cheerio.load(body)

  // 需要教学评估
  const pingGuText = $('#content_margin').text().replace(/\s/g, '')
  if (pingGuText.indexOf('参加评教') >= 0) {
    ctx.throw(400, pingGuText)
    return
  }

  const datalist = $('.datalist').find('tr')
  const result = {}
  result.grades = []
  result.gradeTerm = $('option:selected').text().replace(/\s/g, '')

  const GRADE = {
    优: 95,
    优秀: 95,
    良: 85,
    良好: 85,
    中: 75,
    中等: 75,
    及格: 65,
    差: 0,
    不及格: 0,
  }

  // let gradeLength = 0;
  let gradeSum = 0
  let GPA_SUM = 0
  let XUE_FEN_SUM = 0
  let OBLIGATORY_GPA_SUM = 0
  let OBLIGATORY_FEN_SUM = 0

  datalist.each((index, item) => {
    if (index === 0) {
      return
    }
    const innerItems = $(item).find('td')
    const innerTexts = []
    innerItems.each((indexI, itemI) => {
      const str = $(itemI).text().replace(/\s/g, '')
      innerTexts.push(str)
    })

    const grade = Number(innerTexts[6])
    const xuefen = Number(innerTexts[7])
    let GPA = ''
    if (xuefen > 0 && innerTexts[11] !== '重考') {
      if (innerTexts[12] === '不及格') {
        GPA = '0.0'
      } else if (!Number.isNaN(grade)) {
        GPA = grade < 60 ? 0 : ((grade - 60) / 10) + 1
        GPA = GPA.toFixed(1)
        gradeSum += grade * xuefen
      } else {
        const cGrade = GRADE[innerTexts[6]]
        GPA = ((cGrade - 60) / 10) + 1
        gradeSum += cGrade * xuefen
      }
      GPA_SUM += xuefen * Number(GPA)
      XUE_FEN_SUM += xuefen
      if (innerTexts[9] === '必修') {
        // 必修
        OBLIGATORY_GPA_SUM += xuefen * Number(GPA)
        OBLIGATORY_FEN_SUM += xuefen
      }
    }
    innerTexts.push(GPA)
    // 学年学期 课程号  课程名  课序号  课组  总评  学分  学时  选课属性  备注  考试性质  及格标志 gpa
    const gradeNames = ['year', 'term', 'courseId', 'courseName', 'courseIndex', 'courseGroup', 'grade', 'credit', 'courseMount', 'courseAttribute', 'courseRemark', 'courseCharacter', 'passFlag', 'gpa']
    result.grades.push(innerTexts.reduce((pre, innerText, i) => {
      pre[gradeNames[i]] = innerText
      return pre
    }, {}))
  })

  // GPA
  const AVERAGE_GPA = GPA_SUM / XUE_FEN_SUM

  // 去选修 GPA
  const OBLIGATORY_AVERAGE_GPA = OBLIGATORY_GPA_SUM / OBLIGATORY_FEN_SUM
  // 加权平均分
  const AVERAGE_GRADE = gradeSum / XUE_FEN_SUM
  result.AVERAGE_GPA = AVERAGE_GPA.toFixed(2)
  result.AVERAGE_GRADE = AVERAGE_GRADE.toFixed(2)
  result.OBLIGATORY_AVERAGE_GPA = OBLIGATORY_AVERAGE_GPA.toFixed(2)

  ctx.body = {
    data: result,
    status: 200,
  }
}

module.exports = {
  getGrade,
}
