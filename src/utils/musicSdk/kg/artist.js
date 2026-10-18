import { httpFetch } from '../../request'
import { getMusicInfosByList } from './musicInfo'

export default {
  async getDetail(id, retryNum = 0) {
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
        img: body.data.imgurl.replace('{size}', '480'),
      }
    } catch (err) {
      return this.getDetail(id, retryNum + 1)
    }
  },

  async getSongs(id, order = 'hot', limit = 100, offset = 0, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手歌曲失败'))
    if (id == 0) throw new Error('歌手不存在')
    try {
      const page = Math.floor(offset / limit) + 1
      const requestObj = httpFetch(
        `http://mobiles.kugou.com/api/v5/singer/song?singerid=${id}&page=${page}&pagesize=${limit}`
      )
      const { body, statusCode } = await requestObj.promise
      if (statusCode !== 200) throw new Error('获取歌手歌曲列表失败')
      const list = await getMusicInfosByList(body.data.info)
      return {
        list,
        total: body.data.total,
        hasMore: page * limit < body.data.total,
      }
    } catch (err) {
      return this.getSongs(id, order, limit, offset, retryNum + 1)
    }
  },

  async getAlbums(id, limit = 100, offset = 0, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手专辑失败'))
    if (id == 0) throw new Error('歌手不存在')
    try {
      const page = Math.floor(offset / limit) + 1
      const requestObj = httpFetch(
        `http://mobiles.kugou.com/api/v5/singer/song?singerid=${id}&page=${page}&pagesize=${limit}`
      )
      const { body, statusCode } = await requestObj.promise
      if (statusCode !== 200) throw new Error('获取歌手专辑列表失败')
      const hotAlbums = (body.data.info || []).map(item => ({
        id: item.albumid,
        name: item.albumname,
        picUrl: item.replaceAll ? item.replaceAll('{size}', '480') : '',
        artistName: item.singername || '',
        artistId: id,
        size: 0,
        publishTime: '',
        source: 'kg',
      }))
      return {
        hotAlbums,
        hasMore: false,
      }
    } catch (err) {
      return this.getAlbums(id, limit, offset, retryNum + 1)
    }
  },
}
