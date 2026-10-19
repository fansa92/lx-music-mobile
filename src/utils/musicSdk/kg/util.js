import pako from 'pako'
import { Buffer } from 'buffer'
import { toMD5 } from '../utils'
import { httpFetch } from '../../request'

// https://github.com/lyswhut/lx-music-desktop/issues/296#issuecomment-683285784
const enc_key = Buffer.from([0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47, 0x51, 0x36, 0x31, 0x2d, 0xce, 0xd2, 0x6e, 0x69], 'binary')
export const decodeLyric = str => new Promise((resolve, reject) => {
  if (!str.length) return
  const buf_str = Buffer.from(str, 'base64').slice(4)
  for (let i = 0, len = buf_str.length; i < len; i++) {
    buf_str[i] = buf_str[i] ^ enc_key[i % 16]
  }
  const result = pako.inflate(buf_str, { to: 'string' })
  resolve(result)
  // (err, result) => {
  //   if (err) return reject(err)
  //   resolve(result.toString())
  // }
})

// s.content[0].lyricContent.forEach(([str]) => {
//   console.log(str)
// })

/**
 * 签名
 * @param {*} params
 * @param {*} apiver
 */
export const signatureParams = (params, platform = 'android', body = '') => {
  let keyparam = 'OIlwieks28dk2k092lksi2UIkp'
  if (platform === 'web') keyparam = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'
  let param_list = params.split('&')
  param_list.sort()
  let sign_params = `${keyparam}${param_list.join('')}${body}${keyparam}`
  return toMD5(sign_params)
}

// 酷狗移动端开放接口的固定参数，与官方 App 14083/20489 版本保持一致
const KG_APPID = 1005
const KG_CLIENTVER = 20489
const KG_SIGN_SALT = 'OIlwieks28dk2k092lksi2UIkp'
// 歌手/专辑详情要求必须带设备标识，mid 用固定值即可通过校验
const KG_MID = '1'
const KG_DFID = '-'

/**
 * 酷狗开放接口的图片地址带 {size} 占位符，统一换成 https 大图
 * @param {string} url
 * @param {number} size
 */
export const formatKgImg = (url, size = 480) => {
  if (!url) return ''
  return url.replace('{size}', String(size)).replace(/^http:\/\//, 'https://')
}

/**
 * 创建一个带签名的酷狗开放接口请求（gateway.kugou.com）
 *
 * 签名规则与官方客户端一致：MD5(盐 + 按 key 排序的 k=v 串 + 请求体 + 盐)
 * 部分接口需要通过 x-router 头路由到对应的后端服务，否则会被网关拒绝（返回空响应）
 *
 * @param {object} options
 * @param {string} options.url 接口路径，如 /kmr/v3/author
 * @param {string} [options.method] 请求方法
 * @param {object} [options.params] URL 查询参数（会与默认参数合并后一起参与签名）
 * @param {object} [options.data] 请求体，POST 时使用
 * @param {string} [options.router] x-router 头的值
 * @param {number|string} [options.kgTid] kg-tid 头，接口埋点用
 * @param {string} [options.baseURL] 域名，默认 gateway.kugou.com
 */
export const createKgGatewayFetch = async({
  url,
  method = 'get',
  params = {},
  data,
  router,
  kgTid,
  baseURL = 'https://gateway.kugou.com',
}) => {
  const clienttime = Math.floor(Date.now() / 1000)
  const query = Object.assign({
    dfid: KG_DFID,
    mid: KG_MID,
    uuid: '-',
    appid: KG_APPID,
    clientver: KG_CLIENTVER,
    clienttime,
  }, params)
  // 签名用的请求体必须与实际发出的字符串完全一致，因此统一在这里序列化
  const body = data ? JSON.stringify(data) : ''
  const signText = Object.keys(query)
    .sort()
    .map(key => `${key}=${query[key]}`)
    .join('')
  query.signature = toMD5(`${KG_SIGN_SALT}${signText}${body}${KG_SIGN_SALT}`)

  const queryString = Object.keys(query)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&')

  const headers = {
    dfid: KG_DFID,
    clienttime: String(clienttime),
    mid: KG_MID,
    'kg-rc': '1',
    'kg-thash': '5d816a0',
    'kg-rec': '1',
    'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
    'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
  }
  if (router) headers['x-router'] = router
  if (kgTid) headers['kg-tid'] = String(kgTid)

  const options = { method, headers }
  if (data) options.body = data

  const { statusCode, body: resBody } = await httpFetch(`${baseURL}${url}?${queryString}`, options).promise
  if (statusCode !== 200) throw new Error(`http status ${statusCode}`)
  if ((resBody?.error_code ?? resBody?.errcode ?? 0) !== 0) {
    throw new Error(resBody?.error_msg || resBody?.errmsg || 'kg api error')
  }
  return resBody
}

/**
 * 创建一个适用于KG的Http请求
 * @param {*} url
 * @param {*} options
 * @param {*} retryNum
 */
export const createHttpFetch = async(url, options, retryNum = 0) => {
  if (retryNum > 2) throw new Error('try max num')
  let result
  options.cache = 'default'
  try {
    result = await httpFetch(url, options).promise
  } catch (err) {
    console.log(err)
    return createHttpFetch(url, options, ++retryNum)
  }
  // console.log(result.statusCode, result.body)
  if (result.statusCode !== 200 ||
    (
      result.body.error_code ??
      result.body.errcode ??
      result.body.err_code) != 0
  ) return createHttpFetch(url, options, ++retryNum)
  if (result.body.data) return result.body.data
  if (Array.isArray(result.body.info)) return result.body
  return result.body.info
}
