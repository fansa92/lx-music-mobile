import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import PageContent from '@/components/PageContent'
import Header from './Header'
import SongList from './SongList'
import wyApi from '@/utils/musicSdk/wy/artist'
import kgApi from '@/utils/musicSdk/kg/artist'
import txApi from '@/utils/musicSdk/tx/artist'
import { createStyle, toast } from '@/utils/tools'
import { setComponentId } from '@/core/common'
import PlayerBar from '@/components/player/PlayerBar'
import { COMPONENT_IDS, LIST_IDS } from '@/config/constant'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { toNewMusicInfo } from '@/utils'

const SONG_LIMIT = 100
const ALBUM_LIMIT = 100

export interface ArtistInfo {
  id: string
  name: string
  source?: string
}

const getApi = (source?: string) => {
  switch (source) {
    case 'kg': return kgApi
    case 'tx': return txApi
    default: return wyApi
  }
}

interface SongsState {
  list: LX.Music.MusicInfoOnline[]
  hasMore: boolean
  page: number
  loading: boolean
  sort: string
}

interface AlbumsState {
  list: any[]
  hasMore: boolean
  page: number
  loading: boolean
}

export default memo(({ componentId, artistInfo }: { componentId: string, artistInfo: ArtistInfo }) => {
  const [artistDetail, setArtistDetail] = useState<any>(null)
  const [songs, setSongs] = useState<SongsState>({ list: [], hasMore: true, page: 1, loading: false, sort: 'hot' })
  const [albums, setAlbums] = useState<AlbumsState>({ list: [], hasMore: true, page: 1, loading: false })
  const [activeTab, setActiveTab] = useState<'songs' | 'albums'>('songs')
  const loadingSongRef = useRef(false)
  const loadingAlbumRef = useRef(false)
  const api = getApi(artistInfo.source)

  useEffect(() => {
    setComponentId(COMPONENT_IDS.artistDetail, componentId)
    api.getDetail(artistInfo.id).then((data: any) => {
      setArtistDetail(data)
    }).catch(() => { toast('获取歌手信息失败') })
  }, [componentId, artistInfo.id])

  const loadSongs = useCallback((sort: string, page: number, isRefresh = false) => {
    if (loadingSongRef.current) return
    if (!isRefresh && !songs.hasMore) return
    loadingSongRef.current = true
    setSongs(p => ({ ...p, loading: true }))
    const offset = (page - 1) * SONG_LIMIT
    api.getSongs(artistInfo.id, sort, SONG_LIMIT, offset).then((data: { list: any[], hasMore: boolean }) => {
      const convertedList = data.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]
      setSongs(p => ({
        ...p,
        list: page === 1 ? convertedList : [...p.list, ...convertedList],
        hasMore: data.hasMore,
        page: page + 1,
        loading: false,
        sort,
      }))
    }).catch(() => {
      toast('获取歌曲失败')
      setSongs(p => ({ ...p, loading: false }))
    }).finally(() => {
      loadingSongRef.current = false
    })
  }, [artistInfo.id, songs.hasMore])

  const loadAlbums = useCallback((page: number, isRefresh = false) => {
    if (loadingAlbumRef.current) return
    if (!isRefresh && !albums.hasMore) return
    loadingAlbumRef.current = true
    setAlbums(p => ({ ...p, loading: true }))
    const offset = (page - 1) * ALBUM_LIMIT
    api.getAlbums(artistInfo.id, ALBUM_LIMIT, offset).then((data: { hotAlbums: any[], hasMore: boolean }) => {
      setAlbums(p => ({
        ...p,
        list: page === 1 ? data.hotAlbums : [...p.list, ...data.hotAlbums],
        hasMore: data.hasMore,
        page: page + 1,
        loading: false,
      }))
    }).catch(() => {
      toast('获取专辑失败')
      setAlbums(p => ({ ...p, loading: false }))
    }).finally(() => {
      loadingAlbumRef.current = false
    })
  }, [artistInfo.id, albums.hasMore])

  useEffect(() => {
    loadSongs(songs.sort, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeTab === 'albums' && albums.list.length === 0) loadAlbums(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const handleSortChange = useCallback((newSort: 'hot' | 'time') => {
    if (newSort === songs.sort) return
    setSongs(p => ({ ...p, sort: newSort, list: [], page: 1, hasMore: true }))
    loadSongs(newSort, 1, true)
  }, [songs.sort, loadSongs])

  const handleTabChange = useCallback((tab: 'songs' | 'albums') => {
    if (tab === activeTab) return
    setActiveTab(tab)
  }, [activeTab])

  const handleRefresh = useCallback(() => {
    api.getDetail(artistInfo.id).then((data: any) => {
      setArtistDetail(data)
    }).catch(() => { toast('刷新歌手信息失败') })
    if (activeTab === 'songs') {
      loadSongs(songs.sort, 1, true)
    } else {
      loadAlbums(1, true)
    }
  }, [activeTab, songs.sort, loadSongs, loadAlbums, artistInfo.id])

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
