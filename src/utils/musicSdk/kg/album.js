import { getMusicInfosByList } from './musicInfo'
import { createHttpFetch } from './util'

export default {
  async getAlbumInfo(id) {
    const albumInfoRequest = await createHttpFetch(
      'http://kmrserviceretry.kugou.com/container/v1/album?dfid=1tT5He3kxrNC4D29ad1MMb6F&mid=22945702112173152889429073101964063697&userid=0&appid=1005&clientver=11589',
      {
        method: 'POST',
        body: {
          appid: 1005,
          clienttime: 1681833686,
          clientver: 11589,
          data: [{ album_id: id }],
          fields:
            'language,grade_count,intro,mix_intro,heat,category,sizable_cover,cover,album_name,type,quality,publish_company,grade,special_tag,author_name,publish_date,language_id,album_id,exclusive,is_publish,trans_param,authors,album_tag',
          isBuy: 0,
          key: 'e6f3306ff7e2afb494e89fbbda0becbf',
          mid: '22945702112173152889429073101964063697',
          show_album_tag: 0,
        },
      },
    )
    if (!albumInfoRequest || !albumInfoRequest[0]) return Promise.reject(new Error('get album info failed.'))
    const albumInfo = albumInfoRequest[0]
    const img = albumInfo.sizable_cover
      ? albumInfo.sizable_cover.replace('{size}', '240')
      : (albumInfo.cover || '')

    return {
      name: albumInfo.album_name,
      img,
      desc: albumInfo.intro,
      author: albumInfo.author_name,
    }
  },

  async getAlbum(id, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取专辑详情失败'))
    try {
      const albumList = await createHttpFetch(
        `http://mobiles.kugou.com/api/v3/album/song?version=9108&albumid=${id}&plat=0&pagesize=200&area_code=0&page=1&with_res_tag=0`,
      )
      if (!albumList.info) return Promise.reject(new Error('Get album list failed.'))

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
        },
      }
    } catch (err) {
      return this.getAlbum(id, retryNum + 1)
    }
  },
}
