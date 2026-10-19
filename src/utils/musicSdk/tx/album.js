import musicSearchApi from './musicSearch'
import { getAlbumDetail, getAlbumCover, parseTime } from './utils'

export default {
  async getAlbum(id, name = '', retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取专辑详情失败'))
    if (!id) throw new Error('缺少专辑ID')
    try {
      // fcg_v8_album_info_cp 直接按 albummid 返回专辑信息与全部曲目，不需要再用专辑名搜索
      const data = await getAlbumDetail(id)
      const rawList = data.list ?? []
      const list = musicSearchApi.handleAlbumResult(rawList)
      const author = data.singername || ''
      const authorId = data.singermid || ''

      return {
        list,
        info: {
          name: data.name || name || '',
          img: getAlbumCover(id),
          desc: data.desc || '',
          author,
          artists: author ? [{ id: authorId, name: author }] : [],
          size: data.total_song_num || list.length,
          publishTime: parseTime(data.aDate),
        },
      }
    } catch (err) {
      return this.getAlbum(id, name, retryNum + 1)
    }
  },
}
