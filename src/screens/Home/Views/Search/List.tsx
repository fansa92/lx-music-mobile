import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type { InitState as SearchState } from '@/store/search/state'
import type { Source as MusicSource } from '@/store/search/music/state'
import type { Source as SongListSource } from '@/store/search/songlist/state'
import MusicList, { type MusicListType } from './MusicList'
import BlankView, { type BlankViewType } from './BlankView'
import SonglistList from './SonglistList'
import SearchResultList, { type SearchResultListType } from './SearchResultList'

interface ListProps {
  onSearch: (keyword: string) => void
}
export interface ListType {
  loadList: (text: string, source: MusicSource | SongListSource, type: SearchState['searchType']) => void
}

export default forwardRef<ListType, ListProps>(({ onSearch }, ref) => {
  const [listType, setListType] = useState<SearchState['searchType']>('music')
  const [showBlankView, setShowListView] = useState(true)
  const listRef = useRef<MusicListType>(null)
  const blankViewRef = useRef<BlankViewType>(null)
  const artistListRef = useRef<SearchResultListType>(null)
  const albumListRef = useRef<SearchResultListType>(null)

  useImperativeHandle(ref, () => ({
    loadList(text, source, type) {
      if (text) {
        setShowListView(false)
        setListType(type)
        requestAnimationFrame(() => {
          if (type === 'artist') {
            artistListRef.current?.loadList(text, source)
          } else if (type === 'album') {
            albumListRef.current?.loadList(text, source)
          } else {
            listRef.current?.loadList(text, source)
          }
        })
      } else {
        setShowListView(true)
        requestAnimationFrame(() => {
          blankViewRef.current?.show(source)
        })
      }
    },
  }), [])

  const renderList = () => {
    switch (listType) {
      case 'songlist':
        return <SonglistList ref={listRef} />
      case 'artist':
        return <SearchResultList ref={artistListRef} searchType="artist" />
      case 'album':
        return <SearchResultList ref={albumListRef} searchType="album" />
      case 'music':
      default:
        return <MusicList ref={listRef} />
    }
  }

  return showBlankView ? <BlankView ref={blankViewRef} onSearch={onSearch} /> : renderList()
})
