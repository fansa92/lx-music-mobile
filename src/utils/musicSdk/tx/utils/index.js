import { httpFetch } from '@/utils/request'
import { zzcSign } from './crypto'

export const signRequest = async(data) => {
  // console.log(data)
  const sign = await zzcSign(JSON.stringify(data))
  // console.log('sign', sign)
  return httpFetch(`https://u.y.qq.com/cgi-bin/musics.fcg?sign=${sign}`, {
    method: 'post',
    headers: {
      'User-Agent': 'QQMusic 14090508(android 12)',
      'Referer': 'https://y.qq.com',
      'Origin': 'https://y.qq.com',
    },
    body: data,
  }).promise
}

/**
 * 桌面版搜索接口（不需要签名）
 *
 * 注意：歌手详情页、歌手歌曲/专辑列表用到的 music.musicserviceSinger.* /
 * music.musicserviceAlbum.* 模块，对未登录的客户端全部返回 code=500003，
 * 所以歌手页/专辑页统一改用这个搜索接口，再按歌手 mid / 专辑 mid 过滤。
 *
 * @param {number} searchType 0: 歌曲 1: 歌手 2: 专辑
 * @param {string} query 关键词
 * @param {number} page 页码，从 1 开始
 * @param {number} limit 每页数量，接口对单页数量有限制（歌曲 <= 60，专辑 <= 40）
 */
export const desktopSearch = async(searchType, query, page = 1, limit = 20) => {
  const { body } = await httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'post',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
      'Content-Type': 'application/json',
      'Referer': 'https://y.qq.com/',
    },
    body: {
      comm: { ct: 19, cv: 2151 },
      req: {
        module: 'music.search.SearchCgiService',
        method: 'DoSearchForQQMusicDesktop',
        param: {
          search_type: searchType,
          query,
          page_num: page,
          num_per_page: limit,
        },
      },
    },
  }).promise

  const req = body?.req
  if (!req || body.code !== 0 || req.code !== 0) throw new Error('搜索失败')
  return {
    body: req.data?.body ?? {},
    meta: req.data?.meta ?? {},
  }
}

// "2026-03-25" / "2026-03-25 00:00:00" -> 时间戳
export const parseTime = (str) => {
  if (!str) return 0
  const time = new Date(String(str).replace(/-/g, '/')).getTime()
  return Number.isNaN(time) ? 0 : time
}

// 腾讯的图片地址有 http 和 150x150/180x180 等尺寸标记，统一换成 https 的大图
// 形如 T001R150x150M000{mid}.jpg、T002R180x180M000{mid}_1.jpg
export const formatTxImg = (url, size = 500) => {
  if (!url) return ''
  return url
    .replace(/^http:\/\//, 'https://')
    .replace(/R\d+x\d+M/, `R${size}x${size}M`)
    .replace(/\/(\d+x\d+)\//, `/${size}x${size}/`)
}

// 专辑封面可以按 mid 直接拼出来
export const getAlbumCover = (albumMid, size = 500) => {
  return albumMid ? `https://y.gtimg.cn/music/photo_new/T002R${size}x${size}M000${albumMid}.jpg` : ''
}

// 歌手头像同样可以按 mid 直接拼出来
export const getSingerAvatar = (singerMid, size = 500) => {
  return singerMid ? `https://y.gtimg.cn/music/photo_new/T001R${size}x${size}M000${singerMid}.jpg` : ''
}

const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'

/**
 * QQ 音乐 Web 端的 u.y.qq.com 接口，参数以 data=<json> 的形式挂在 query 上，
 * 参考 https://github.com/Rain120/qq-music-api
 */
export const ucommonGet = async(data) => {
  const { body } = await httpFetch(`https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=${encodeURIComponent(JSON.stringify(data))}`, {
    headers: {
      'User-Agent': WEB_UA,
      'Referer': 'https://y.qq.com/',
    },
  }).promise
  return body
}

/**
 * 歌手详情 + 歌曲列表（同一个接口返回）
 * singer_info 只有 id/mid/name/fans，头像按 mid 拼；singer_brief 是简介
 * sort: 1 最热 / 2 最新，sin 为偏移量，num 单次最多 60
 */
export const getSingerDetail = async(singermid, { sin = 0, num = 1, sort = 1 } = {}) => {
  const body = await ucommonGet({
    comm: { ct: 24, cv: 0 },
    singer: {
      method: 'get_singer_detail_info',
      param: { sort, singermid, sin, num },
      module: 'music.web_singer_info_svr',
    },
  })
  if (!body || body.code !== 0 || body.singer?.code !== 0) throw new Error('获取歌手信息失败')
  return body.singer.data ?? {}
}

/**
 * 歌手专辑列表
 * 返回 { singerMid, total, albumList }，albumList 没有封面字段，按 albumMid 拼
 */
export const getSingerAlbumList = async(singermid, { begin = 0, num = 30 } = {}) => {
  const body = await ucommonGet({
    comm: { ct: 24, cv: 0 },
    singer: {
      method: 'GetAlbumList',
      param: { sort: 5, singermid, begin, num },
      module: 'music.musichallAlbum.AlbumListServer',
    },
  })
  if (!body || body.code !== 0 || body.singer?.code !== 0) throw new Error('获取歌手专辑失败')
  return body.singer.data ?? {}
}

/**
 * 专辑详情（含全部曲目），不依赖专辑名，直接按 albummid 取
 * 返回 data: { mid, name, singername, singermid, aDate, desc, total_song_num, list[] }
 */
export const getAlbumDetail = async(albummid) => {
  const { body } = await httpFetch(`https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg?albummid=${encodeURIComponent(albummid)}&format=json&outCharset=utf-8`, {
    headers: {
      'User-Agent': WEB_UA,
      'Referer': 'https://y.qq.com/',
    },
  }).promise
  if (!body || body.code !== 0 || !body.data?.mid) throw new Error('获取专辑详情失败')
  return body.data
}
