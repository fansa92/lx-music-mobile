import { filterMusicInfoListV5 } from './musicInfo'
import { searchByJadeite } from './musicSearch'
import { httpFetch } from '../../request'

const getSingerInfo = async(id) => {
  const { body } = await httpFetch(
    `https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do?resourceType=2002&resourceId=${id}`,
  ).promise
  const resource = body?.resource
  if (!resource || !resource.length) return Promise.reject(new Error('获取歌手信息失败'))
  const info = resource[0]
  return {
    name: info.singer,
    img: info.imgs?.length ? info.imgs[0].img : '',
    desc: info.summary || '',
  }
}

const searchBySinger = async(singerName, singerId, page, pageSize, type) => {
  const searchSwitch = type === 'album'
    ? { song: 0, album: 1, singer: 0, tagSong: 0, mvSong: 0, bestShow: 0, songlist: 0, lyricSong: 0 }
    : { song: 1, album: 0, singer: 0, tagSong: 0, mvSong: 0, bestShow: 0, songlist: 0, lyricSong: 0 }

  const body = await searchByJadeite(singerName, searchSwitch, page, pageSize)

  if (body?.code !== '000000') return { list: [], total: 0 }

  if (type === 'album') {
    const rawList = body.albumResultData?.result || []
    const total = parseInt(body.albumResultData?.totalCount) || 0
    const list = rawList.filter(a => a.id && a.name)
    return { list, total }
  }

  const resultList = body.songResultData?.resultList || []
  const total = parseInt(body.songResultData?.totalCount) || 0
  const songs = []
  resultList.forEach(group => {
    group.forEach(song => {
      if (song.singerList?.some(s => String(s.id) === String(singerId))) {
        songs.push(song)
      }
    })
  })
  return { list: songs, total }
}

export default {
  async getDetail(id, name, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手信息失败'))
    try {
      const info = await getSingerInfo(id)
      return {
        source: 'mg',
        id,
        name: info.name,
        desc: info.desc,
        img: info.img,
      }
    } catch (err) {
      return this.getDetail(id, name, retryNum + 1)
    }
  },

  async getSongs(id, order = 'hot', limit = 100, offset = 0, name, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手歌曲失败'))
    try {
      const singerInfo = await getSingerInfo(id)
      const page = Math.floor(offset / limit) + 1
      const { list: rawSongs, total } = await searchBySinger(singerInfo.name, id, page, limit, 'song')

      const list = filterMusicInfoListV5(rawSongs)

      return {
        list,
        total,
        hasMore: offset + limit < total,
      }
    } catch (err) {
      return this.getSongs(id, order, limit, offset, name, retryNum + 1)
    }
  },

  async getAlbums(id, limit = 100, offset = 0, name, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手专辑失败'))
    try {
      const singerInfo = await getSingerInfo(id)
      const page = Math.floor(offset / limit) + 1
      const { list: rawAlbums, total } = await searchBySinger(singerInfo.name, id, page, limit, 'album')

      const hotAlbums = rawAlbums.map(album => ({
        id: album.id,
        name: album.name,
        picUrl: album.imgItems?.length ? album.imgItems[0].img : '',
        artistName: album.singer || singerInfo.name,
        artistId: id,
        artists: [{ id: String(id), name: album.singer || singerInfo.name }],
        size: 0,
        publishTime: album.publishDate || '',
        source: 'mg',
      }))

      return {
        hotAlbums,
        hasMore: offset + limit < total,
      }
    } catch (err) {
      return this.getAlbums(id, limit, offset, name, retryNum + 1)
    }
  },
}
