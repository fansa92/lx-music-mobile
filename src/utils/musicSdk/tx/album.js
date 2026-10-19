import musicSearchApi from './musicSearch'
import { desktopSearch, formatTxImg, getAlbumCover, parseTime } from './utils'

const SONG_PAGE_MAX = 50
// 专辑里也可能有几十首歌，最多翻 3 页
const MAX_SONG_PAGE = 3

const uniqueByMid = (list) => {
  const mids = new Set()
  return list.filter(item => {
    if (!item.mid || mids.has(item.mid)) return false
    mids.add(item.mid)
    return true
  })
}

export default {
  async getAlbum(id, name = '', retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('获取专辑详情失败'))
    if (!id) throw new Error('缺少专辑ID')
    try {
      let albumInfo = null
      const songs = []

      if (name) {
        // 专辑信息：搜专辑名后按专辑 mid 匹配
        const { body: albumBody } = await desktopSearch(2, name, 1, 30)
        albumInfo = (albumBody.album?.list ?? []).find(item => item.albumMID === id) || null

        // 歌曲列表：搜歌曲后按歌曲所属专辑 mid 过滤
        for (let page = 1; page <= MAX_SONG_PAGE; page++) {
          const { body } = await desktopSearch(0, name, page, SONG_PAGE_MAX)
          const pageList = body.song?.list ?? []
          songs.push(...pageList.filter(item => item.album?.mid === id))
          if (pageList.length < SONG_PAGE_MAX) break
        }
      }

      const songList = uniqueByMid(songs)
      if (!albumInfo && !songList.length) throw new Error('获取专辑详情失败')

      const list = musicSearchApi.handleResult(songList)
      const firstSinger = songList[0]?.singer?.[0]
      const author = albumInfo?.singerName || firstSinger?.name || ''
      const authorId = albumInfo?.singerMID || firstSinger?.mid || ''

      return {
        list,
        info: {
          name: albumInfo?.albumName || name || '',
          img: getAlbumCover(id) || formatTxImg(albumInfo?.albumPic),
          desc: '',
          author,
          artists: author ? [{ id: authorId, name: author }] : [],
          size: albumInfo?.song_count || list.length,
          publishTime: parseTime(albumInfo?.publicTime),
        },
      }
    } catch (err) {
      return this.getAlbum(id, name, retryNum + 1)
    }
  },
}
