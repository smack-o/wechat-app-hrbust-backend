const superagent = require('superagent')
require('superagent-proxy')(superagent);
// const ips = [{ "ip": "1.62.160.56", "port": 57627 }, { "ip": "1.59.172.184", "port": 39577 }, { "ip": "1.62.151.58", "port": 29701 }, { "ip": "221.210.31.239", "port": 51630 }, { "ip": "221.208.39.3", "port": 50964 }, { "ip": "122.159.109.73", "port": 45147 }, { "ip": "122.159.97.121", "port": 41039 }];

// class reqSpider {
//   constructor(option) {
//     this.proxy_list = [];
//     this.reConnt = 0;
//     this.opt = Object.assign({
//       method: "GET",
//       timeout: 120000,//2Mins
//       rejectUnauthorized: false, //不检查证书
//       reMax: 15 //只切换15次IP
//     }, option);
//   }

//   run() {
//     return new Promise((resolve, reject) => {
//       let s = + new Date();
//       request(this.opt, async (error, response, body) => {
//         let e = + new Date();
//         if (error || body.indexOf("502 Bad Gateway") > -1) {  //根据业务情况来判断发现爬取会出现502报错
//           await this.set_proxy();
//           if (this.reConnt < this.opt.reMax) { //如果超过15次重复爬取，就不在重复，不然任务会一直卡死
//             this.reConnt++;
//             this.run();
//           } else {
//             reject(error);
//           }
//           return
//         }
//         this.reConnt = 0;
//         resolve({ body, timeCon: e - s });
//       })
//     })
//   }
//   /*
//       @测试代理IP是否可用
//   */
//   test_proxy(ip) {
//     console.log(ip, 'ip')
//     return new Promise((resolve, reject) => {
//       console.log('start');
//       request.get("https://www.baidu.com").proxy("http://" + ip).end((err, res, body) => {
//         console.log(res.body, '--------')
//         if (err) { resolve(false) };
//         resolve(true);
//       })
//     })
//   }

//   /*
//       @检查代理
//   */
//   async check_ip() {

//     !this.proxy_list.length && (this.proxy_list = await this.get_proxy());

//     let s = this.proxy_list.shift();
//     let result = await this.test_proxy(s);//true / false 测试IP是否可以使用
//     if (result || !this.proxy_list.length) {
//       return s || null;
//     } else {
//       this.check_ip();
//     }
//   }
//   /*
//       设置代理
//   */
//   async set_proxy() {
//     let proxy_ip = await this.check_ip();
//     if (proxy_ip != undefined) {
//       this.opt.proxy = proxy_ip;
//       return proxy_ip;
//     } else {
//       await this.set_proxy();
//     }
//   }

//   /*
//       获取代理IP
//   */
//   get_proxy() {
//     //使用了https://www.freeip.top/?page=1 免费代理
//     return new Promise((resolve, reject) => {
//       request.get({
//         url: "http://api.shenlongip.com/ip"
//       }, function (e, r, b) {
//         console.log(e, r, b)
//         if (e) { return [] };
//         var $ = cheerio.load(b);
//         let td = $(".ip-tables").find(".layui-table tbody tr");
//         let ips = [];
//         for (let i = 0; i < td.length; i++) {
//           let ip = $(td).eq(i).find("td").eq(0).text() + ":" + $(td).eq(i).find("td").eq(1).text();
//           ips.push(ip);
//         }
//         console.log(ips);
//         resolve(ips);
//       })
//     })
//   }
// }

// const A = new reqSpider();
// ips.forEach((res) => {
//   A.test_proxy(res.ip + ':' + res.port).then((r) => {
//     console.log(r, '==============')
//   })
// })

// request.get("https://www.baidu.com").end((err, res, body) => {
//   console.log(err, res.body, body, '--------')
// })
async function fn() {
  let response = await superagent
    .get("http://jwzx.hrbust.edu.cn/homepage/index.do")
    // .proxy("http://101.200.127.149:3129");
    .proxy("http://112.195.242.233:3256")
  // .charset()
  console.log(response)
  return response

}

fn()
// const getIp = () => {

// }

// const getSuperagent = () => {
//   return (...args) => {
//     const proxy = getIp();
//     return request(...args).proxy(proxy);
//   }
// }


