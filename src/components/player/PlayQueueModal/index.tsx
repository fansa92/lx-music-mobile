import { memo, useCallback, useMemo, useRef, useState, forwardRef, useImperativeHandle, useEffect } from 'react'
import { Animated, FlatList, Modal, Platform, Pressable, View, TouchableOpacity, type ModalProps } from 'react-native'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Badge from '@/components/common/Badge'
import { usePlayInfo } from '@/store/player/hook'
import { playList } from '@/core/player/player'
import { getList } from '@/core/player/playInfo'
import { useStatusbarHeight } from '@/store/common/hook'
import useWindowSize from '@/utils/hooks/useWindowSize'

const ITEM_HEIGHT = scaleSizeH(48)
const DRAWER_WIDTH_PERCENTAGE = 0.75
const DRAWER_MAX_WIDTH = scaleSizeW(360)

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

export interface PlayQueueModalType {
  show: () => void
}

export default forwardRef<PlayQueueModalType, {}>((props, ref) => {
  const [visible, setVisible] = useState(false)
  const playInfo = usePlayInfo()
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const windowSize = useWindowSize()
  const animation = useRef(new Animated.Value(0)).current

  const listId = playInfo.playerListId
  const activeIndex = playInfo.playerPlayIndex

  const drawerWidth = useMemo(() => {
    return Math.min(Math.floor(windowSize.width * DRAWER_WIDTH_PERCENTAGE), DRAWER_MAX_WIDTH)
  }, [windowSize.width])

  const list = useMemo(() => {
    if (!listId) return []
    return getList(listId) as LX.Music.MusicInfo[]
  }, [listId, visible])

  const openDrawer = useCallback(() => {
    setVisible(true)
    Animated.timing(animation, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start()
  }, [animation])

  const closeDrawer = useCallback(() => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setVisible(false)
    })
  }, [animation])

  useImperativeHandle(ref, () => ({
    show() {
      openDrawer()
    },
  }), [openDrawer])

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

  const drawerTranslate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [drawerWidth, 0],
  })
  const overlayOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.32],
  })

  const supportedOrientations = useMemo<ModalProps['supportedOrientations']>(() => Platform.OS === 'ios'
    ? ['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']
    : undefined, [])

  if (!visible) return null

  return (
    <Modal
      animationType="fade"
      transparent={true}
      hardwareAccelerated={true}
      statusBarTranslucent={true}
      visible={visible}
      onRequestClose={closeDrawer}
      supportedOrientations={supportedOrientations}
    >
      <View style={{ flex: 1, paddingTop: statusBarHeight }}>
        <Animated.View
          pointerEvents="auto"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: overlayOpacity }}
        >
          <Pressable onPress={closeDrawer} style={{ flex: 1, backgroundColor: '#000' }} />
        </Animated.View>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: drawerWidth,
            backgroundColor: theme['c-content-background'],
            transform: [{ translateX: drawerTranslate }],
          }}
        >
          <View style={styles.header}>
            <Text style={styles.title} size={14} color={theme['c-primary-font']}>
              播放队列 ({list.length})
            </Text>
          </View>
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
        </Animated.View>
      </View>
    </Modal>
  )
})

const styles = createStyle({
  header: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
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
