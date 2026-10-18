import { memo, useMemo } from 'react'
import { FlatList, View, RefreshControl, TouchableOpacity } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { dateFormat } from '@/utils/common'
import { navigations } from '@/navigation'

interface AlbumItem {
  id: string | number
  name: string
  picUrl: string
  artistName: string
  artists?: Array<{ id: string, name: string }>
  size?: number
  publishTime?: number
  source: string
}

interface Props {
  componentId: string
  albums: AlbumItem[]
  loading: boolean
  hasMore: boolean
  onRefresh: () => void
  onLoadMore: () => void
}

export default memo(({ componentId, albums, loading, hasMore, onRefresh, onLoadMore }: Props) => {
  const theme = useTheme()

  const list = useMemo(() => [...albums], [albums])

  const handlePress = (item: AlbumItem) => {
    navigations.pushAlbumDetailScreen(componentId, {
      id: String(item.id),
      name: item.name,
      author: item.artistName,
      img: item.picUrl,
      artists: item.artists,
      size: item.size,
      publishTime: item.publishTime,
    })
  }

  const renderItem = ({ item }: { item: AlbumItem }) => (
    <TouchableOpacity style={styles.item} onPress={() => { handlePress(item) }}>
      <Image url={item.picUrl} style={styles.cover} />
      <Text numberOfLines={1} size={13}>{item.name}</Text>
      <Text numberOfLines={1} size={11} color={theme['c-font-label']}>{item.artistName}</Text>
      <Text size={10} color={theme['c-font-label']}>
        {item.publishTime ? dateFormat(item.publishTime, 'Y.M.D') : ''}
      </Text>
    </TouchableOpacity>
  )

  const footer = () => {
    let text = ''
    if (loading && albums.length > 0) text = '加载中...'
    else if (!hasMore) text = '加载完毕'
    return (
      <View style={styles.footer}>
        <Text color={theme['c-font-label']}>{text}</Text>
      </View>
    )
  }

  return (
    <FlatList
      numColumns={2}
      data={list}
      renderItem={renderItem}
      keyExtractor={item => String(item.id)}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={footer}
      refreshControl={
        <RefreshControl
          colors={[theme['c-primary']]}
          refreshing={loading && albums.length === 0}
          onRefresh={onRefresh}
        />
      }
    />
  )
})

const styles = createStyle({
  item: {
    flex: 1,
    padding: 8,
  },
  cover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  footer: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
  },
})
