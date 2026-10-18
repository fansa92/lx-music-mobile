import { signRequest } from './utils'
import { formatSingerName } from '../utils'

export default {
  async getAlbum(id, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取专辑详情失败'))
    try {
      const result = await signRequest({
        comm: {
          ct: '11',
          cv: '14090508',
          v: '14090508',
          tmeAppID: 'qqmusic',
        },
        req: {
          module: 'music.musicserviceAlbum.AlbumInfoInterface',
          method: 'GetAlbumDetail',
          param: {
            album_id: id,
            album_mid: '',
          },
        },
      })
      const body = result.body
      if (!body || body.code !== 0 || !body.req || body.req.code !== 0) {
        return this.getAlbum(id, retryNum + 1)
      }
      const albumInfo = body.req.data?.album_info
      const songList = body.req.data?.song_list || []
      if (!albumInfo) return Promise.reject(new Error('获取专辑详情失败'))

      const list = songList.map(item => {
        const song = item.song_info
        if (!song) return null
        const file = song.file || {}
        const types = []
        const _types = {}
        if (file.size_128mp3) {
          types.push({ type: '128k', size: null })
          _types['128k'] = { size: null }
        }
        if (file.size_320mp3) {
          types.push({ type: '320k', size: null })
          _types['320k'] = { size: null }
        }
        if (file.size_flac) {
          types.push({ type: 'flac', size: null })
          _types.flac = { size: null }
        }
        if (file.size_hires) {
          types.push({ type: 'hires', size: null })
          _types.hires = { size: null }
        }
        return {
          singer: formatSingerName(song.singer),
          name: song.name || '',
          albumName: albumInfo.name || '',
          albumId: String(albumInfo.id ?? id),
          source: 'tx',
          interval: null,
          songmid: song.mid || '',
          img: albumInfo.mid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumInfo.mid}.jpg` : '',
          lrc: null,
          otherSource: null,
          types,
          _types,
          typeUrl: {},
        }
      }).filter(Boolean)

      return {
        list,
        info: {
          name: albumInfo.name || '',
          img: albumInfo.mid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumInfo.mid}.jpg` : '',
          desc: albumInfo.brief || '',
          author: albumInfo.singer?.[0]?.name || '',
        },
      }
    } catch (err) {
      return this.getAlbum(id, retryNum + 1)
    }
  },
}
