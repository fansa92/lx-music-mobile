import { httpFetch } from '../../request'
import { decodeName, formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'
import { createHttpFetch } from './util'

// 歌手搜索接口只返回 id 和名字，头像要单独查歌手信息接口。
// 注意：直接拼 https://imge.kugou.com/stdmusic/400/singer/{id}.jpg 对任何歌手都会返回同一张占位图。
const singerImgCache = new Map()

const fetchSingerImg = async(singerid) => {
  const key = String(singerid)
  if (singerImgCache.has(key)) return singerImgCache.get(key)
  try {
    const body = await createHttpFetch(`http://mobiles.kugou.com/api/v5/singer/info?singerid=${key}`)
    const img = body?.imgurl
      ? body.imgurl.replace('{size}', '480').replace(/^http:\/\//, 'https://')
      : ''
    singerImgCache.set(key, img)
    return img
  } catch {
    singerImgCache.set(key, '')
    return ''
  }
}

// 限制并发，避免一次搜索发出几十个歌手信息请求
const fetchSingerImgs = async(singerIds, concurrency = 6) => {
  const result = new Array(singerIds.length)
  let index = 0
  const worker = async() => {
    while (index < singerIds.length) {
      const current = index++
      result[current] = await fetchSingerImg(singerIds[current])
    }
  }
  await Promise.all(new Array(Math.min(concurrency, singerIds.length)).fill(0).map(worker))
  return result
}

export default {
  limit: 30,
  total: 0,
  page: 0,
  allPage: 1,
  musicSearch(str, page, limit) {
    const searchRequest = httpFetch(`https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(str)}&page=${page}&pagesize=${limit}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1`)
    return searchRequest.promise.then(({ body }) => body)
  },
  filterData(rawData) {
    const types = []
    const _types = {}
    if (rawData.FileSize !== 0) {
      let size = sizeFormate(rawData.FileSize)
      types.push({ type: '128k', size, hash: rawData.FileHash })
      _types['128k'] = {
        size,
        hash: rawData.FileHash,
      }
    }
    if (rawData.HQFileSize !== 0) {
      let size = sizeFormate(rawData.HQFileSize)
      types.push({ type: '320k', size, hash: rawData.HQFileHash })
      _types['320k'] = {
        size,
        hash: rawData.HQFileHash,
      }
    }
    if (rawData.SQFileSize !== 0) {
      let size = sizeFormate(rawData.SQFileSize)
      types.push({ type: 'flac', size, hash: rawData.SQFileHash })
      _types.flac = {
        size,
        hash: rawData.SQFileHash,
      }
    }
    if (rawData.ResFileSize !== 0) {
      let size = sizeFormate(rawData.ResFileSize)
      types.push({ type: 'flac24bit', size, hash: rawData.ResFileHash })
      _types.flac24bit = {
        size,
        hash: rawData.ResFileHash,
      }
    }
    return {
      singer: decodeName(formatSingerName(rawData.Singers, 'name')),
      name: decodeName(`${rawData.OriSongName}${rawData.Suffix ? ` ${rawData.Suffix}` : ''}`),
      albumName: decodeName(rawData.AlbumName),
      albumId: rawData.AlbumID,
      songmid: rawData.Audioid,
      source: 'kg',
      interval: formatPlayTime(rawData.Duration),
      _interval: rawData.Duration,
      img: rawData.Image || null,
      lrc: null,
      otherSource: null,
      hash: rawData.FileHash,
      types,
      _types,
      typeUrl: {},
    }
  },
  handleResult(rawData) {
    let ids = new Set()
    const list = []
    rawData.forEach(item => {
      const key = item.Audioid + item.FileHash
      if (ids.has(key)) return
      ids.add(key)
      list.push(this.filterData(item))
      for (const childItem of item.Grp) {
        const key = item.Audioid + item.FileHash
        if (ids.has(key)) continue
        ids.add(key)
        list.push(this.filterData(childItem))
      }
    })
    return list
  },
  search(str, page = 1, limit, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    if (limit == null) limit = this.limit
    // http://newlyric.kuwo.cn/newlyric.lrc?62355680
    return this.musicSearch(str, page, limit).then(result => {
      if (!result || result.error_code !== 0) return this.search(str, page, limit, retryNum)
      let list = this.handleResult(result.data.lists)

      if (list == null) return this.search(str, page, limit, retryNum)

      this.total = result.data.total
      this.page = page
      this.allPage = Math.ceil(this.total / limit)

      return Promise.resolve({
        list,
        allPage: this.allPage,
        limit,
        total: this.total,
        source: 'kg',
      })
    })
  },
  searchArtist(str, page = 1, limit = 20, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    const url = `http://msearch.kugou.com/api/v3/search/singer?keyword=${encodeURIComponent(str)}&page=${page}&pagesize=${limit}`
    return httpFetch(url).promise.then(({ body }) => {
      if (!body || body.status !== 1) return this.searchArtist(str, page, limit, retryNum)
      const rawList = body.data || []
      return fetchSingerImgs(rawList.map(item => item.singerid)).then(imgs => {
        const list = rawList.map((item, index) => ({
          id: item.singerid,
          name: item.singername,
          picUrl: imgs[index] || '',
          source: 'kg',
        }))
        return {
          list,
          total: rawList.length < limit ? (page - 1) * limit + rawList.length : (page + 1) * limit,
          allPage: rawList.length < limit ? page : page + 1,
          limit,
          source: 'kg',
        }
      })
    })
  },
  searchAlbum(str, page = 1, limit = 20, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    const url = `http://msearch.kugou.com/api/v3/search/album?keyword=${encodeURIComponent(str)}&page=${page}&pagesize=${limit}&show_total=1`
    return httpFetch(url).promise.then(({ body }) => {
      if (!body || body.status !== 1) return this.searchAlbum(str, page, limit, retryNum)
      const rawList = body.data?.info || []
      const total = body.data?.total || 0
      const list = rawList.map(item => ({
        id: item.albumid,
        name: item.albumname,
        picUrl: item.imgurl ? item.imgurl.replace('{size}', '400').replace('http://', 'https://') : '',
        artistName: item.singername || '',
        artistId: item.singerid || '',
        publishTime: item.publishtime ? item.publishtime.slice(0, 10) : '',
        source: 'kg',
      }))
      return {
        list,
        total,
        allPage: Math.ceil(total / limit),
        limit,
        source: 'kg',
      }
    })
  },
}
