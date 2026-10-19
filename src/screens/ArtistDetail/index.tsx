import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import PageContent from '@/components/PageContent'
import Header from './Header'
import SongList from './SongList'
import wyApi from '@/utils/musicSdk/wy/artist'
import kgApi from '@/utils/musicSdk/kg/artist'
import kwApi from '@/utils/musicSdk/kw/artist'
import txApi from '@/utils/musicSdk/tx/artist'
import mgApi from '@/utils/musicSdk/mg/artist'
import { createStyle, toast } from '@/utils/tools'
import { setComponentId } from '@/core/common'
import PlayerBar from '@/components/player/PlayerBar'
import { COMPONENT_IDS, LIST_IDS } from '@/config/constant'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { toNewMusicInfo } from '@/utils'

// 单页数量要跟各源接口的上限保持一致（QQ音乐搜索接口单页最多 60 首歌 / 40 张专辑）
const SONG_LIMIT = 50
const ALBUM_LIMIT = 30

export interface ArtistInfo {
  id: string
  name: string
  source?: string
}

const getApi = (source?: string) => {
  switch (source) {
    case 'kg': return kgApi
    case 'kw': return kwApi
    case 'tx': return txApi
    case 'mg': return mgApi
    default: return wyApi
  }
}

interface SongsState {
  list: LX.Music.MusicInfoOnline[]
  hasMore: boolean
  page: number
  loading: boolean
  sort: string
  error: boolean
}

interface AlbumsState {
  list: any[]
  hasMore: boolean
  page: number
  loading: boolean
  error: boolean
}

export default memo(({ componentId, artistInfo }: { componentId: string, artistInfo: ArtistInfo }) => {
  const [artistDetail, setArtistDetail] = useState<any>(null)
  const [songs, setSongs] = useState<SongsState>({ list: [], hasMore: true, page: 1, loading: false, sort: 'hot', error: false })
  const [albums, setAlbums] = useState<AlbumsState>({ list: [], hasMore: true, page: 1, loading: false, error: false })
  const [activeTab, setActiveTab] = useState<'songs' | 'albums'>('songs')
  const loadingSongRef = useRef(false)
  const loadingAlbumRef = useRef(false)
  const api = getApi(artistInfo.source)

  useEffect(() => {
    setComponentId(COMPONENT_IDS.artistDetail, componentId)
    // 部分源（酷我、QQ音乐）的歌手详情需要歌手名来检索，这里把名字一起传过去
    api.getDetail(artistInfo.id, artistInfo.name).then((data: any) => {
      // 接口没返回的字段保留列表页带过来的信息（比如名字）
      setArtistDetail({ ...artistInfo, ...data })
    }).catch(() => {})
  }, [componentId, artistInfo.id, artistInfo.name])

  const loadSongs = useCallback((sort: string, page: number, isRefresh = false) => {
    if (loadingSongRef.current) return
    if (!isRefresh && !songs.hasMore) return
    loadingSongRef.current = true
    setSongs(p => ({ ...p, loading: true, error: false }))
    const offset = (page - 1) * SONG_LIMIT
    api.getSongs(artistInfo.id, sort, SONG_LIMIT, offset, artistInfo.name).then((data: { list: any[], hasMore: boolean }) => {
      const convertedList = data.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]
      setSongs(p => ({
        ...p,
        list: page === 1 ? convertedList : [...p.list, ...convertedList],
        hasMore: data.hasMore,
        page: page + 1,
        loading: false,
        sort,
        error: false,
      }))
    }).catch(() => {
      toast('获取歌曲失败')
      setSongs(p => ({ ...p, loading: false, error: true }))
    }).finally(() => {
      loadingSongRef.current = false
    })
  }, [artistInfo.id, artistInfo.name, songs.hasMore])

  const loadAlbums = useCallback((page: number, isRefresh = false) => {
    if (loadingAlbumRef.current) return
    if (!isRefresh && !albums.hasMore) return
    loadingAlbumRef.current = true
    setAlbums(p => ({ ...p, loading: true, error: false }))
    const offset = (page - 1) * ALBUM_LIMIT
    api.getAlbums(artistInfo.id, ALBUM_LIMIT, offset, artistInfo.name).then((data: { hotAlbums: any[], hasMore: boolean }) => {
      setAlbums(p => ({
        ...p,
        list: page === 1 ? data.hotAlbums : [...p.list, ...data.hotAlbums],
        hasMore: data.hasMore,
        page: page + 1,
        loading: false,
        error: false,
      }))
    }).catch(() => {
      toast('获取专辑失败')
      setAlbums(p => ({ ...p, loading: false, error: true }))
    }).finally(() => {
      loadingAlbumRef.current = false
    })
  }, [artistInfo.id, artistInfo.name, albums.hasMore])

  useEffect(() => {
    loadSongs(songs.sort, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeTab === 'albums' && albums.list.length === 0 && !albums.error) loadAlbums(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const handleSortChange = useCallback((newSort: 'hot' | 'time') => {
    if (newSort === songs.sort) return
    setSongs(p => ({ ...p, sort: newSort, list: [], page: 1, hasMore: true, error: false }))
    loadSongs(newSort, 1, true)
  }, [songs.sort, loadSongs])

  const handleTabChange = useCallback((tab: 'songs' | 'albums') => {
    if (tab === activeTab) return
    setActiveTab(tab)
  }, [activeTab])

  const handleRefresh = useCallback(() => {
    api.getDetail(artistInfo.id, artistInfo.name).then((data: any) => {
      setArtistDetail({ ...artistInfo, ...data })
    }).catch(() => { toast('刷新歌手信息失败') })
    if (activeTab === 'songs') {
      loadSongs(songs.sort, 1, true)
    } else {
      loadAlbums(1, true)
    }
  }, [activeTab, songs.sort, loadSongs, loadAlbums, artistInfo.id, artistInfo.name])

  const handlePlayList = useCallback((index: number) => {
    if (!songs.list.length) return
    const listId = `artist_detail_${artistInfo.id}`
    void setTempList(listId, [...songs.list]).then(() => {
      void playList(LIST_IDS.TEMP, index)
    })
  }, [songs.list, artistInfo.id])

  const displayArtist = artistDetail || artistInfo

  return (
    <PageContent>
      <View style={styles.container}>
        <Header artist={displayArtist} componentId={componentId} />
        <SongList
          componentId={componentId}
          songs={songs}
          albums={albums}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLoadMoreSongs={() => { loadSongs(songs.sort, songs.page) }}
          onLoadMoreAlbums={() => { loadAlbums(albums.page) }}
          onSortChange={handleSortChange}
          onRefresh={handleRefresh}
          onPlayList={handlePlayList}
        />
        <PlayerBar />
      </View>
    </PageContent>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
})
