import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import PageContent from '@/components/PageContent'
import Header from './Header'
import OnlineList, { type OnlineListType } from '@/components/OnlineList'
import wyApi from '@/utils/musicSdk/wy/album'
import { createStyle, toast } from '@/utils/tools'
import { setComponentId } from '@/core/common'
import PlayerBar from '@/components/player/PlayerBar'
import { COMPONENT_IDS, LIST_IDS } from '@/config/constant'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'

export interface AlbumInfo {
  id: string
  name: string
  author?: string
  img?: string
  artists?: Array<{ id: string, name: string }>
  size?: number
  publishTime?: number
}

export default memo(({ componentId, albumInfo }: { componentId: string, albumInfo: AlbumInfo }) => {
  const [albumDetail, setAlbumDetail] = useState<{ info: any, list: LX.Music.MusicInfoOnline[] }>({ info: null, list: [] })
  const listRef = useRef<OnlineListType>(null)

  const loadAlbum = useCallback((isRefresh = false) => {
    listRef.current?.setStatus(isRefresh ? 'refreshing' : 'loading')
    wyApi.getAlbum(albumInfo.id).then((data: { info: any, list: LX.Music.MusicInfoOnline[] }) => {
      setAlbumDetail(data)
      listRef.current?.setList(data.list, false, false)
      listRef.current?.setStatus('end')
    }).catch(() => {
      toast(isRefresh ? '刷新专辑信息失败' : '获取专辑信息失败')
      listRef.current?.setStatus('error')
    })
  }, [albumInfo.id])

  useEffect(() => {
    setComponentId(COMPONENT_IDS.albumDetail, componentId)
    loadAlbum()
  }, [componentId, loadAlbum])

  const handlePlayList = useCallback((index: number) => {
    if (!albumDetail.list.length) return
    const listId = `album_${albumInfo.id}`
    void setTempList(listId, [...albumDetail.list]).then(() => {
      void playList(LIST_IDS.TEMP, index)
    })
  }, [albumDetail.list, albumInfo.id])

  return (
    <PageContent>
      <View style={styles.container}>
        <Header albumInfo={albumDetail.info || albumInfo} componentId={componentId} />
        <OnlineList
          ref={listRef}
          onPlayList={handlePlayList}
          onRefresh={() => { loadAlbum(true) }}
          onLoadMore={() => {}}
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
