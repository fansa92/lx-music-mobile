import { eapiRequest } from './utils'
import musicDetailApi from './musicDetail'

const artistApi = {
  /**
   * 获取歌手详情
   * @param {string|number} id 歌手ID
   */
  async getDetail(id, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手详情失败'))
    try {
      const { body } = await eapiRequest('/api/v1/artist/' + id, {}).promise
      if (!body || body.code !== 200 || !body.artist) throw new Error('获取歌手详情失败')
      return body.artist
    } catch (err) {
      if (retryNum >= 2) throw err
      return artistApi.getDetail(id, retryNum + 1)
    }
  },

  /**
   * 获取歌手歌曲
   * @param {string|number} id 歌手ID
   * @param {string} order 'hot' | 'time'
   */
  async getSongs(id, order = 'hot', limit = 100, offset = 0, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手歌曲失败'))
    try {
      const { body } = await eapiRequest('/api/v1/artist/songs', { id, order, offset, limit }).promise
      if (!body || body.code !== 200 || !body.songs) throw new Error('获取歌手歌曲失败')
      const rawSongs = body.songs.filter(item => item.privilege)
      const songs = rawSongs.map(item => ({
        id: item.id,
        name: item.name,
        ar: item.artists,
        al: item.album,
        dt: item.duration,
        h: item.hMusic,
        m: item.mMusic,
        l: item.lMusic,
        sq: item.sqMusic,
        hr: item.hrMusic,
        noCopyrightRcmd: item.noCopyrightRcmd,
        mv: item.mvid,
      }))
      const privileges = rawSongs.map(item => item.privilege)
      const list = musicDetailApi.filterList({ songs, privileges })
      return {
        list,
        total: body.total,
        hasMore: body.more,
      }
    } catch (err) {
      if (retryNum >= 2) throw err
      return artistApi.getSongs(id, order, limit, offset, retryNum + 1)
    }
  },

  /**
   * 获取歌手专辑
   */
  async getAlbums(id, limit = 100, offset = 0, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手专辑失败'))
    try {
      const { body } = await eapiRequest('/api/artist/albums/' + id, { limit, offset }).promise
      if (!body || body.code !== 200) throw new Error('获取歌手专辑失败')
      const hotAlbums = (body.hotAlbums || []).map(item => ({
        id: item.id,
        name: item.name,
        picUrl: item.picUrl,
        artistName: item.artist?.name ?? '',
        artistId: item.artist?.id,
        artists: item.artists ?? [],
        size: item.size,
        publishTime: item.publishTime,
        briefDesc: item.briefDesc ?? '',
        source: 'wy',
      }))
      return {
        hotAlbums,
        hasMore: body.more,
      }
    } catch (err) {
      if (retryNum >= 2) throw err
      return artistApi.getAlbums(id, limit, offset, retryNum + 1)
    }
  },
}

export default artistApi
