// import '../../polyfill/array.find'

import { httpFetch } from '../../request'
import { formatPlayTime, decodeName } from '../../index'
// import { debug } from '../../utils/env'
import { formatSinger } from './util'

// 酷我搜索接口的图片地址有三种形式：hts_img（可用的 https 完整地址）、img（完整地址，但域名 img2.sycdn.kuwo.cn 已不可用）、pic（相对路径）
const formatAlbumPic = (item) => {
  if (item.hts_img) return item.hts_img
  if (item.img && !/\.sycdn\.kuwo\.cn/.test(item.img)) return item.img.replace(/^http:\/\//, 'https://')
  if (item.pic) return `https://img2.kuwo.cn/star/albumcover/${item.pic}`
  return ''
}

// 歌手头像同理，http://img1.kuwo.cn/star/starheads/ 仍可用，只是要换成 https
export const formatArtistPic = (item) => {
  if (item.hts_PICPATH) return item.hts_PICPATH
  const path = item.PICPATH || item.pic
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path.replace(/^http:\/\//, 'https://')
  return `https://img1.kuwo.cn/star/starheads/${path}`
}

export default {
  regExps: {
    mInfo: /level:(\w+),bitrate:(\d+),format:(\w+),size:([\w.]+)/,
  },
  limit: 30,
  total: 0,
  page: 0,
  allPage: 1,
  // cancelFn: null,
  musicSearch(str, page, limit) {
    const musicSearchRequestObj = httpFetch(`http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(str)}&pn=${page - 1}&rn=${limit}&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1&issubtitle=1`)
    return musicSearchRequestObj.promise
  },
  // getImg(songId) {
  //   return httpGet(`http://player.kuwo.cn/webmusic/sj/dtflagdate?flag=6&rid=MUSIC_${songId}`)
  // },
  // getLrc(songId) {
  //   return httpGet(`http://mobile.kuwo.cn/mpage/html5/songinfoandlrc?mid=${songId}&flag=0`)
  // },
  handleResult(rawData) {
    const result = []
    if (!rawData) return result
    // console.log(rawData)
    for (let i = 0; i < rawData.length; i++) {
      const info = rawData[i]
      let songId = info.MUSICRID.replace('MUSIC_', '')
      // const format = (info.FORMATS || info.formats).split('|')

      if (!info.N_MINFO) {
        console.log('N_MINFO is undefined')
        return null
      }

      const types = []
      const _types = {}

      let infoArr = info.N_MINFO.split(';')
      for (let info of infoArr) {
        info = info.match(this.regExps.mInfo)
        if (info) {
          switch (info[2]) {
            case '4000':
              types.push({ type: 'flac24bit', size: info[4] })
              _types.flac24bit = {
                size: info[4].toLocaleUpperCase(),
              }
              break
            case '2000':
              types.push({ type: 'flac', size: info[4] })
              _types.flac = {
                size: info[4].toLocaleUpperCase(),
              }
              break
            case '320':
              types.push({ type: '320k', size: info[4] })
              _types['320k'] = {
                size: info[4].toLocaleUpperCase(),
              }
              break
            case '128':
              types.push({ type: '128k', size: info[4] })
              _types['128k'] = {
                size: info[4].toLocaleUpperCase(),
              }
              break
          }
        }
      }
      types.reverse()

      let interval = parseInt(info.DURATION)

      result.push({
        name: decodeName(info.SONGNAME),
        singer: formatSinger(decodeName(info.ARTIST)),
        source: 'kw',
        // img = (info.album.name === '' || info.album.name === '空')
        //   ? `http://player.kuwo.cn/webmusic/sj/dtflagdate?flag=6&rid=MUSIC_160911.jpg`
        //   : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${info.album.mid}.jpg`
        songmid: songId,
        albumId: decodeName(info.ALBUMID || ''),
        interval: Number.isNaN(interval) ? 0 : formatPlayTime(interval),
        albumName: info.ALBUM ? decodeName(info.ALBUM) : '',
        lrc: null,
        img: info.web_albumpic_short ? `https://img2.kuwo.cn/star/albumcover/${info.web_albumpic_short}` : null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      })
    }
    // console.log(result)
    return result
  },
  search(str, page = 1, limit, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))
    if (limit == null) limit = this.limit
    // http://newlyric.kuwo.cn/newlyric.lrc?62355680
    return this.musicSearch(str, page, limit).then(({ body: result }) => {
      // console.log(result)
      if (!result || (result.TOTAL !== '0' && result.SHOW === '0')) return this.search(str, page, limit, ++retryNum)
      let list = this.handleResult(result.abslist)

      if (list == null) return this.search(str, page, limit, ++retryNum)

      this.total = parseInt(result.TOTAL)
      this.page = page
      this.allPage = Math.ceil(this.total / limit)

      return Promise.resolve({
        list,
        allPage: this.allPage,
        total: this.total,
        limit,
        source: 'kw',
      })
    })
  },
  searchArtist(str, page = 1, limit = 20, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    const url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(str)}&pn=${page - 1}&rn=${limit}&ft=artist&encoding=utf8&rformat=json&mobi=1`
    return httpFetch(url).promise.then(({ body: result }) => {
      if (!result) return this.searchArtist(str, page, limit, retryNum)
      const rawList = result.abslist || []
      const list = rawList.map(item => ({
        id: item.ARTISTID,
        name: item.ARTIST,
        picUrl: formatArtistPic(item),
        source: 'kw',
      }))
      return {
        list,
        total: parseInt(result.TOTAL) || 0,
        allPage: Math.ceil((parseInt(result.TOTAL) || 0) / limit),
        limit,
        source: 'kw',
      }
    })
  },
  searchAlbum(str, page = 1, limit = 20, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    const url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(str)}&pn=${page - 1}&rn=${limit}&ft=album&encoding=utf8&rformat=json&mobi=1`
    return httpFetch(url).promise.then(({ body: result }) => {
      if (!result) return this.searchAlbum(str, page, limit, retryNum)
      const rawList = result.albumlist || []
      const list = rawList.map(item => ({
        id: item.albumid,
        name: item.name,
        // item.img 是完整地址且域名（img2.sycdn.kuwo.cn）已不可用，优先用 https 的 hts_img
        picUrl: formatAlbumPic(item),
        artistName: item.artist || '',
        artistId: item.artistid || '',
        source: 'kw',
      }))
      const total = parseInt(result.TOTAL) || 0
      return {
        list,
        total,
        allPage: Math.ceil((total || rawList.length) / limit),
        limit,
        source: 'kw',
      }
    })
  },
}
