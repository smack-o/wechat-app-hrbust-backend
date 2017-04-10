const SimulateLogin = require('./util/simulateLogin');
const cheerio = require('cheerio');
const charset = require('superagent-charset');
const superagent = charset(require('superagent'));

// 浏览器请求报文头部部分信息
const browserMsg = {
  'Accept-Encoding': 'gzip, deflate',
  Origin: 'http://jwzx.hrbust.edu.cn',
  'Content-Type': 'application/x-www-form-urlencoded',
};


function getUserName(params) {
  // 测试账号数据
  if (params.username === '1234' && params.password === '1234') {
    params.callback({
      name: '大一第一次四级就考了理工最高分————胡雨珊',
    });
    return;
  }

  const SimulateLoginParams = {
    username: params.username,
    password: params.password,
    simulateIp: params.simulateIp,
    yourCookie: params.yourCookie,
  };
  const simulateLogin = new SimulateLogin();
  simulateLogin.init(SimulateLoginParams).then((result) => {
    if (result.error) {
      params.callback({
        error: result.error,
      });
    } else {
      superagent
        .get('http://jwzx.hrbust.edu.cn/academic/showHeader.do')
        .charset()
        .set(browserMsg)
        .set('Cookie', result.cookie)
        .redirects(0)
        .end((error, response) => {
          if (error) {
            params.callback({
              error,
            });
          } else {
            const body = response.text;
            const $ = cheerio.load(body);
            const results = $('#greeting span').text();
            params.callback({
              name: results,
            });
          }
        });
    }
  });
}

exports.getUserName = getUserName;
