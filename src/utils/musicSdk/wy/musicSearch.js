// import { httpFetch } from '../../request'
// import { weapi } from './utils/crypto'
import { sizeFormate, formatPlayTime } from '../../index'
// import musicDetailApi from './musicDetail'
import { eapiRequest } from './utils/index'

export default {
  limit: 30,
  total: 0,
  page: 0,
  allPage: 1,
  musicSearch(str, page, limit) {
    // const searchRequest = eapiRequest('/api/cloudsearch/pc', {
    //   s: str,
    //   type: 1, // 1: 单曲, 10: 专辑, 100: 歌手, 1000: 歌单, 1002: 用户, 1004: MV, 1006: 歌词, 1009: 电台, 1014: 视频
    //   limit,
    //   total: page == 1,
    //   offset: limit * (page - 1),
    // })
    const searchRequest = eapiRequest('/api/search/song/list/page', {
      keyword: str,
      needCorrect: '1',
      channel: 'typing',
      offset: limit * (page - 1),
      scene: 'normal',
      total: page == 1,
      limit,
    })
    return searchRequest.promise.then(({ body }) => body)
  },
  getSinger(singers) {
    let arr = []
    singers.forEach(singer => {
      arr.push(singer.name)
    })
    return arr.join('、')
  },
  handleResult(rawList) {
    // console.log(rawList)
    if (!rawList) return []
    return rawList.map(item => {
      item = item.baseInfo.simpleSongData

      const types = []
      const _types = {}
      let size

      if (item.privilege.maxBrLevel == 'hires') {
        size = item.hr ? sizeFormate(item.hr.size) : null
        types.push({ type: 'flac24bit', size })
        _types.flac24bit = {
          size,
        }
      }
      switch (item.privilege.maxbr) {
        case 999000:
          size = item.sq ? sizeFormate(item.sq.size) : null
          types.push({ type: 'flac', size })
          _types.flac = {
            size,
          }
        case 320000:
          size = item.h ? sizeFormate(item.h.size) : null
          types.push({ type: '320k', size })
          _types['320k'] = {
            size,
          }
        case 192000:
        case 128000:
          size = item.l ? sizeFormate(item.l.size) : null
          types.push({ type: '128k', size })
          _types['128k'] = {
            size,
          }
      }

      types.reverse()

      return {
        singer: this.getSinger(item.ar),
        name: item.name,
        albumName: item.al.name,
        albumId: item.al.id,
        source: 'wy',
        interval: formatPlayTime(item.dt / 1000),
        songmid: item.id,
        img: item.al.picUrl,
        lrc: null,
        types,
        _types,
        typeUrl: {},
      }
    })
  },
  search(str, page = 1, limit, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    if (limit == null) limit = this.limit
    return this.musicSearch(str, page, limit).then(result => {
      // console.log(result)
      if (!result || result.code !== 200) return this.search(str, page, limit, retryNum)
      let list = this.handleResult(result.data.resources || [])
      // console.log(list)

      if (list == null) return this.search(str, page, limit, retryNum)

      this.total = result.data.totalCount || 0
      this.page = page
      this.allPage = Math.ceil(this.total / this.limit)

      return {
        list,
        allPage: this.allPage,
        limit: this.limit,
        total: this.total,
        source: 'wy',
      }
      // return result.data
    })
  },
  searchArtist(str, page = 1, limit = 20, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    const searchRequest = eapiRequest('/api/cloudsearch/pc', {
      s: str,
      type: 100,
      limit,
      total: page == 1,
      offset: limit * (page - 1),
    })
    return searchRequest.promise.then(({ body: result }) => {
      if (!result || result.code !== 200) return this.searchArtist(str, page, limit, retryNum)
      const rawList = result.result?.artists || []
      const list = rawList.map(item => ({
        id: item.id,
        name: item.name,
        picUrl: item.picUrl || item.img1v1Url || '',
        alias: item.alias || [],
        albumSize: item.albumSize || 0,
        musicSize: item.musicSize || 0,
        source: 'wy',
      }))
      return {
        list,
        total: result.result?.artistCount || 0,
        allPage: Math.ceil((result.result?.artistCount || 0) / limit),
        limit,
        source: 'wy',
      }
    })
  },
  searchAlbum(str, page = 1, limit = 20, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    const searchRequest = eapiRequest('/api/cloudsearch/pc', {
      s: str,
      type: 10,
      limit,
      total: page == 1,
      offset: limit * (page - 1),
    })
    return searchRequest.promise.then(({ body: result }) => {
      if (!result || result.code !== 200) return this.searchAlbum(str, page, limit, retryNum)
      const rawList = result.result?.albums || []
      const list = rawList.map(item => ({
        id: item.id,
        name: item.name,
        picUrl: item.picUrl || '',
        artistName: item.artist?.name || '',
        artistId: item.artist?.id || '',
        size: item.size || 0,
        publishTime: item.publishTime ? new Date(item.publishTime).toISOString().slice(0, 10) : '',
        source: 'wy',
      }))
      return {
        list,
        total: result.result?.albumCount || 0,
        allPage: Math.ceil((result.result?.albumCount || 0) / limit),
        limit,
        source: 'wy',
      }
    })
  },
}
