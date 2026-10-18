import { filterMusicInfoListV5 } from './musicInfo'
import { toMD5 } from '../utils'
import { httpFetch } from '../../request'

const createSignature = (time, str) => {
  const deviceId = '963B7AA0D21511ED807EE5846EC87D20'
  const signatureMd5 = '6cdc72a439cef99a3418d2a78aa28c73'
  const sign = toMD5(`${str}${signatureMd5}yyapp2d16148780a1dcc7408e06336b98cfd50${deviceId}${time}`)
  return { sign, deviceId }
}

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
  const time = Date.now().toString()
  const signData = createSignature(time, singerName)
  const searchSwitch = type === 'album'
    ? JSON.stringify({ song: 0, album: 1, singer: 0, tagSong: 0, mvSong: 0, bestShow: 0, songlist: 0, lyricSong: 0 })
    : JSON.stringify({ song: 1, album: 0, singer: 0, tagSong: 0, mvSong: 0, bestShow: 0, songlist: 0, lyricSong: 0 })

  const { body } = await httpFetch(
    `https://jadeite.migu.cn/music_search/v3/search/searchAll?isCorrect=0&isCopyright=1&searchSwitch=${encodeURIComponent(searchSwitch)}&pageSize=${pageSize}&text=${encodeURIComponent(singerName)}&pageNo=${page}&sort=0&sid=USS`,
    {
      headers: {
        uiVersion: 'A_music_3.6.1',
        deviceId: signData.deviceId,
        timestamp: time,
        sign: signData.sign,
        channel: '0146921',
        'User-Agent': 'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
      },
    },
  ).promise

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
  async getDetail(id, retryNum = 0) {
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
      return this.getDetail(id, retryNum + 1)
    }
  },

  async getSongs(id, order = 'hot', limit = 100, offset = 0, retryNum = 0) {
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
      return this.getSongs(id, order, limit, offset, retryNum + 1)
    }
  },

  async getAlbums(id, limit = 100, offset = 0, retryNum = 0) {
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
        size: 0,
        publishTime: album.publishDate || '',
        source: 'mg',
      }))

      return {
        hotAlbums,
        hasMore: offset + limit < total,
      }
    } catch (err) {
      return this.getAlbums(id, limit, offset, retryNum + 1)
    }
  },
}
