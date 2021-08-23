const crypto = require('crypto')
const superagent = require('superagent')
const cheerio = require('cheerio')
const executingQueue = require('../../utils/superagent')
const to = require('../../utils/awaitErrorCatch')
const Students = require('../../models/Students')
const Course = require('../../models/Course')
const TermCourse = require('../../models/TermCourse')

const {
  // SimulateLogin,
  requestHeader,
  url,
  checkLogin,
} = require('../../utils/hrbust')

function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex')
}

const getPeriod = (startWeek, endWeek, weekType = 0, normalWeekArray) => {
  let period = {}
  if (normalWeekArray) {
    normalWeekArray.forEach((item) => {
      period[item] = 1
    })
  }
  switch (weekType) {
    case 0:
      for (let i = startWeek; i <= endWeek; i++) {
        period[i] = 1
      }
      break
    case 1:
      for (let i = startWeek; i <= endWeek; i++) {
        if (i % 2 === 1) {
          period[i] = 1
        }
      }
      break
    case 2:
      for (let i = startWeek; i <= endWeek; i++) {
        if (i % 2 === 0) {
          period[i] = 1
        }
      }
      break
    default:
      break
  }
  return period
}

// 获取学生id，获取课程表的时候需要用到
const getStudentId = cookie => executingQueue(() => superagent
  .get(url.studentId)
  .charset()
  .set(requestHeader)
  .set('Cookie', cookie))
  .then(response => {
    const body = response.text
    const $ = cheerio.load(body)
    const str = $('.button')[0].attribs.onclick
    const id = str.match(/id=(\S*)&yearid/) ? str.match(/id=(\S*)&yearid/)[1] : 0
    const getCourseUrl = `http://jwzx.hrbust.edu.cn/academic/manager/coursearrange/showTimetable.do?id=${id}&timetableType=STUDENT&sectionType=COMBINE`
    return getCourseUrl
  })

// 查库，获取当前课表
const getCourse = async (ctx) => {
  let username = ctx.session.username
  if (!username) {
    ctx.throw(400, '未登陆')
  }
  const { term } = ctx.query
  // 获取某学期课表在TermCourse表中的映射
  const [errorStu, { courseMap }] = await to(Students.findOne({ username }))
  if (errorStu) ctx.throw(400, errorStu)

  const termCourseId = courseMap[term]
  const [errorTerm, selectResult] = await to(TermCourse.findOne({ id: termCourseId }))
  if (errorTerm) ctx.throw(400, errorTerm)

  const course = selectResult ? selectResult.course : null
  const courseTermId = selectResult ? selectResult.term : 0
  const unplanCourse = selectResult ? selectResult.unplanCourse : null

  ctx.body = {
    data: {
      course,
      courseTermId,
      unplanCourse,
    },
    status: 200,
  }
}

// 查库，获取已创建课表的学期
const getHasCourseTerms = async (ctx) => {
  let username = ctx.session.username
  if (!username) {
    ctx.throw(400, '未登陆')
  }
  const [errorStu, { courseMap }] = await to(Students.findOne({ username }))
  if (errorStu) ctx.throw(400, errorStu)

  // 返回结果
  // {
  //     "0": { // 大一
  //         "first": 1, // 第一学期课表存在
  //         "second": 1 // 第二学期课表存在
  //     },
  //     "1": { // 大二
  //         "first": 1 // // 第二学期课表存在
  //     }
  // }
  const result = {}
  Object.keys(courseMap.toObject()).forEach((termNum) => {
    const key = parseInt(termNum / 2)
    const tremid = termNum % 2 ? 'second' : 'first'
    if (!result[key]) {
      result[key] = {}
      result[key][tremid] = 1
    } else {
      result[key][tremid] = 1
    }
  })

  ctx.body = {
    data: result,
    status: 200,
  }
}

