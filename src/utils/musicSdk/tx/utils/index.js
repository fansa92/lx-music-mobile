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
