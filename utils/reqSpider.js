/*
    @by：十年之后 592885211@qq.com
    爬虫请求类
    使用免费代理
    逻辑：先不使用代理请求，当爬取拿不到结果或超时切换IP代理
*/
const request = require("request");

const cheerio = require('cheerio');

const delay = require('./delay');


class ReqSpider {
  constructor(option) {
    this.proxy_list = [];
    this.reConnt = 0;
    this.opt = Object.assign({
      method: "GET",
      timeout: 120000,//2Mins
      rejectUnauthorized: false, //不检查证书
      reMax: 15 //只切换15次IP
    }, option);
  }
  run() {
    return new Promise((resolve, reject) => {
      let s = + new Date();
      request(this.opt, async (error, response, body) => {
        let e = + new Date();
        if (error || body.indexOf("502 Bad Gateway") > -1) {  //根据业务情况来判断发现爬取会出现502报错
          await this.set_proxy();
          if (this.reConnt < this.opt.reMax) { //如果超过15次重复爬取，就不在重复，不然任务会一直卡死
            this.reConnt++;
            this.run();
          } else {
            reject(error);
          }
          return
        }
        this.reConnt = 0;
        resolve({ body, timeCon: e - s });
      })
    })
  }
  /*
      @测试代理IP是否可用
  */
  async test_proxy(ip) {
    // console.log(ip)
    return new Promise((resolve, reject) => {

      const req = request.get({
        url: "http://jwzx.hrbust.edu.cn/academic/getCaptcha.do",
        proxy: ip
      }, (err, res) => {
        if (err || res.statusCode !== 200) { resolve(false) };
        // console.log(res)
        resolve(true);
      })

      delay(5000).then(() => {
        // console.log('timeout');
        req.abort();
        resolve(false);
      });
    })
  }
  /*
      @检查代理
  */
  async check_ip() {

    !this.proxy_list.length && (this.proxy_list = await this.get_proxy());

    let s = this.proxy_list.shift();
    let result = await this.test_proxy(s);//true / false 测试IP是否可以使用
    if (result || !this.proxy_list.length) {
      return s || null;
    } else {
      this.check_ip();
    }
  }
  /*
      设置代理
  */
  async set_proxy() {
    let proxy_ip = await this.check_ip();
    if (proxy_ip != undefined) {
      this.opt.proxy = proxy_ip;
      return proxy_ip;
    } else {
      await this.set_proxy();
    }
  }

  /*
      获取代理IP
  */
  get_proxy() {
    //使用了https://www.freeip.top/?page=1 免费代理
    // console.log(1);
    return new Promise((resolve, reject) => {
      request.get({
        url: "http://api.shenlongip.com/ip"
      }, function (e, r, b) {
        // console.log(e, r, b)
        if (e) { return [] };
        var $ = cheerio.load(b);
        let td = $(".ip-tables").find(".layui-table tbody tr");
        let ips = [];
        for (let i = 0; i < td.length; i++) {
          let ip = $(td).eq(i).find("td").eq(0).text() + ":" + $(td).eq(i).find("td").eq(1).text();
          ips.push(ip);
        }
        // console.log(ips);
        resolve(ips);
      })
    })
  }
}

module.exports = ReqSpider;
// const A = new ReqSpider();

// ips.forEach((res) => {
//   console.log(1)
//   A.test_proxy(res.ip + ':' + res.port).then(a => console.log(a))
// })

// // console.log(A.set_proxy());
// A.get_proxy().then((res) => {
//   console.log(res);
// });
