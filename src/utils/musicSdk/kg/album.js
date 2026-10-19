import { getMusicInfosByList } from './musicInfo'
import { createHttpFetch } from './util'

// 酷狗的时间格式为 "2026-03-25 00:00:00"，iOS 下直接 new Date 会得到 Invalid Date
const parseTime = (str) => {
  if (!str) return 0
  const time = new Date(String(str).replace(/-/g, '/')).getTime()
  return Number.isNaN(time) ? 0 : time
}

const formatCover = (url) => {
  if (!url) return ''
  return url.replace('{size}', '480').replace(/^http:\/\//, 'https://')
}

export default {
  async getAlbumInfo(id) {
    // 旧接口 kmrserviceretry.kugou.com/container/v1/album 的签名已失效（返回 sign error），改用移动端的专辑信息接口
    const body = await createHttpFetch(`http://mobiles.kugou.com/api/v3/album/info?albumid=${id}`)
    if (!body || !body.albumname) return Promise.reject(new Error('get album info failed.'))

    return {
      name: body.albumname,
      img: formatCover(body.imgurl),
      desc: body.intro,
      author: body.singername,
      artistId: body.singerid,
      publishTime: parseTime(body.publishtime),
      size: body.songcount || 0,
    }
  },

  async getAlbum(id, albumName, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取专辑详情失败'))
    try {
      const albumList = await createHttpFetch(
        `http://mobiles.kugou.com/api/v3/album/song?version=9108&albumid=${id}&plat=0&pagesize=200&area_code=0&page=1&with_res_tag=0`,
      )
      if (!albumList.info) throw new Error('Get album list failed.')

      const list = await getMusicInfosByList(albumList.info)
      const info = await this.getAlbumInfo(id)

      if (info.img) {
        list.forEach(song => {
          if (!song.img) song.img = info.img
        })
      }

      return {
        list: list || [],
        info: {
          name: info.name,
          img: info.img,
          desc: info.desc,
          author: info.author,
          // 专辑信息接口的 songcount 经常是 0，这里用实际歌曲数兜底
          size: info.size || list.length,
          publishTime: info.publishTime,
          artists: info.author ? [{ id: String(info.artistId ?? ''), name: info.author }] : [],
        },
      }
    } catch (err) {
      return this.getAlbum(id, albumName, retryNum + 1)
    }
  },
}
