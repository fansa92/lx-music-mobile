import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import PageContent from '@/components/PageContent'
import Header from './Header'
import OnlineList, { type OnlineListType } from '@/components/OnlineList'
import wyApi from '@/utils/musicSdk/wy/album'
import kgApi from '@/utils/musicSdk/kg/album'
import kwApi from '@/utils/musicSdk/kw/album'
import mgApi from '@/utils/musicSdk/mg/album'
import txApi from '@/utils/musicSdk/tx/album'
import { createStyle, toast } from '@/utils/tools'
import { setComponentId } from '@/core/common'
import PlayerBar from '@/components/player/PlayerBar'
import { COMPONENT_IDS, LIST_IDS } from '@/config/constant'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { toNewMusicInfo } from '@/utils'

export interface AlbumInfo {
  id: string
  name: string
  author?: string
  img?: string
  artists?: Array<{ id: string, name: string }>
  size?: number
  publishTime?: number
  source?: string
}

const getApi = (source?: string) => {
  switch (source) {
    case 'kg': return kgApi
    case 'kw': return kwApi
    case 'mg': return mgApi
    case 'tx': return txApi
    default: return wyApi
  }
}

export default memo(({ componentId, albumInfo }: { componentId: string, albumInfo: AlbumInfo }) => {
  const [albumDetail, setAlbumDetail] = useState<{ info: any, list: LX.Music.MusicInfoOnline[] }>({ info: null, list: [] })
  const listRef = useRef<OnlineListType>(null)
  const api = getApi(albumInfo.source)

  const loadAlbum = useCallback((isRefresh = false) => {
    listRef.current?.setStatus(isRefresh ? 'refreshing' : 'loading')
    // 部分源（QQ音乐、酷狗等）需要专辑名来检索歌曲，这里把名字一起传过去
    api.getAlbum(albumInfo.id, albumInfo.name).then((data: { info: any, list: any[] }) => {
      const convertedList = data.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]
      // 接口没返回的字段保留列表页带过来的信息
      setAlbumDetail({ info: { ...albumInfo, ...data.info }, list: convertedList })
      listRef.current?.setList(convertedList, false, false)
      listRef.current?.setStatus('end')
    }).catch(() => {
      toast(isRefresh ? '刷新专辑信息失败' : '获取专辑信息失败')
      listRef.current?.setStatus('error')
    })
  }, [albumInfo.id, albumInfo.name])

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
