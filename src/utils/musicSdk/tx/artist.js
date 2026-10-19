import musicSearchApi from './musicSearch'
import { desktopSearch, formatTxImg, parseTime } from './utils'

// 桌面搜索接口单页数量有限制，歌曲 60、专辑 40 比较稳
const SONG_PAGE_MAX = 50
const ALBUM_PAGE_MAX = 30
const SINGER_SEARCH_LIMIT = 20

const pickSinger = (list, id, name) => {
  return list.find(item => item.singerMID === id) ||
    list.find(item => item.singerName === name) ||
    null
}

export default {
  async getDetail(id, name = '', retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手信息失败'))
    if (!name) throw new Error('缺少歌手名称')
    try {
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
    } catch (err) {
      return this.getDetail(id, name, retryNum + 1)
    }
  },

  async getSongs(id, order = 'hot', limit = 100, offset = 0, name = '', retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手歌曲失败'))
    if (!name) throw new Error('缺少歌手名称')
    try {
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

      const list = musicSearchApi.handleResult(rawList)
      // 搜索结果的总数是按关键词统计的，这里按本页是否取满判断是否还有下一页
      const hasMore = allList.length >= pageSize && rawList.length > 0

      return {
        list,
        total: meta.sum || 0,
        hasMore,
      }
    } catch (err) {
      return this.getSongs(id, order, limit, offset, name, retryNum + 1)
    }
  },

  async getAlbums(id, limit = 100, offset = 0, name = '', retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手专辑失败'))
    if (!name) throw new Error('缺少歌手名称')
    try {
      const pageSize = Math.min(limit, ALBUM_PAGE_MAX)
      const page = Math.floor(offset / limit) + 1
      const { body } = await desktopSearch(2, name, page, pageSize)
      const rawList = body.album?.list ?? []
      const hotAlbums = rawList
        .filter(item => !id || item.singerMID === id)
        .map(item => ({
          // 专辑详情页需要专辑 mid，不能传数字 id
          id: item.albumMID,
          name: item.albumName,
          picUrl: formatTxImg(item.albumPic),
          artistName: item.singerName || '',
          artistId: item.singerMID || '',
          artists: item.singerName ? [{ id: item.singerMID || '', name: item.singerName }] : [],
          size: item.song_count || 0,
          publishTime: parseTime(item.publicTime),
          source: 'tx',
        }))

      return {
        hotAlbums,
        hasMore: rawList.length >= pageSize && hotAlbums.length > 0,
      }
    } catch (err) {
      return this.getAlbums(id, limit, offset, name, retryNum + 1)
    }
  },
}
