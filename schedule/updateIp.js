const schedule = require('node-schedule')
const request = require('request')
// const redis = require('redis')
const ReqSpider = require('../utils/reqSpider')
const { redis } = require('../utils')
const config = require('../config/config')

// const redisClient = redis.createClient()

// if you'd like to select database 3, instead of 0 (default), call
// client.select(3, function() { /* ... */ });

// redisClient.on('error', (err) => {
//   console.log(`Error${err}`)
// })

// const A = new ReqSpider();

// ips.forEach((res) => {
//   console.log(1)
//   A.test_proxy(res.ip + ':' + res.port).then(a => console.log(a))
// })

// // console.log(A.set_proxy());
// A.get_proxy().then((res) => {
//   console.log(res);
// });

const getIp = () => {
  console.log(`【定时任务】开始更新 ip ${new Date()}`)

  request(config.getIpUrl, async (err, res, body) => {
    // console.log(err, 'err')
    // console.log(JSON.parse(body))
    const ips = JSON.parse(body).map(item => `http://${item.Ip}:${item.Port}`)
    // console.log(ips)
    const A = new ReqSpider()


    ips.forEach((ip) => {
      // console.log(1)
      A.test_proxy(ip).then(async available => {
        if (available) {
          let rIps = await redis.getAsync('proxy_ips')
          // console.log(rIps)
          rIps = JSON.parse(rIps || '{}')

          rIps[ip] = 1
          redis.setAsync('proxy_ips', JSON.stringify(rIps), 'EX', 60 * 20)
        }
      })
    })

    // // console.log(A.set_proxy());
    // A.get_proxy().then((res) => {
    //   console.log(res)
    // })
  })
  // req.destroy()
}

const removeIp = async () => {
  console.log('【定时任务】开始检查 ip 是否生效')
  const rIps1 = await redis.getAsync('proxy_ips')
  const rIps = JSON.parse(rIps1 || '{}')
  // console.log(rIps)
  const rIpsArr = Object.keys(rIps)
  if (rIpsArr.lenght === 0) {
    return
  }

  const A = new ReqSpider()

  let count = 0

  const promise = rIpsArr.map((ip) => {
    return A.test_proxy(ip).then(async available => {
      if (!available) {
        delete rIps[ip]
        count += 1
      }
    })
  })

  Promise.all(promise).then(() => {
    console.log(`【定时任务】已删除${count}条过期 ip`)
    if (count > 0) {
      redis.setAsync('proxy_ips', JSON.stringify(rIps), 'EX', 60 * 20)
    }
  })
}
const scheduleAddIp = () => {
  // 每分钟的第30秒定时执行一次:
  getIp()
  schedule.scheduleJob('0 */5 * * * *', () => {
    // console.log(`scheduleCronstyle:${new Date()}`)
    getIp()
  })
}

const scheduleRemoveIp = () => {
  schedule.scheduleJob('0 */1 * * * *', () => {
    // console.log(`scheduleCronstyle:${new Date()}`)
    removeIp()
  })
}


module.exports = {
  scheduleAddIp,
  scheduleRemoveIp,
}
