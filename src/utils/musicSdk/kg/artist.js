import { httpFetch } from '../../request'
import { getMusicInfosByList } from './musicInfo'
import { createHttpFetch } from './util'

const fetchAlbumCovers = async(albumIds) => {
  if (!albumIds.length) return {}
  try {
    const result = await createHttpFetch(
      'http://kmrserviceretry.kugou.com/container/v1/album?dfid=1tT5He3kxrNC4D29ad1MMb6F&mid=22945702112173152889429073101964063697&userid=0&appid=1005&clientver=11589',
      {
        method: 'POST',
        body: {
          appid: 1005,
          clienttime: 1681833686,
          clientver: 11589,
          data: albumIds.map(albumId => ({ album_id: albumId })),
          fields: 'sizable_cover,album_id',
          isBuy: 0,
          key: 'e6f3306ff7e2afb494e89fbbda0becbf',
          mid: '22945702112173152889429073101964063697',
          show_album_tag: 0,
        },
      },
    )
    if (!Array.isArray(result)) return {}
    const coverMap = {}
    result.forEach(album => {
      if (album?.album_id && album?.sizable_cover) {
        coverMap[String(album.album_id)] = album.sizable_cover.replace('{size}', '480')
      }
    })
    return coverMap
  } catch {
    return {}
  }
}

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
        `http://mobiles.kugou.com/api/v5/singer/song?singerid=${id}&page=${page}&pagesize=${limit}`,
      )
      const { body, statusCode } = await requestObj.promise
      if (statusCode !== 200) throw new Error('获取歌手歌曲列表失败')
      const list = await getMusicInfosByList(body.data.info)

      const uniqueAlbumIds = [...new Set(list.filter(s => s.albumId).map(s => String(s.albumId)))]
      const coverMap = await fetchAlbumCovers(uniqueAlbumIds)
      if (Object.keys(coverMap).length) {
        list.forEach(song => {
          if (song.albumId && coverMap[String(song.albumId)]) {
            song.img = coverMap[String(song.albumId)]
          }
        })
      }

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
      const body = await createHttpFetch(
        `http://mobiles.kugou.com/api/v5/singer/album?singerid=${id}&page=${page}&pagesize=${limit}`,
      )
      if (!body?.info) return Promise.reject(new Error('获取歌手专辑列表失败'))
      const hotAlbums = body.info.map(item => ({
        id: item.albumid,
        name: item.albumname,
        picUrl: item.imgurl ? item.imgurl.replace('{size}', '480') : '',
        artistName: item.singername || '',
        artistId: id,
        size: 0,
        publishTime: item.publishtime || '',
        source: 'kg',
      }))
      return {
        hotAlbums,
        hasMore: page * limit < (body.total || 0),
      }
    } catch (err) {
      return this.getAlbums(id, limit, offset, retryNum + 1)
    }
  },
}
