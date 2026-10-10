import { memo, useCallback, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { FlatList, View, TouchableOpacity } from 'react-native'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Badge from '@/components/common/Badge'
import { usePlayInfo } from '@/store/player/hook'
import { playList } from '@/core/player/player'
import { getList } from '@/core/player/playInfo'

const ITEM_HEIGHT = scaleSizeH(48)

const ListItem = memo(({ item, index, activeIndex, onPress }: {
  item: LX.Music.MusicInfo
  index: number
  activeIndex: number
  onPress: (index: number) => void
}) => {
  const theme = useTheme()
  const active = activeIndex === index

  return (
    <TouchableOpacity
      style={{ ...styles.listItem, height: ITEM_HEIGHT, backgroundColor: active ? theme['c-primary-background-hover'] : 'rgba(0,0,0,0)' }}
      activeOpacity={0.5}
      onPress={() => onPress(index)}
    >
      {
        active
          ? <Icon style={styles.sn} name="play-outline" size={13} color={theme['c-primary-font']} />
          : <Text style={styles.sn} size={13} color={theme['c-300']}>{index + 1}</Text>
      }
      <View style={styles.itemInfo}>
        <Text color={active ? theme['c-primary-font'] : theme['c-font']} numberOfLines={1} size={14}>{item.name}</Text>
        <View style={styles.listItemSingle}>
          <Badge>{item.source.toUpperCase()}</Badge>
          <Text style={styles.listItemSingleText} size={11} color={active ? theme['c-primary-alpha-200'] : theme['c-500']} numberOfLines={1}>
            {item.singer}
          </Text>
        </View>
      </View>
      {
        item.interval ? (
          <Text size={12} color={active ? theme['c-primary-alpha-400'] : theme['c-250']} numberOfLines={1}>{item.interval}</Text>
        ) : null
      }
    </TouchableOpacity>
  )
}, (prevProps, nextProps) => {
  return prevProps.item === nextProps.item &&
    prevProps.index === nextProps.index &&
    prevProps.activeIndex === nextProps.activeIndex
})

const Title = ({ title }: { title: string }) => {
  const theme = useTheme()
  return (
    <View style={styles.titleContainer}>
      <Text style={styles.title} size={14} color={theme['c-primary-font']}>{title}</Text>
    </View>
  )
}

export interface PlayQueueModalType {
  show: () => void
}

export default forwardRef<PlayQueueModalType, {}>((props, ref) => {
  const dialogRef = useRef<DialogType>(null)
  const [visible, setVisible] = useState(false)
  const playInfo = usePlayInfo()

  const listId = playInfo.playerListId
  const activeIndex = playInfo.playerPlayIndex

  const list = useMemo(() => {
    if (!listId) return []
    return getList(listId) as LX.Music.MusicInfo[]
  }, [listId, visible])

  useImperativeHandle(ref, () => ({
    show() {
      setVisible(true)
      requestAnimationFrame(() => {
        dialogRef.current?.setVisible(true)
      })
    },
  }))

  const handleHide = () => {
    requestAnimationFrame(() => {
      setVisible(false)
    })
  }

  const handlePress = useCallback((index: number) => {
    if (!listId || index === activeIndex) return
    void playList(listId, index)
  }, [listId, activeIndex])

  const renderItem = useCallback(({ item, index }: { item: LX.Music.MusicInfo, index: number }) => {
    return <ListItem item={item} index={index} activeIndex={activeIndex} onPress={handlePress} />
  }, [activeIndex, handlePress])

  const getItemLayout = useCallback((data: unknown, index: number) => {
    return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  }, [])

  const keyExtractor = useCallback((item: LX.Music.MusicInfo) => item.id, [])

  return (
    <Dialog ref={dialogRef} onHide={handleHide} title="">
      {
        visible
          ? (<>
              <Title title={`播放队列 (${list.length})`} />
              <FlatList
                style={styles.list}
                data={list}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                getItemLayout={getItemLayout}
                initialScrollIndex={Math.max(0, activeIndex - 2)}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
              />
            </>)
          : null
      }
    </Dialog>
  )
})

const styles = createStyle({
  titleContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  title: {
    fontWeight: 'bold',
  },
  list: {
    flexGrow: 0,
    maxHeight: scaleSizeH(400),
  },
  listItem: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 10,
  },
  sn: {
    width: 38,
    textAlign: 'center',
    paddingLeft: 3,
    paddingRight: 3,
  },
  itemInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 2,
  },
  listItemSingle: {
    paddingTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemSingleText: {
    flexGrow: 0,
    flexShrink: 1,
    fontWeight: '300',
  },
})