// 爬教务在线，更新课表、创建新课表
const updateCourse = async (ctx) => {
  let username = ctx.session.username
  if (!username) {
    ctx.throw(400, '未登陆')
  }

  const isLogin = await checkLogin(ctx, {
    // autoCaptcha: true,
  })
  if (!isLogin) return


  let cookie = ctx.session.hrbustCookie
  let { term } = ctx.query

  let { grade } = await Students.findOne({ username })

  if (!grade) {
    grade = parseInt(username.substr(0, 2))
  }
  let yearid = grade + 20 + Math.ceil(term / 2)
  let termid = (term % 2) ? 1 : 2
  // const simulateLogin = new SimulateLogin({
  //   username,
  //   password,
  //   cookie,
  //   autoCaptcha: true,
  // })
  // const [errorLogin, loginResult] = await to(simulateLogin.login())
  // if (errorLogin) ctx.throw(400, errorLogin)
  // cookie = loginResult.cookie

  const getCourseUrl = await getStudentId(cookie)
  let response = await executingQueue(() => superagent
    .get(`${getCourseUrl}&termid=${termid}&yearid=${yearid}`)
    .charset()
    .set(requestHeader)
    .set('Cookie', cookie))

  let body = response.text
  let $ = cheerio.load(body, { decodeEntities: false })

  const currentGradeStr = $('.content table tr').eq(1).text()

  let currentGrade = currentGradeStr.split('-')[0].substr(-2)
  // eslint-disable-next-line
  if (isNaN(parseInt(currentGrade))) { // 留学生班级情况
    currentGrade = currentGradeStr.replace(/[^0-9]/ig, '')
  }

  await Students.findOneAndUpdate({ username }, {
    grade: currentGrade,
  })

  if (currentGrade !== grade) {
    let currentTerm = term - ((currentGrade - grade) * 2)
    term = currentTerm
    yearid = parseInt(currentGrade) + 20 + Math.ceil(currentTerm / 2)

    response = await executingQueue(() => superagent
      .get(`${getCourseUrl}&termid=${termid}&yearid=${yearid}`)
      .charset()
      .set(requestHeader)
      .set('Cookie', cookie))

    body = response.text
    $ = cheerio.load(body, { decodeEntities: false })
  }

  const lessonList = []
  const lessonListUnplan = []

  $('#timetable tr') && $('#timetable tr').each((i, e) => {
    if (i === 0) {
      // 表格的第0行是周数
      return
    }
    // 小节课的开始数与结束数
    const sectionstart = i * 2 - 1
    const sectionend = i * 2

    // const course = []
    $(e).children('td') && $(e).children('td').each((j, ele) => {
      if ($(ele).html() === '&nbsp;') {
        // course.push(null)
      } else {
        let html = $(ele).html()
        // html = html.replace(/(\s)|(&lt;)|(&gt;)|(;.)|(<<)|(>>)|(一下午<br>)|(一上午<br>)/g, '')

        // 拆分课表方式变更，使用破折号区分课程，每个课表标题都是 << *** >>
        let splitArr = html.split('<<')
        splitArr.shift()

        if (splitArr.length === 0 || !splitArr[0]) {
          // 没有课
          return
        }

        splitArr.forEach((item) => {
          const innerHtml = item.replace(/(\s)|(&lt;)|(&gt;)|(;.)|(<<)|(>>)|(一下午<br>)|(一上午<br>)/g, '')
          let arr = innerHtml.split('<br>')

          // 没有安排上课时间的课程
          if (!arr[4] && /周/.test(arr[2])) {
            arr = [arr[0], '暂无教室安排', ...arr.slice(1, arr.length - 1)]
          }

          const course = {}
          const week = arr[3]

          // 课表有六种情况
          // normal  1-12周
          // single 1-15单周
          // double 1-6双周
          // one 第一周
          // sub 1-7,8-10
          // 剩下一种 5,8,9-17
          const regNormalWeek = /(\w*)\-(\w*)周/
          const regSingleWeek = /(\w*)\-(\w*)单周/
          const regDoubleWeek = /(\w*)\-(\w*)双周/
          const regOneWeek = /第(\w*)周/
          const regSubWeek = /(\w*)\-(\w*),(\w*)\-(\w*)/

          let periodObj = {}
          if (regOneWeek.test(week)) {
            periodObj[week.match(regOneWeek)[1]] = 1
          } else if (regNormalWeek.test(week)) {
            const matchResult = week.match(regNormalWeek)
            const startWeek = parseInt(matchResult[1])
            const endWeek = parseInt(matchResult[2])
            periodObj = getPeriod(startWeek, endWeek, 0)
          } else if (regSingleWeek.test(week)) {
            const matchResult = week.match(regSingleWeek)
            const startWeek = parseInt(matchResult[1])
            const endWeek = parseInt(matchResult[2])
            periodObj = getPeriod(startWeek, endWeek, 1)
          } else if (regDoubleWeek.test(week)) {
            const matchResult = week.match(regDoubleWeek)
            const startWeek = parseInt(matchResult[1])
            const endWeek = parseInt(matchResult[2])
            periodObj = getPeriod(startWeek, endWeek, 2)
          } else if (regSubWeek.test(week)) {
            const matchResult = week.match(regSubWeek)
            const firstStartWeek = parseInt(matchResult[1])
            const firstEndWeek = parseInt(matchResult[2])
            const secondStartWeek = parseInt(matchResult[3])
            const secondEndWeek = parseInt(matchResult[4])
            let firstPeriodObj = getPeriod(firstStartWeek, firstEndWeek, 0)
            let secondPeriodObj = getPeriod(secondStartWeek, secondEndWeek, 0)
            periodObj = Object.assign({}, firstPeriodObj, secondPeriodObj)
          } else {
            const normalWeekArray = week.split(',')
            const startEndArray = normalWeekArray.pop().split('-')
            const startWeek = parseInt(startEndArray[0])
            const endWeek = parseInt(startEndArray[1])
            periodObj = getPeriod(startWeek, endWeek, 0, normalWeekArray)
          }

          course.name = arr[0]
          course.locale = arr[1]
          course.teacher = arr[2]
          course.messege = arr[4]
          course.sectionstart = sectionstart
          course.sectionend = sectionend
          course.period = periodObj
          course.week = week
          course.day = j + 1

          course.courseId = md5(course.name + course.teacher)
          course.uniqueId = md5(course.name + course.teacher + course.day)

          lessonList.push(course)
        })
      }
    })
  })

  $('#noArrangement tr') && $('#noArrangement tr').each((i, e) => {
    if (i === 0) return
    let unplanCourse = {
      courseName: $($(e).children('td')[1]).text().replace(/(\s+)|(javascript(.*);)|(&nbsp;)/g, ''),
      courseTeacher: $($(e).children('td')[3]).text().replace(/(\s+)|(javascript(.*);)|(&nbsp;)/g, ''),
      courseAllClass: $($(e).children('td')[4]).text().replace(/(\s+)|(javascript(.*);)|(&nbsp;)/g, ''),
      coursePeriod: $($(e).children('td')[5]).text().replace(/(\s+)|(javascript(.*);)|(&nbsp;)/g, ''),
      courseWeek: $($(e).children('td')[6]).text().replace(/(\s+)|(javascript(.*);)|(&nbsp;)/g, ''),
      courseLocale: $($(e).children('td')[7]).text().replace(/(\s+)|(javascript(.*);)|(&nbsp;)/g, ''),
    }

    lessonListUnplan.push(unplanCourse)
  })

  if (lessonList.length === 0 && lessonListUnplan.length === 0) {
    ctx.body = {
      data: '当前学期课表为空',
      status: 404,
    }
    return
  }

  for (const lessonItem of lessonList) {
    const name = lessonItem.name
    const teacher = lessonItem.teacher
    const selectResult = await Course.find({ name, teacher })
    if (selectResult.length !== 0) {
      lessonItem.courseId = selectResult[0].courseId
    }
    try {
      await new Course(lessonItem).save()
    } catch (e) {
      // 重复数据，略过
    }
  }


  const termCourseId = parseInt(username + term)

  await TermCourse.findOneAndUpdate({
    id: termCourseId,
  }, {
    id: termCourseId,
    term,
    course: lessonList,
    unplanCourse: lessonListUnplan,
  }, {
    upsert: true,
  })

  const key = `courseMap.${term}`
  let updateData = {}
  updateData[key] = termCourseId
  await Students.update({ username }, updateData)

  ctx.body = {
    data: '创建新学期课表成功',
    status: 200,
  }
}

module.exports = {
  getCourse,
  getHasCourseTerms,
  updateCourse,
}
