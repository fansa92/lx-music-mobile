import { forwardRef, useImperativeHandle, useRef, useState, useCallback, memo } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'
import musicSdk from '@/utils/musicSdk'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { BorderRadius } from '@/theme'
import { scaleSizeW } from '@/utils/pixelRatio'

type SearchType = 'artist' | 'album'

interface ArtistItem {
  id: number | string
  name: string
  picUrl: string
  alias?: string[]
  albumSize?: number
  musicSize?: number
  source: string
}

interface AlbumItem {
  id: number | string
  name: string
  picUrl: string
  artistName: string
  artistId?: string | number
  size?: number
  publishTime?: string
  source: string
}

type ListItem = ArtistItem | AlbumItem

interface SearchResult {
  list: ListItem[]
  total: number
  allPage: number
  limit: number
  source: string
}

export interface SearchResultListType {
  loadList: (text: string, source: string) => void
}

interface SearchResultListProps {
  searchType: SearchType
}

const imgSize = scaleSizeW(60)

const ArtistItem = memo(({ item }: { item: ArtistItem }) => {
  const theme = useTheme()
  const alias = item.alias?.length ? item.alias.join('/') : ''

  return (
    <View style={styles.item}>
      <Image
        url={item.picUrl}
        style={{ ...styles.avatar, borderColor: theme['c-border-background'] }}
        resizeMode="cover"
      />
      <View style={styles.itemContent}>
        <Text numberOfLines={1} color={theme['c-font']}>{item.name}</Text>
        {alias ? <Text numberOfLines={1} size={12} color={theme['c-font-label']}>{alias}</Text> : null}
        {item.albumSize != null ? (
          <Text size={11} color={theme['c-font-label']}>
            {item.albumSize} {item.albumSize > 1 ? 'albums' : 'album'}
          </Text>
        ) : null}
      </View>
    </View>
  )
})

const AlbumItem = memo(({ item }: { item: AlbumItem }) => {
  const theme = useTheme()

  return (
    <View style={styles.item}>
      <Image
        url={item.picUrl}
        style={{ ...styles.cover, borderColor: theme['c-border-background'] }}
        resizeMode="cover"
      />
      <View style={styles.itemContent}>
        <Text numberOfLines={1} color={theme['c-font']}>{item.name}</Text>
        {item.artistName ? <Text numberOfLines={1} size={12} color={theme['c-font-label']}>{item.artistName}</Text> : null}
        {item.publishTime ? (
          <Text size={11} color={theme['c-font-label']}>{item.publishTime}</Text>
        ) : null}
      </View>
    </View>
  )
})

export default forwardRef<SearchResultListType, SearchResultListProps>(({ searchType }, ref) => {
  const [list, setList] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const searchInfoRef = useRef({ text: '', page: 1, hasMore: true, source: 'kw' as string })
  const theme = useTheme()

  const doSearch = useCallback((text: string, page: number, source: string): Promise<SearchResult> => {
    const sdk = musicSdk[source as keyof typeof musicSdk] as any
    if (!sdk?.musicSearch) return Promise.reject(new Error('source not found'))

    if (searchType === 'artist') {
      return sdk.musicSearch.searchArtist(text, page)
    } else {
      return sdk.musicSearch.searchAlbum(text, page)
    }
  }, [searchType])

  const handleLoad = useCallback((text: string, page: number, source: string, isRefresh = false) => {
    if (loading || (!isRefresh && !searchInfoRef.current.hasMore)) return
    setLoading(true)
    if (isRefresh) setRefreshing(true)

    doSearch(text, page, source).then(result => {
      const newList = isRefresh ? result.list : [...list, ...result.list]
      setList(newList)
      searchInfoRef.current.page = page + 1
      searchInfoRef.current.hasMore = result.list.length > 0 && page < result.allPage
    }).catch((err) => {
      console.log('SearchResultList error:', err)
    }).finally(() => {
      setLoading(false)
      setRefreshing(false)
    })
  }, [loading, list, doSearch])

  useImperativeHandle(ref, () => ({
    loadList(text: string, source: string) {
      searchInfoRef.current = { text, page: 1, hasMore: true, source }
      setList([])
      handleLoad(text, 1, source, true)
    },
  }))

  const handleRefresh = useCallback(() => {
    const { text, source } = searchInfoRef.current
    searchInfoRef.current.page = 1
    searchInfoRef.current.hasMore = true
    handleLoad(text, 1, source, true)
  }, [handleLoad])

  const handleLoadMore = useCallback(() => {
    const { text, page, source } = searchInfoRef.current
    handleLoad(text, page, source)
  }, [handleLoad])

  const renderItem = ({ item }: { item: ListItem }) => {
    if (searchType === 'artist') {
      return <ArtistItem item={item as ArtistItem} />
    }
    return <AlbumItem item={item as AlbumItem} />
  }

  const keyExtractor = (item: ListItem) => `${item.source}_${item.id}`

  return (
    <FlatList
      data={list}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          colors={[theme['c-primary']]}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      }
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <Text color={theme['c-font-label']}>No results</Text>
          </View>
        ) : null
      }
    />
  )
})

const styles = createStyle({
  item: {
    flexDirection: 'row',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  avatar: {
    width: imgSize,
    height: imgSize,
    borderRadius: imgSize / 2,
    borderWidth: BorderRadius.normal,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  cover: {
    width: imgSize,
    height: imgSize,
    borderRadius: BorderRadius.normal,
    borderWidth: BorderRadius.normal,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  itemContent: {
    flex: 1,
    paddingLeft: 12,
    gap: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
})
