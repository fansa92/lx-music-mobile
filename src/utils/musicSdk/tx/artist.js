import musicSearchApi from './musicSearch'
import {
  desktopSearch,
  getSingerDetail,
  getSingerAlbumList,
  getSingerAvatar,
  getAlbumCover,
  formatTxImg,
  parseTime,
} from './utils'

// 歌手歌曲接口单次最多 60 首，专辑列表一次最多 60 张
const SONG_PAGE_MAX = 60
const ALBUM_PAGE_MAX = 60
const SINGER_SEARCH_LIMIT = 20

const pickSinger = (list, id, name) => {
  return list.find(item => item.singerMID === id) ||
    list.find(item => item.singerName === name) ||
    null
}

export default {
  async getDetail(id, name = '', retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手信息失败'))
    try {
      // 直接用 singerMID 查歌手信息，不再依赖歌手名，拿不到总歌曲/专辑数也不会错
      const data = await getSingerDetail(id, { sin: 0, num: 1 })
      const info = data.singer_info
      if (!info?.mid) throw new Error('获取歌手信息失败')
      return {
        source: 'tx',
        id: info.mid,
        name: info.name || name,
        desc: data.singer_brief || '',
        img: getSingerAvatar(info.mid),
        albumSize: data.total_album || 0,
        musicSize: data.total_song || 0,
      }
    } catch (err) {
      // 传进来的可能是数字 singerID，此时按歌手名回退到搜索接口
      if (name) {
        const detail = await this.getDetailBySearch(id, name).catch(() => null)
        if (detail) return detail
      }
      return this.getDetail(id, name, retryNum + 1)
    }
  },

  async getDetailBySearch(id, name) {
    const { body } = await desktopSearch(1, name, 1, SINGER_SEARCH_LIMIT)
    const singer = pickSinger(body.singer?.list ?? [], id, name)
    if (!singer) throw new Error('获取歌手信息失败')
    return {
      source: 'tx',
      id: singer.singerMID || id,
      name: singer.singerName || name,
      desc: '',
      img: formatTxImg(singer.singerPic),
      albumSize: singer.albumNum || 0,
      musicSize: singer.songNum || 0,
    }
  },

  async getSongs(id, order = 'hot', limit = 60, offset = 0, name = '', retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手歌曲失败'))
    const num = Math.min(limit, SONG_PAGE_MAX)
    try {
      const data = await getSingerDetail(id, {
        sin: offset,
        num,
        sort: order === 'time' ? 2 : 1, // 1：最热，2：最新
      })
      const rawList = data.songlist ?? []
      const total = data.total_song ?? 0
      return {
        list: musicSearchApi.handleResult(rawList),
        total,
        hasMore: offset + rawList.length < total,
      }
    } catch (err) {
      if (name) {
        const result = await this.getSongsBySearch(id, name, order, limit, offset).catch(() => null)
        if (result) return result
      }
      return this.getSongs(id, order, limit, offset, name, retryNum + 1)
    }
  },

  async getSongsBySearch(id, name, order, limit, offset) {
    const pageSize = Math.min(limit, SONG_PAGE_MAX)
    const page = Math.floor(offset / limit) + 1
    const { body, meta } = await desktopSearch(0, name, page, pageSize)
    const allList = body.song?.list ?? []
    const rawList = allList.filter(item =>
      (item.singer ?? []).some(singer => singer.mid === id),
    )
    if (order === 'time') {
      rawList.sort((a, b) => String(b.time_public ?? '').localeCompare(String(a.time_public ?? '')))
    }
    return {
      list: musicSearchApi.handleResult(rawList),
      total: meta.sum || 0,
      // 搜索结果的总数是按关键词统计的，这里按本页是否取满判断是否还有下一页
      hasMore: allList.length >= pageSize && rawList.length > 0,
    }
  },

  async getAlbums(id, limit = 60, offset = 0, name = '', retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手专辑失败'))
    const num = Math.min(limit, ALBUM_PAGE_MAX)
    try {
      const data = await getSingerAlbumList(id, { begin: offset, num })
      const rawList = data.albumList ?? []
      const total = data.total ?? 0
      return {
        hotAlbums: rawList.map(item => ({
          // 专辑详情页需要专辑 mid，不能传数字 id
          id: item.albumMid,
          name: item.albumName,
          picUrl: getAlbumCover(item.albumMid),
          artistName: item.singerName || '',
          artistId: id,
          artists: item.singerName ? [{ id, name: item.singerName }] : [],
          size: item.totalNum || 0,
          publishTime: parseTime(item.publishDate),
          source: 'tx',
        })),
        hasMore: total ? offset + rawList.length < total : rawList.length >= num,
      }
    } catch (err) {
      if (name) {
        const result = await this.getAlbumsBySearch(id, name, limit, offset).catch(() => null)
        if (result) return result
      }
      return this.getAlbums(id, limit, offset, name, retryNum + 1)
    }
  },

  async getAlbumsBySearch(id, name, limit, offset) {
    const pageSize = Math.min(limit, ALBUM_PAGE_MAX)
    const page = Math.floor(offset / limit) + 1
    const { body } = await desktopSearch(2, name, page, pageSize)
    const rawList = (body.album?.list ?? []).filter(item => !id || item.singerMID === id)
    return {
      hotAlbums: rawList.map(item => ({
        id: item.albumMID,
        name: item.albumName,
        picUrl: formatTxImg(item.albumPic),
        artistName: item.singerName || '',
        artistId: item.singerMID || '',
        artists: item.singerName ? [{ id: item.singerMID || '', name: item.singerName }] : [],
        size: item.song_count || 0,
        publishTime: parseTime(item.publicTime),
        source: 'tx',
      })),
      hasMore: rawList.length >= pageSize,
    }
  },
}
