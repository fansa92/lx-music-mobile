import { httpFetch } from '../../request'
import { getMusicInfosByList } from './musicInfo'
import { createHttpFetch } from './util'

// 酷狗图片地址都会带 {size} 占位符，统一换成 https 的大图
const formatImg = (url) => {
  if (!url) return ''
  return url.replace('{size}', '480').replace(/^http:\/\//, 'https://')
}

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
      const requestObj = httpFetch(`http://mobiles.kugou.com/api/v5/singer/info?singerid=${id}`)
      const { body, statusCode } = await requestObj.promise
      if (statusCode !== 200) throw new Error('获取歌手信息失败')
      return {
        source: 'kg',
        id,
        name: body.data.singername,
        desc: body.data.intro,
        img: formatImg(body.data.imgurl),
        albumSize: body.data.albumcount,
        musicSize: body.data.songcount,
      }
    } catch (err) {
      return this.getDetail(id, name, retryNum + 1)
    }
  },

  async getSongs(id, order = 'hot', limit = 100, offset = 0, name, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手歌曲失败'))
    if (id == 0) throw new Error('歌手不存在')
    try {
      const page = Math.floor(offset / limit) + 1
      const requestObj = httpFetch(
        `http://mobiles.kugou.com/api/v5/singer/song?singerid=${id}&page=${page}&pagesize=${limit}`,
      )
      const { body, statusCode } = await requestObj.promise
      if (statusCode !== 200) throw new Error('获取歌手歌曲列表失败')
      // 歌曲封面由 getMusicInfosByList 里的专辑封面字段直接带出来，无需额外请求
      const list = await getMusicInfosByList(body.data.info)

      return {
        list,
        total: body.data.total,
        hasMore: page * limit < body.data.total,
      }
    } catch (err) {
      return this.getSongs(id, order, limit, offset, name, retryNum + 1)
    }
  },

  async getAlbums(id, limit = 100, offset = 0, name, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手专辑失败'))
    if (id == 0) throw new Error('歌手不存在')
    try {
      const page = Math.floor(offset / limit) + 1
      const body = await createHttpFetch(
        `http://mobiles.kugou.com/api/v5/singer/album?singerid=${id}&page=${page}&pagesize=${limit}`,
      )
      if (!body?.info) throw new Error('获取歌手专辑列表失败')
      const hotAlbums = body.info.map(item => ({
        id: item.albumid,
        name: item.albumname,
        picUrl: formatImg(item.imgurl),
        artistName: item.singername || '',
        artistId: String(item.singerid ?? id),
        artists: [{ id: String(item.singerid ?? id), name: item.singername || '' }],
        size: item.songcount || 0,
        publishTime: parseTime(item.publishtime),
        source: 'kg',
      }))
      return {
        hotAlbums,
        hasMore: page * limit < (body.total || 0),
      }
    } catch (err) {
      return this.getAlbums(id, limit, offset, name, retryNum + 1)
    }
  },
}
