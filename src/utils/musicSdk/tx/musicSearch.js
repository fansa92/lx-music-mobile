import { formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'
import { signRequest, formatTxImg } from './utils'
import { httpFetch } from '../../request'

export default {
  limit: 50,
  total: 0,
  page: 0,
  allPage: 1,
  successCode: 0,
  musicSearch(str, page, limit, retryNum = 0) {
    if (retryNum > 5) return Promise.reject(new Error('搜索失败'))
    const searchRequest = signRequest({
      comm: {
        ct: '11',
        cv: '14090508',
        v: '14090508',
        tmeAppID: 'qqmusic',
        phonetype: 'EBG-AN10',
        deviceScore: '553.47',
        devicelevel: '50',
        newdevicelevel: '20',
        rom: 'HuaWei/EMOTION/EmotionUI_14.2.0',
        os_ver: '12',
        OpenUDID: '0',
        OpenUDID2: '0',
        QIMEI36: '0',
        udid: '0',
        chid: '0',
        aid: '0',
        oaid: '0',
        taid: '0',
        tid: '0',
        wid: '0',
        uid: '0',
        sid: '0',
        modeSwitch: '6',
        teenMode: '0',
        ui_mode: '2',
        nettype: '1020',
        v4ip: '',
      },
      req: {
        module: 'music.search.SearchCgiService',
        method: 'DoSearchForQQMusicMobile',
        param: {
          search_type: 0,
          searchid: Math.random().toString().slice(2),
          query: str,
          page_num: page,
          num_per_page: limit,
          highlight: 0,
          nqc_flag: 0,
          multi_zhida: 0,
          cat: 2,
          grp: 1,
          sin: 0,
          sem: 0,
        },
      },
    })
    return searchRequest.then(({ body }) => {
      if (!body || !body.req || body.code != this.successCode || body.req.code != this.successCode) {
        return this.musicSearch(str, page, limit, ++retryNum)
      }
      return body.req.data
    })
  },
  handleResult(rawList) {
    if (!rawList || !Array.isArray(rawList)) return []
    const list = []
    rawList.forEach(item => {
      if (!item.file?.media_mid) return

      let types = []
      let _types = {}
      const file = item.file
      if (file.size_128mp3 != 0) {
        let size = sizeFormate(file.size_128mp3)
        types.push({ type: '128k', size })
        _types['128k'] = { size }
      }
      if (file.size_320mp3 !== 0) {
        let size = sizeFormate(file.size_320mp3)
        types.push({ type: '320k', size })
        _types['320k'] = { size }
      }
      if (file.size_flac !== 0) {
        let size = sizeFormate(file.size_flac)
        types.push({ type: 'flac', size })
        _types.flac = { size }
      }
      if (file.size_hires !== 0) {
        let size = sizeFormate(file.size_hires)
        types.push({ type: 'hires', size })
        _types.hires = { size }
      }
      // size_new 只有部分接口（搜索结果）会返回，歌手歌曲接口没有这个字段，这里必须判空
      if (file.size_new?.[1]) {
        let size = sizeFormate(file.size_new[1])
        types.push({ type: 'atmos', size })
        _types.atmos = { size }
      }
      if (file.size_new?.[2]) {
        let size = sizeFormate(file.size_new[2])
        types.push({ type: 'atmos_plus', size })
        _types.atmos_plus = { size }
      }
      if (file.size_new?.[0]) {
        let size = sizeFormate(file.size_new[0])
        types.push({ type: 'master', size })
        _types.master = { size }
      }
      let albumId = ''
      let albumName = ''
      if (item.album) {
        albumName = item.album.name
        albumId = item.album.mid
      }
      list.push({
        singer: formatSingerName(item.singer, 'name'),
        name: item.title,
        albumName,
        albumId,
        source: 'tx',
        interval: formatPlayTime(item.interval),
        songId: item.id,
        albumMid: item.album?.mid ?? '',
        strMediaMid: item.file.media_mid,
        songmid: item.mid,
        img: (albumId === '' || albumId === '空')
          ? item.singer?.length ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg` : ''
          : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumId}.jpg`,
        types,
        _types,
        typeUrl: {},
      })
    })
    return list
  },
  /**
   * 专辑详情接口（fcg_v8_album_info_cp）的曲目结构与搜索接口不同：
   * 没有 file 对象，音质大小直接是 size128/size320/sizeflac 字段，歌曲名是 songname
   */
  handleAlbumResult(rawList) {
    if (!rawList || !Array.isArray(rawList)) return []
    const list = []
    rawList.forEach(item => {
      if (!item.songmid) return

      const types = []
      const _types = {}
      const pushType = (type, size) => {
        if (!size) return
        const sizeStr = sizeFormate(size)
        types.push({ type, size: sizeStr })
        _types[type] = { size: sizeStr }
      }
      pushType('128k', item.size128)
      pushType('320k', item.size320)
      pushType('flac', item.sizeflac)

      const albumMid = item.albummid ?? ''
      list.push({
        singer: formatSingerName(item.singer, 'name'),
        name: item.songname || item.songorig || '',
        albumName: item.albumname ?? '',
        albumId: albumMid,
        source: 'tx',
        interval: formatPlayTime(item.interval),
        songId: item.songid,
        albumMid,
        strMediaMid: item.strMediaMid || item.songmid,
        songmid: item.songmid,
        img: albumMid
          ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`
          : '',
        types,
        _types,
        typeUrl: {},
      })
    })
    return list
  },
  search(str, page = 1, limit) {
    if (limit == null) limit = this.limit
    return this.musicSearch(str, page, limit).then(({ body, meta }) => {
      let list = this.handleResult(body.item_song)

      this.total = meta.estimate_sum
      this.page = page
      this.allPage = Math.ceil(this.total / limit)

      return Promise.resolve({
        list,
        allPage: this.allPage,
        limit,
        total: this.total,
        source: 'tx',
      })
    })
  },
  searchArtist(str, page = 1, limit = 20, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    const requestObj = httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'post',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
      },
      body: {
        comm: { ct: 19, cv: 2151 },
        req: {
          module: 'music.search.SearchCgiService',
          method: 'DoSearchForQQMusicDesktop',
          param: {
            search_type: 1,
            query: str,
            page_num: page,
            num_per_page: limit,
          },
        },
      },
    })
    return requestObj.promise.then(({ body }) => {
      const req = body?.req
      if (!req || body.code !== 0 || req.code !== 0) return this.searchArtist(str, page, limit, retryNum)
      const rawList = req.data?.body?.singer?.list || []
      const meta = req.data?.meta || {}
      const list = rawList.map(item => ({
        id: item.singerMID,
        name: item.singerName,
        picUrl: formatTxImg(item.singerPic),
        albumSize: item.albumNum || 0,
        musicSize: item.songNum || 0,
        source: 'tx',
      }))
      return {
        list,
        total: meta.sum || 0,
        allPage: Math.ceil((meta.sum || 0) / limit),
        limit,
        source: 'tx',
      }
    })
  },
  searchAlbum(str, page = 1, limit = 20, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    const requestObj = httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'post',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
      },
      body: {
        comm: { ct: 19, cv: 2151 },
        req: {
          module: 'music.search.SearchCgiService',
          method: 'DoSearchForQQMusicDesktop',
          param: {
            search_type: 2,
            query: str,
            page_num: page,
            num_per_page: limit,
          },
        },
      },
    })
    return requestObj.promise.then(({ body }) => {
      const req = body?.req
      if (!req || body.code !== 0 || req.code !== 0) return this.searchAlbum(str, page, limit, retryNum)
      const rawList = req.data?.body?.album?.list || []
      const meta = req.data?.meta || {}
      const list = rawList.map(item => ({
        id: item.albumMID,
        name: item.albumName,
        picUrl: formatTxImg(item.albumPic),
        artistName: item.singerName || '',
        artistId: item.singerMID || '',
        publishTime: item.publicTime || '',
        source: 'tx',
      }))
      return {
        list,
        total: meta.sum || 0,
        allPage: Math.ceil((meta.sum || 0) / limit),
        limit,
        source: 'tx',
      }
    })
  },
}
