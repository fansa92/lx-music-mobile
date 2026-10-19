import { filterAudioGroupList } from './musicInfo'
import { createKgGatewayFetch, formatKgImg } from './util'

// 专辑歌曲接口单页最多 50 首，超过会返回 error_code=20010
const SONG_PAGE_LIMIT = 50
// 单张专辑最多取 20 页，避免异常数据导致死循环
const MAX_PAGE = 20

// 酷狗的时间格式为 "2026-03-25 00:00:00"，iOS 下直接 new Date 会得到 Invalid Date
const parseTime = (str) => {
  if (!str) return 0
  const time = new Date(String(str).replace(/-/g, '/')).getTime()
  return Number.isNaN(time) ? 0 : time
}

export default {
  async getAlbumInfo(id) {
    const body = await createKgGatewayFetch({
      url: '/kmr/v2/albums',
      method: 'post',
      data: {
        data: [{ album_id: Number(id) || id }],
        is_buy: 0,
        fields: 'album_id,album_name,publish_date,sizable_cover,intro,language,is_publish,heat,type,quality,authors,exclusive,author_name,trans_param',
      },
      router: 'openapi.kugou.com',
      kgTid: 255,
    })
    const info = body.data?.[0]
    // 专辑不存在时接口仍返回 status=1，只是 data 里是一个空对象
    if (!info?.album_id) return Promise.reject(new Error('get album info failed.'))

    return {
      name: info.album_name,
      img: formatKgImg(info.sizable_cover),
      desc: info.intro,
      author: info.author_name,
      publishTime: parseTime(info.publish_date),
      size: info.song_count || 0,
      artists: (info.authors || []).map(author => ({ id: String(author.author_id), name: author.author_name })),
    }
  },

  async getAlbum(id, albumName, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取专辑详情失败'))
    try {
      const info = await this.getAlbumInfo(id)
      const list = []
      for (let page = 1; page <= MAX_PAGE; page++) {
        const body = await createKgGatewayFetch({
          url: '/v1/album_audio/lite',
          method: 'post',
          data: {
            album_id: Number(id) || id,
            is_buy: '',
            page,
            pagesize: SONG_PAGE_LIMIT,
          },
          router: 'openapi.kugou.com',
          kgTid: 255,
        })
        const rawList = body.data?.songs || []
        if (!rawList.length) break
        list.push(...filterAudioGroupList(rawList, id, info.name))
        const total = body.data?.total || 0
        if (total && list.length >= total) break
      }
      if (!list.length) throw new Error('Get album list failed.')

      return {
        list,
        info: {
          name: info.name,
          img: info.img,
          desc: info.desc,
          author: info.author,
          // 专辑信息接口的 song_count 经常缺失，这里用实际歌曲数兜底
          size: info.size || list.length,
          publishTime: info.publishTime,
          artists: info.artists,
        },
      }
    } catch (err) {
      return this.getAlbum(id, albumName, retryNum + 1)
    }
  },
}
