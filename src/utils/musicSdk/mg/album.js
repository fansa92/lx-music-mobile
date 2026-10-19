import { createHttpFetch } from './utils'
import { filterMusicInfoList } from './musicInfo'
import { formatPlayCount } from '../../index'

const ALBUM_INFO_URL = 'https://app.c.nf.migu.cn/MIGUM3.0/resource/album/v2.0'
const RESOURCE_INFO_URL = 'https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do'
const ALBUM_SONG_URL = 'https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/queryAlbumSong'

// 2023 年之后上架的数字专辑在 MIGUM3.0 的专辑接口里查不到（返回 data 为空），
// 搜索给出的又是 18 位资源 id，需要先用资源服务（resourceType=5）换成真正的 albumId
const resolveCache = new Map()
const CACHE_MAX = 50

const setCache = (id, result) => {
  if (resolveCache.size >= CACHE_MAX) resolveCache.delete(resolveCache.keys().next().value)
  resolveCache.set(id, result)
}

const resolveAlbum = async(id) => {
  if (resolveCache.has(id)) return resolveCache.get(id)

  const album = await createHttpFetch(`${ALBUM_INFO_URL}?albumId=${id}`)
  if (album?.title) {
    const result = { albumId: id, info: album }
    setCache(id, result)
    return result
  }

  const resource = await createHttpFetch(`${RESOURCE_INFO_URL}?resourceType=5&resourceId=${id}`)
  const detail = resource?.resource?.[0]
  if (!detail?.materialId) return null

  const result = {
    albumId: detail.materialId,
    info: {
      title: detail.title,
      imgItems: detail.imgItem ?? detail.imgItems,
      summary: detail.summary,
      singer: detail.singer,
      opNumItem: detail.opNumItem,
      totalCount: detail.totalCount,
      publishDate: detail.publishDate || detail.issueDate,
    },
  }
  setCache(id, result)
  return result
}

const formatAlbumInfo = (info) => ({
  name: info.title || '',
  img: info.imgItems?.length ? info.imgItems[0].img : null,
  desc: info.summary || '',
  author: info.singer || '',
  play_count: info.opNumItem?.playNum ? formatPlayCount(info.opNumItem.playNum) : 0,
  size: parseInt(info.totalCount) || 0,
  publishTime: info.publishTime || info.publishDate || '',
})

export default {
  async getAlbumInfo(id) {
    const resolved = await resolveAlbum(id)
    if (!resolved) return Promise.reject(new Error('Get album info error.'))
    return formatAlbumInfo(resolved.info)
  },

  async getAlbum(id, albumName, page = 1, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取专辑详情失败'))
    try {
      const resolved = await resolveAlbum(id)
      // 换不到 albumId 说明该专辑不存在，重试也没有意义
      if (!resolved) return Promise.reject(new Error('获取专辑详情失败'))

      const list = await createHttpFetch(`${ALBUM_SONG_URL}?albumId=${resolved.albumId}&pageNo=${page}`)
      if (!list?.songList) return Promise.reject(new Error('Get album list error.'))

      return {
        list: filterMusicInfoList(list.songList) || [],
        info: formatAlbumInfo(resolved.info),
      }
    } catch (err) {
      return this.getAlbum(id, albumName, page, retryNum + 1)
    }
  },
}
