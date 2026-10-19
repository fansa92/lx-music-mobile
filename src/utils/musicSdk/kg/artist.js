import { filterAudioGroupList } from './musicInfo'
import { createKgGatewayFetch, formatKgImg } from './util'

// 歌手歌曲接口单页最多 100 首，超过会返回 error_code=20010
const SONG_PAGE_LIMIT = 100
const ALBUM_PAGE_LIMIT = 200

const parseTime = (str) => {
  if (!str) return 0
  const time = new Date(String(str).replace(/-/g, '/')).getTime()
  return Number.isNaN(time) ? 0 : time
}

export default {
  async getDetail(id, name, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手信息失败'))
    if (id == 0) throw new Error('歌手不存在')
    try {
      const body = await createKgGatewayFetch({
        url: '/kmr/v3/author',
        method: 'post',
        data: { author_id: Number(id) || id },
        router: 'openapi.kugou.com',
        kgTid: 36,
      })
      const info = body.data
      if (!info?.author_name) throw new Error('获取歌手信息失败')
      return {
        source: 'kg',
        id,
        name: info.author_name,
        desc: info.intro || info.long_intro || '',
        img: formatKgImg(info.sizable_avatar),
        albumSize: info.album_count || 0,
        musicSize: info.song_count || 0,
      }
    } catch (err) {
      return this.getDetail(id, name, retryNum + 1)
    }
  },

  async getSongs(id, order = 'hot', limit = 100, offset = 0, name, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手歌曲失败'))
    if (id == 0) throw new Error('歌手不存在')
    try {
      const pageSize = Math.min(limit, SONG_PAGE_LIMIT)
      const page = Math.floor(offset / pageSize) + 1
      // 新版接口每首歌都带完整的音质信息与专辑封面，不用再按 hash 单独查一遍详情
      const body = await createKgGatewayFetch({
        url: '/openapi/kmr/v2/audio_group/author',
        params: {
          author_id: Number(id) || id,
          area_code: 'all',
          sort: order === 'time' ? 2 : 1, // 1：最热，2：最新
          page,
          pagesize: pageSize,
          replace_api_version: 1,
          mvdata_need: 1,
          show_audio_honor: 1,
          show_audio_tag: 1,
          replace_need: 1,
        },
        kgTid: 36,
      }).catch(() => {
        // 新版接口只能走 gateway，网关不可用时退回旧版接口（字段扁平，同样带音质信息）
        return createKgGatewayFetch({
          url: '/kmr/v1/audio_group/author',
          method: 'post',
          data: {
            author_id: Number(id) || id,
            area_code: 'all',
            sort: order === 'time' ? 2 : 1,
            page,
            pagesize: pageSize,
          },
          router: 'openapi.kugou.com',
          kgTid: 36,
        })
      })
      // 新版返回 { songs, total }，旧版直接返回歌曲数组、总数在顶层
      const rawList = Array.isArray(body.data) ? body.data : (body.data?.songs || [])
      const total = (Array.isArray(body.data) ? body.total : body.data?.total) ?? body.extra?.page_total ?? 0

      return {
        list: filterAudioGroupList(rawList),
        total,
        hasMore: page * pageSize < total,
      }
    } catch (err) {
      return this.getSongs(id, order, limit, offset, name, retryNum + 1)
    }
  },

  async getAlbums(id, limit = 100, offset = 0, name, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手专辑失败'))
    if (id == 0) throw new Error('歌手不存在')
    try {
      const pageSize = Math.min(limit, ALBUM_PAGE_LIMIT)
      const page = Math.floor(offset / pageSize) + 1
      const body = await createKgGatewayFetch({
        url: '/kmr/v1/author/albums',
        method: 'post',
        data: {
          author_id: Number(id) || id,
          pagesize: pageSize,
          page,
          sort: 1, // 1：最新，3：最热
          category: 1,
          area_code: 'all',
        },
        router: 'openapi.kugou.com',
        kgTid: 36,
      })
      const rawList = body.data || []
      const total = body.total || 0

      const hotAlbums = rawList.map(item => ({
        id: item.album_id,
        name: item.album_name,
        picUrl: formatKgImg(item.sizable_cover || item.cover),
        artistName: item.author_name || '',
        artistId: String(item.authors?.[0]?.author_id ?? id),
        artists: (item.authors || []).map(author => ({ id: String(author.author_id), name: author.author_name })),
        size: item.song_count || 0,
        publishTime: parseTime(item.publish_date),
        source: 'kg',
      }))
      return {
        hotAlbums,
        hasMore: page * pageSize < total,
      }
    } catch (err) {
      return this.getAlbums(id, limit, offset, name, retryNum + 1)
    }
  },
}
