// const { wxLogin, updateUserInfo, getUserInfo } = require('../controller/user/wx-login')
const PddClient = require('duoduoke-node-sdk')
const config = require('../../config/config')
const ShopKeywords = require('../../models/ShopKeywords')

const client = new PddClient({
  clientId: config.pdd.clientId,
  clientSecret: config.pdd.clientSecret,
  // endpoint: 'pinduoduo open endpoint', // 默认为 http://gw-api.pinduoduo.com/api/router
})

const UID = 111
const PID = '9924289_189860448'

const search = async (ctx) => {
  const {
    keyword = '寝室神器',
    page = 1,
    page_size = 20,
    sort_type = 0,
    with_coupon = false,
    // flatform = '',
  } = ctx.query

  const beiAnRes = await client.execute('pdd.ddk.member.authority.query', {
    pid: PID,
    custom_parameters: JSON.stringify({ uid: UID }),
  })

  if (beiAnRes.authority_query_response.bind === 0) {
    const r = await client.execute('pdd.ddk.rp.prom.url.generate', {
      // pid: PID,
      custom_parameters: JSON.stringify({ uid: UID }),
      p_id_list: [PID],
      channel_type: 10,
      generate_we_app: true,
    })
    console.log(r.rp_promotion_url_generate_response.url_list)
  }

  const res = await client.execute('pdd.ddk.goods.search', {
    keyword,
    page,
    page_size,
    sort_type,
    with_coupon,
    pid: PID,
    custom_parameters: JSON.stringify({ uid: UID }),
    // custom_parameters: JSON.stringify({ new: 1 }),
    ...ctx.query,
  })

  // 记录 keywords
  await ShopKeywords.findOneAndUpdate({ keyword }, {
    keyword,
    $inc: { count: 1 },
  }, {
    upsert: true,
  })

  // console.log(keyword, page, res.goods_list)

  // const goods_id_list = res.goods_list.map((good) => good.goods_id)
  // const goods_sign_list = res.goods_list.map((good) => good.goods_sign)

  // TODO 后续有商品详情之后，此接口需要移出，有性能问题
  // const gRes = await client.execute('pdd.ddk.goods.promotion.url.generate', {
  //   // goods_id_list,
  //   goods_sign_list,
  //   p_id: PID,
  //   generate_we_app: true,
  //   search_id: res.search_id,
  // }).then((r) => {
  //   // 测试延迟 code
  //   console.log(r.client, 'res')
  //   return r
  // })

  ctx.body = {
    data: res.goods_list.map((good) => {
      return ({
        ...good,
        // ...(gRes.goods_promotion_url_list[index] || {}),
      })
    }),
    status: 200,
  }
}

const generateGoods = async (ctx) => {
  const {
    goods_sign,
    search_id,
  } = ctx.query

  //  TODO 后续有商品详情之后，此接口需要移出，有性能问题
  const gRes = await client.execute('pdd.ddk.goods.promotion.url.generate', {
    // goods_id_list,
    goods_sign_list: [goods_sign],
    p_id: PID,
    custom_parameters: JSON.stringify({ uid: UID }),
    generate_we_app: true,
    search_id,
  }).then((r) => {
    // 测试延迟 code
    return r
  })

  ctx.body = {
    data: gRes.goods_promotion_url_list[0] || {},
    status: 200,
  }
}

const keywords = async (ctx) => {
  ctx.body = {
    data: ['寝室神器', '毛巾', '壁纸', '衣架', '寝室灯', '洗发水', '纸巾'],
    status: 200,
  }
}

const channels = [{
  title: '宿舍用低功率吹风机',
  goods_sign_list: ['E9L2jYmd7CFO-oLxwvbbahHH9IsL333L_JQgHVYSloN', 'E9r25aeClCZO-oLxwvbbahANO1Qs5mMy_JQzHKUKlL3', 'E9_26vwrsGFO-oLxwvbbakWrL-NPbxYy_J2RgZ3sQj', 'E9v284rm631O-oLxwvbbatAL3lUR90q__JiBcy2Wza'],
}, {
  title: '酷毙灯/小夜灯',
  goods_sign_list: ['E9D2imLDQcZO-oLxwvbbau3J94W5FlKq_JwPRqPqay', 'E9D2l9d_O_FO-oLxwvbbaqk0seiajIPz_JQT9u5nxgO', 'E9T2nVvcRuZO-oLxwvbbav_D4MxctReT_JQ4xFonvCd', 'E932vbA96_FO-oLxwvbbaofSL78PsoYf_JQw89TlKil', 'E9D2_3MNUp5O-oLxwvbbatEReUX3qgI8_JYIAYGVgL', 'E9j2-jAC3eFO-oLxwvbbanxmcaGhHtlS_JQq1Tk4Tdl'],
}, {
  title: '寝室壁纸海报',
  goods_sign_list: ['E9L2gfWu6mdO-oLxwvbbavFIKgzg0wwx_JQFDalKRMT', 'E9H25OxhPbRO-oLxwvbbaoisCySjRQqF_JxmM1qrAC', 'E9D25_qdLI1O-oLxwvbbapoy_--d9gUJ_Jv0PR0i3X', 'c9r2uKjUYg1O-oLxwvbYuzqP2yYq_JiEzh2kbB', 'c9L2hX1FCHZO-oLxwvbYu-z3LoRn_JQQ4Ulngx2', 'c972iftxDa5O-oLxwvbYu6YVKEai_JOz2AM7Mo'],
}]


const channel = async (ctx) => {
  const promises = channels.map(async (item) => {
    const res = await client.execute('pdd.ddk.goods.search', {
      goods_sign_list: item.goods_sign_list,
      pid: PID,
      page: 1,
      page_size: 10,
      // custom_parameters: JSON.stringify({ uid: 111 }),
      // sort_type,
      // with_coupon,
      // custom_parameters: JSON.stringify({ new: 1 }),
    })
    return res
  })

  const res = await Promise.all(promises).then((results) => {
    return results.map((result, index) => ({
      title: channels[index].title,
      goods_list: result.goods_list,
    }))
    // data.push()
  })

  ctx.body = {
    data: res,
    status: 200,
  }
}


// const test = async () => {
//   const res = await client.execute('pdd.ddk.goods.search', {
//     // keyword: 'https://p.pinduoduo.com/ykXclQu6',
//     goods_sign_list: ['c9f2hBzZgshO-oLxwvbYu2IcGe03_J4rj9CVCu'],
//     pid: PID,
//     page: 1,
//     page_size: 10,
//     // sort_type,
//     // with_coupon,
//     // custom_parameters: JSON.stringify({ new: 1 }),
//   })

//   console.log(res)
// }

// test()


module.exports = {
  search,
  keywords,
  channel,
  generateGoods,
}
