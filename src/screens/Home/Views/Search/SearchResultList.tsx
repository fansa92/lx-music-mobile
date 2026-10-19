import { forwardRef, useImperativeHandle, useRef, useState, useCallback, memo } from 'react'
import { FlatList, RefreshControl, TouchableOpacity, View } from 'react-native'
import musicSdk from '@/utils/musicSdk'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import Badge from '@/components/common/Badge'
import { BorderRadius } from '@/theme'
import { scaleSizeW } from '@/utils/pixelRatio'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { useI18n } from '@/lang'

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

const ARTIST_ALBUM_SOURCES: LX.OnlineSource[] = ['kw', 'wy', 'tx', 'kg', 'mg']

const handleItemPress = (searchType: SearchType, item: ListItem) => {
  const componentId = commonState.componentIds.home
  if (!componentId) return

  if (searchType === 'artist') {
    navigations.pushArtistDetailScreen(componentId, { id: String(item.id), name: item.name, source: item.source })
  } else {
    const albumItem = item as AlbumItem
    navigations.pushAlbumDetailScreen(componentId, {
      id: String(albumItem.id),
      name: albumItem.name,
      author: albumItem.artistName,
      img: albumItem.picUrl,
      size: albumItem.size,
      publishTime: albumItem.publishTime ? new Date(albumItem.publishTime).getTime() : undefined,
      source: albumItem.source,
    })
  }
}

const ArtistItemComp = memo(({ item, showSource }: { item: ArtistItem, showSource: boolean }) => {
  const theme = useTheme()
  const t = useI18n()
  const alias = item.alias?.length ? item.alias.join('/') : ''
  const countInfo = (item.albumSize != null || item.musicSize != null)
    ? t('search_artist_count', { album: item.albumSize ?? 0, music: item.musicSize ?? 0 })
    : ''

  return (
    <TouchableOpacity style={styles.item} onPress={() => { handleItemPress('artist', item) }} activeOpacity={0.6}>
      <Image
        url={item.picUrl}
        style={{ ...styles.avatar, borderColor: theme['c-border-background'] }}
        resizeMode="cover"
      />
      <View style={styles.itemContent}>
        <Text numberOfLines={1} color={theme['c-font']}>{item.name}</Text>
        {alias ? <Text numberOfLines={1} size={12} color={theme['c-font-label']}>{alias}</Text> : null}
        {countInfo ? <Text numberOfLines={1} size={11} color={theme['c-font-label']}>{countInfo}</Text> : null}
      </View>
      {showSource ? <Badge type="tertiary">{item.source}</Badge> : null}
    </TouchableOpacity>
  )
})

const AlbumItemComp = memo(({ item, showSource }: { item: AlbumItem, showSource: boolean }) => {
  const theme = useTheme()

  return (
    <TouchableOpacity style={styles.item} onPress={() => { handleItemPress('album', item) }} activeOpacity={0.6}>
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
      {showSource ? <Badge type="tertiary">{item.source}</Badge> : null}
    </TouchableOpacity>
  )
})

export default forwardRef<SearchResultListType, SearchResultListProps>(({ searchType }, ref) => {
  const [list, setList] = useState<ListItem[]>([])
  const [showSource, setShowSource] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const searchInfoRef = useRef({ text: '', page: 1, hasMore: true, source: 'kw' as string })
  // 用 ref 做并发锁，避免 onEndReached 连发时重复请求同一页
  const loadingRef = useRef(false)
  // 请求序号，用于丢弃过期响应
  const genRef = useRef(0)
  const theme = useTheme()

  const doSearch = useCallback(async(text: string, page: number, source: string): Promise<SearchResult> => {
    if (source === 'all') {
      const tasks = ARTIST_ALBUM_SOURCES.map(async(s) => {
        const sdk = musicSdk[s] as any
        const method = searchType === 'artist' ? sdk.musicSearch.searchArtist : sdk.musicSearch.searchAlbum
        return (method.call(sdk.musicSearch, text, page) as Promise<SearchResult>).catch(() => ({ list: [], total: 0, allPage: 0, limit: 20, source: s }))
      })
      return Promise.all(tasks).then(results => ({
        list: results.flatMap(r => r.list),
        total: results.reduce((sum, r) => sum + r.total, 0),
        allPage: Math.max(...results.map(r => r.allPage)),
        limit: 20,
        source: 'all',
      }))
    }
    const sdk = musicSdk[source as keyof typeof musicSdk] as any
    if (!sdk?.musicSearch) return Promise.reject(new Error('source not found'))

    if (searchType === 'artist') {
      return sdk.musicSearch.searchArtist(text, page)
    } else {
      return sdk.musicSearch.searchAlbum(text, page)
    }
  }, [searchType])

  const handleLoad = useCallback((text: string, page: number, source: string, isRefresh = false) => {
    if (!isRefresh) {
      if (loadingRef.current || !searchInfoRef.current.hasMore) return
    }
    // 每次加载分配一个序号，新的搜索/刷新会让旧请求的结果失效，避免旧响应覆盖新列表
    const gen = ++genRef.current
    loadingRef.current = true
    setLoading(true)
    if (isRefresh) setRefreshing(true)

    doSearch(text, page, source).then(result => {
      if (gen !== genRef.current) return
      setList(prev => isRefresh ? result.list : [...prev, ...result.list])
      searchInfoRef.current.page = page + 1
      searchInfoRef.current.hasMore = result.list.length > 0 && page < result.allPage
    }).catch((err) => {
      if (gen !== genRef.current) return
      // 请求失败后停止自动翻页，否则列表为空时 onEndReached 会被反复触发，表现为一直刷新
      searchInfoRef.current.hasMore = false
      console.log('SearchResultList error:', err)
    }).finally(() => {
      if (gen !== genRef.current) return
      loadingRef.current = false
      setLoading(false)
      setRefreshing(false)
    })
  }, [doSearch])

  useImperativeHandle(ref, () => ({
    loadList(text: string, source: string) {
      searchInfoRef.current = { text, page: 1, hasMore: true, source }
      setList([])
      // 聚合搜索时才展示来源标签，与歌曲/歌单列表保持一致
      setShowSource(source === 'all')
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
      return <ArtistItemComp item={item as ArtistItem} showSource={showSource} />
    }
    return <AlbumItemComp item={item as AlbumItem} showSource={showSource} />
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
