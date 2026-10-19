import { httpFetch } from '../../request'
import musicSearchApi, { formatArtistPic } from './musicSearch'

// 酷我的歌手页没有独立接口，统一走 search.kuwo.cn 的搜索接口，再按歌手名/歌手id 过滤
const SEARCH_URL = 'http://search.kuwo.cn/r.s?client=kt'

const buildSearchUrl = (ft, keyword, page, limit) => {
  return `${SEARCH_URL}&all=${encodeURIComponent(keyword)}&pn=${page}&rn=${limit}&ft=${ft}` +
    '&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1' +
    '&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1&issubtitle=1'
}

const getArtistList = async(keyword, page, limit) => {
  const { body } = await httpFetch(buildSearchUrl('artist', keyword, page, limit)).promise
  return body?.abslist || []
}

// 酷我歌手名可能是 "周杰伦&费玉清" 这种用 & 连接的多人形式
const isSameSinger = (artistNames, name, artistId, id) => {
  if (artistId && String(artistId) === String(id)) return true
  if (!artistNames || !name) return false
  return String(artistNames)
    .split(/&|\/|、/)
    .some(item => item.trim() === name.trim())
}

const filterAlbumPic = (item) => {
  if (item.hts_img) return item.hts_img
  if (item.pic) return `https://img2.kuwo.cn/star/albumcover/${item.pic}`
  if (item.img && !/\.sycdn\.kuwo\.cn/.test(item.img)) return item.img.replace(/^http:\/\//, 'https://')
  return ''
}

const parseTime = (str) => {
  if (!str) return 0
  const time = new Date(String(str).replace(/-/g, '/')).getTime()
  return Number.isNaN(time) ? 0 : time
}

export default {
  async getDetail(id, name = '', retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手信息失败'))
    if (!name) throw new Error('缺少歌手名称')
    try {
      const rawList = await getArtistList(name, 0, 20)
      const item = rawList.find(it => String(it.ARTISTID) === String(id)) ||
        rawList.find(it => it.ARTIST === name) ||
        rawList[0]
      if (!item) throw new Error('获取歌手信息失败')
      return {
        source: 'kw',
        id: String(item.ARTISTID ?? id),
        name: item.ARTIST,
        desc: item.desc || '',
        img: formatArtistPic(item),
        albumSize: parseInt(item.ALBUMNUM) || 0,
        musicSize: parseInt(item.SONGNUM) || 0,
      }
    } catch (err) {
      return this.getDetail(id, name, retryNum + 1)
    }
  },

  async getSongs(id, order = 'hot', limit = 100, offset = 0, name = '', retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手歌曲失败'))
    if (!name) throw new Error('缺少歌手名称')
    try {
      const page = Math.floor(offset / limit)
      const { body } = await httpFetch(buildSearchUrl('music', name, page, limit)).promise
      const rawList = body?.abslist || []
      const matched = rawList.filter(item => isSameSinger(item.ARTIST || item.FARTIST, name, item.ARTISTID, id))

      let list = musicSearchApi.handleResult(matched) || []
      if (order === 'time') {
        // 搜索接口没有发行时间字段，按返回顺序反转，尽量让新歌排在前面
        list = [...list].reverse()
      }

      return {
        list,
        total: parseInt(body?.TOTAL) || 0,
        // 搜索结果的总数是按关键词统计的，不能用来判断是否还有下一页，这里按本页是否取满判断
        hasMore: rawList.length >= limit,
      }
    } catch (err) {
      return this.getSongs(id, order, limit, offset, name, retryNum + 1)
    }
  },

  async getAlbums(id, limit = 100, offset = 0, name = '', retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手专辑失败'))
    if (!name) throw new Error('缺少歌手名称')
    try {
      const page = Math.floor(offset / limit)
      const { body } = await httpFetch(buildSearchUrl('album', name, page, limit)).promise
      const rawList = body?.albumlist || []
      const hotAlbums = rawList
        .filter(item => isSameSinger(item.artist, name, item.artistid, id))
        .map(item => ({
          id: item.albumid,
          name: item.name,
          picUrl: filterAlbumPic(item),
          artistName: item.artist || '',
          artistId: String(item.artistid ?? id),
          artists: item.artist ? [{ id: String(item.artistid ?? id), name: item.artist }] : [],
          size: parseInt(item.musiccnt) || 0,
          publishTime: parseTime(item.pub || item.showtime),
          source: 'kw',
        }))

      return {
        hotAlbums,
        hasMore: rawList.length >= limit,
      }
    } catch (err) {
      return this.getAlbums(id, limit, offset, name, retryNum + 1)
    }
  },
}
