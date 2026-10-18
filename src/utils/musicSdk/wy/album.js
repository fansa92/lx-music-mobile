import { eapiRequest } from './utils'
import musicDetailApi from './musicDetail'

export default {
  /**
   * 获取专辑详情和歌曲
   * @param {string|number} albumId 专辑ID
   */
  async getAlbum(albumId, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取专辑详情失败'))
    try {
      const { body } = await eapiRequest('/api/v1/album/' + albumId, {}).promise
      if (!body || body.code !== 200 || !body.album) throw new Error('获取专辑详情失败')
      const rawSongs = (body.songs || []).filter(item => item.privilege)
      const privileges = rawSongs.map(item => item.privilege)
      const list = musicDetailApi.filterList({ songs: rawSongs, privileges })
      return {
        list,
        info: body.album,
      }
    } catch (err) {
      if (retryNum >= 2) throw err
      return this.getAlbum(albumId, retryNum + 1)
    }
  },
}
