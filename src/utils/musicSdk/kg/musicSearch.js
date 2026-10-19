import { httpFetch } from '../../request'
import { decodeName, formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'
import { createKgGatewayFetch, createKgWebFetch, formatKgImg } from './util'

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
  searchArtist(str, page = 1, limit = 20) {
    const keyword = String(str ?? '').trim()
    // 关键词为空时接口返回 151 Empty Keyword，直接给空结果，避免无意义的重试
    if (!keyword) return Promise.resolve({ list: [], total: 0, allPage: 0, limit, source: 'kg' })
    // 依次尝试：Web 搜索接口 → App 网关 → 移动端搜索接口
    // 部分网络环境下 gateway.kugou.com 不可达，直接表现为一直 No results
    return this.searchArtistByWeb(keyword, page, limit)
      .catch(() => this.searchArtistByApp(keyword, page, limit))
      .catch(() => this.searchArtistByMobile(keyword, page, limit))
      .catch(() => ({ list: [], total: 0, allPage: 0, limit, source: 'kg' }))
  },
  searchArtistByWeb(keyword, page, limit) {
    // Web 端接口只需要签名参数，不依赖 x-router / kg-tid 等 App 专有请求头，兼容性最好
    return createKgWebFetch({
      url: '/v1/search/author',
      params: {
        albumhide: 0,
        iscorrection: 1,
        keyword,
        nocollect: 0,
        page,
        pagesize: limit,
        platform: 'WebFilter',
      },
    }).then(body => this.handleArtistSearchResult(body, limit))
  },
  searchArtistByApp(keyword, page, limit) {
    return createKgGatewayFetch({
      url: '/v1/search/author',
      params: {
        albumhide: 0,
        iscorrection: 1,
        keyword,
        nocollect: 0,
        page,
        pagesize: limit,
        platform: 'AndroidFilter',
      },
      router: 'complexsearch.kugou.com',
    }).then(body => this.handleArtistSearchResult(body, limit))
  },
  /**
   * 移动端搜索接口，只能拿到歌手 id 与名字，作为前两个接口都不可用时的兜底
   * 目的是不让搜索结果页出现空列表
   */
  searchArtistByMobile(keyword, page, limit) {
    const url = `https://msearch.kugou.com/api/v3/search/singer?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}&showtype=1&version=9108`
    return httpFetch(url).promise.then(({ body }) => {
      const rawList = body?.data
      if (!Array.isArray(rawList) || !rawList.length) throw new Error('kg singer search empty')
      const list = rawList
        .filter(item => item?.singername)
        .map(item => ({
          id: item.singerid,
          name: String(item.singername).trim(),
          picUrl: '',
          albumSize: 0,
          musicSize: 0,
          source: 'kg',
        }))
      if (!list.length) throw new Error('kg singer search empty')
      return {
        list,
        total: list.length,
        allPage: 1,
        limit,
        source: 'kg',
      }
    })
  },
  handleArtistSearchResult(body, limit) {
    const rawList = body?.data?.lists || []
    const total = body?.data?.total ?? 0
    const list = this.filterArtistList(rawList)
    return {
      list,
      total,
      allPage: Math.ceil(total / limit),
      limit,
      source: 'kg',
    }
  },
  /**
   * 歌手搜索结果清洗
   * 酷狗的歌手搜索会混入大量用户自建的歌单/电台账号，表现为头像为空、没有专辑、作品极少，
   * 同一个歌手也可能因为不同账号返回多条同名结果，这里做一次过滤与去重
   */
  filterArtistList(rawList) {
    const map = new Map()
    const formatItem = (item) => ({
      id: item.AuthorId,
      name: String(item.AuthorName).trim(),
      picUrl: formatKgImg(item.Avatar || item.FirstFrameImage),
      albumSize: item.AlbumCount || 0,
      musicSize: item.AudioCount || 0,
      source: 'kg',
    })
    for (const item of rawList) {
      if (!item?.AuthorName) continue
      const data = formatItem(item)
      // 无头像、无专辑且作品数极少的条目基本都是用户自建的歌单/电台账号，不是歌手
      if (!data.picUrl && !data.albumSize && data.musicSize <= 4) continue
      const key = data.name.replace(/[\s·・•.\-_/|,，、&+()（）\[\]【】]/g, '').toLowerCase()
      const score = data.albumSize * 1000 + data.musicSize + (item.Heat || 0) / 100000
      const prev = map.get(key)
      if (prev) {
        if (prev.score >= score) continue
        map.delete(key)
      }
      map.set(key, { score, data })
    }
    // 全部被过滤掉时回退到原始数据，避免出现空列表
    if (!map.size) return rawList.filter(item => item?.AuthorName).map(formatItem)
    return [...map.values()].map(item => item.data)
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
