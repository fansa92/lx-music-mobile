import { createHttpFetch } from './utils'
import { filterMusicInfoList } from './musicInfo'
import { formatPlayCount } from '../../index'

export default {
  async getAlbumInfo(id) {
    const info = await createHttpFetch(
      `https://app.c.nf.migu.cn/MIGUM3.0/resource/album/v2.0?albumId=${id}`
    )
    if (!info) return Promise.reject(new Error('Get album info error.'))

    return {
      name: info.title,
      img: info.imgItems.length ? info.imgItems[0].img : null,
      desc: info.summary,
      author: info.singer,
      play_count: formatPlayCount(info.opNumItem.playNum),
      total: info.totalCount,
    }
  },

  async getAlbum(id, page = 1, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取专辑详情失败'))
    try {
      const list = await createHttpFetch(
        `http://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/queryAlbumSong?albumId=${id}&pageNo=${page}`
      )
      if (!list.songList) return Promise.reject(new Error('Get album list error.'))

      const songList = filterMusicInfoList(list.songList)
      const listInfo = await this.getAlbumInfo(id)

      return {
        list: songList || [],
        info: {
          name: listInfo.name,
          img: listInfo.img,
          desc: listInfo.desc,
          author: listInfo.author,
        },
      }
    } catch (err) {
      return this.getAlbum(id, page, retryNum + 1)
    }
  },
}
