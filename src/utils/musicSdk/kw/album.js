import { httpFetch } from '../../request'
import { decodeName, formatPlayTime } from '../../index'
import { formatSinger, objStr2JSON } from './util'

const parseTime = (str) => {
  if (!str) return 0
  const time = new Date(String(str).replace(/-/g, '/')).getTime()
  return Number.isNaN(time) ? 0 : time
}

export default {
  limit_song: 1000,
  filterListDetail(rawList, albumName, albumId, albumImg) {
    return rawList.map((item) => {
      const formats = (item.formats || '').split('|')
      const types = []
      const _types = {}
      if (formats.includes('MP3128')) {
        types.push({ type: '128k', size: null })
        _types['128k'] = { size: null }
      }
      if (formats.includes('MP3H')) {
        types.push({ type: '320k', size: null })
        _types['320k'] = { size: null }
      }
      if (formats.includes('ALFLAC')) {
        types.push({ type: 'flac', size: null })
        _types.flac = { size: null }
      }
      if (formats.includes('HIRFLAC')) {
        types.push({ type: 'hires', size: null })
        _types.hires = { size: null }
      }
      if (formats.includes('ZPGA201')) {
        types.push({ type: 'atmos', size: null })
        _types.atmos = { size: null }
      }
      if (formats.includes('ZPGA501')) {
        types.push({ type: 'atmos_plus', size: null })
        _types.atmos_plus = { size: null }
      }
      if (formats.includes('ZPLY')) {
        types.push({ type: 'master', size: null })
        _types.master = { size: null }
      }
      return {
        singer: formatSinger(decodeName(item.artist)),
        name: decodeName(item.name || item.songname),
        albumName,
        albumId,
        songmid: item.id,
        source: 'kw',
        interval: item.duration ? formatPlayTime(parseInt(item.duration)) : 0,
        img: albumImg || item.pic || '',
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      }
    })
  },

  getAlbumListDetail(id, page, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))
    const requestObj_listDetail = httpFetch(
      `http://search.kuwo.cn/r.s?pn=${page - 1}&rn=${this.limit_song}&stype=albuminfo&albumid=${id}&show_copyright_off=0&encoding=utf&vipver=MUSIC_9.1.0`,
    )
    return requestObj_listDetail.promise.then(({ statusCode, body }) => {
      if (statusCode !== 200) return this.getAlbumListDetail(id, page, ++retryNum)
      if (typeof body === 'string') body = objStr2JSON(body)
      if (!body.musiclist) return this.getAlbumListDetail(id, page, ++retryNum)
      body.name = decodeName(body.name)
      // hts_img 是可用的 https 地址，img 指向的 img4.sycdn.kuwo.cn 已不可用
      const albumImg = body.hts_img || body.img || ''
      const list = this.filterListDetail(body.musiclist, body.name, body.albumid, albumImg)
      return {
        list,
        page,
        limit: this.limit_song,
        total: parseInt(body.songnum),
        source: 'kw',
        info: {
          name: body.name,
          img: albumImg,
          desc: decodeName(body.info),
          author: decodeName(body.artist),
          artists: body.artist ? [{ id: String(body.artistid ?? ''), name: decodeName(body.artist) }] : [],
          size: parseInt(body.songnum) || 0,
          publishTime: parseTime(body.pub || body.showtime),
        },
      }
    })
  },

  async getAlbum(id, albumName, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取专辑详情失败'))
    try {
      const result = await this.getAlbumListDetail(id, 1)
      return {
        list: result.list,
        info: result.info,
      }
    } catch (err) {
      return this.getAlbum(id, albumName, retryNum + 1)
    }
  },
}
