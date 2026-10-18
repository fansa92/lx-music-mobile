import { signRequest } from './utils'
import { formatPlayTime, sizeFormate } from '../../index'

const getSinger = (singers) => {
  if (!singers || !Array.isArray(singers)) return ''
  return singers.map(s => s.name).join('、')
}

export default {
  async getDetail(id, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手信息失败'))
    try {
      const result = await signRequest({
        comm: {
          ct: '11',
          cv: '14090508',
          v: '14090508',
          tmeAppID: 'qqmusic',
        },
        req: {
          module: 'music.musicserviceSinger.SingerInfoInterface',
          method: 'GetSingerDetail',
          param: {
            singer_id: 0,
            singer_mid: id,
          },
        },
      })
      const body = result.body
      if (!body || body.code !== 0 || !body.req || body.req.code !== 0) {
        return this.getDetail(id, retryNum + 1)
      }
      const singer = body.req.data?.singer_info
      if (!singer) return Promise.reject(new Error('获取歌手信息失败'))
      return {
        source: 'tx',
        id: String(singer.id ?? id),
        name: singer.name || '',
        desc: singer.brief || '',
        img: singer.pic?.pic_url || '',
        albumSize: singer.album_num || 0,
        musicSize: singer.song_num || 0,
      }
    } catch (err) {
      return this.getDetail(id, retryNum + 1)
    }
  },

  async getSongs(id, order = 'hot', limit = 100, offset = 0, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取歌手歌曲失败'))
    try {
      const result = await signRequest({
        comm: {
          ct: '11',
          cv: '14090508',
          v: '14090508',
          tmeAppID: 'qqmusic',
        },
        req: {
          module: 'music.musicserviceSinger.SingerSongListInterface',
          method: 'GetSingerSongList',
          param: {
            singer_id: 0,
            singer_mid: id,
            order: order === 'hot' ? 'listen' : 'time',
            begin: offset,
            num: limit,
          },
        },
      })
      const body = result.body
      if (!body || body.code !== 0 || !body.req || body.req.code !== 0) {
        return this.getSongs(id, order, limit, offset, retryNum + 1)
      }
      const songList = body.req.data?.song_list || []
      const total = body.req.data?.total || 0
      const list = songList.map(item => {
        const song = item.song_info || item
        if (!song) return null
        const file = song.file || {}
        const types = []
        const _types = {}
        if (file.size_128mp3 != 0) {
          const size = sizeFormate(file.size_128mp3)
          types.push({ type: '128k', size })
          _types['128k'] = { size }
        }
        if (file.size_320mp3 !== 0) {
          const size = sizeFormate(file.size_320mp3)
          types.push({ type: '320k', size })
          _types['320k'] = { size }
        }
        if (file.size_flac !== 0) {
          const size = sizeFormate(file.size_flac)
          types.push({ type: 'flac', size })
          _types.flac = { size }
        }
        if (file.size_hires !== 0) {
          const size = sizeFormate(file.size_hires)
          types.push({ type: 'hires', size })
          _types.hires = { size }
        }
        const albumId = song.album?.mid || ''
        return {
          singer: getSinger(song.singer),
          name: song.title || '',
          albumName: song.album?.name || '',
          albumId,
          source: 'tx',
          interval: formatPlayTime(song.interval),
          songId: song.id ?? 0,
          albumMid: albumId,
          strMediaMid: song.file?.media_mid || '',
          songmid: song.mid || '',
          img: (albumId === '' || albumId === '空')
            ? song.singer?.length ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${song.singer[0].mid}.jpg` : ''
            : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumId}.jpg`,
          lrc: null,
          otherSource: null,
          types,
          _types,
          typeUrl: {},
        }
      }).filter(Boolean)
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
      const result = await signRequest({
        comm: {
          ct: '11',
          cv: '14090508',
          v: '14090508',
          tmeAppID: 'qqmusic',
        },
        req: {
          module: 'music.musicserviceSinger.SingerAlbumListInterface',
          method: 'GetSingerAlbumList',
          param: {
            singer_id: 0,
            singer_mid: id,
            begin: offset,
            num: limit,
          },
        },
      })
      const body = result.body
      if (!body || body.code !== 0 || !body.req || body.req.code !== 0) {
        return this.getAlbums(id, limit, offset, retryNum + 1)
      }
      const albumList = body.req.data?.album_list || []
      const total = body.req.data?.total || 0
      const hotAlbums = albumList.map(item => {
        const album = item.album_info
        if (!album) return null
        return {
          id: String(album.id ?? ''),
          name: album.name || '',
          picUrl: album.mid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${album.mid}.jpg` : '',
          artistName: album.singer?.[0]?.name || '',
          artistId: album.singer?.[0]?.id ? String(album.singer[0].id) : '',
          size: 0,
          publishTime: album.publish_date || '',
          source: 'tx',
        }
      }).filter(Boolean)
      return {
        hotAlbums,
        hasMore: offset + limit < total,
      }
    } catch (err) {
      return this.getAlbums(id, limit, offset, retryNum + 1)
    }
  },
}
