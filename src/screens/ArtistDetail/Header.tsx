import { memo, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'

import ImageBackground from '@/components/common/ImageBackground'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { Icon } from '@/components/common/Icon'
import { pop } from '@/navigation'

interface Props {
  artist: any
  componentId: string
}

export default memo(({ artist, componentId }: Props) => {
  const statusBarHeight = useStatusbarHeight()
  const [isDescExpanded, setDescExpanded] = useState(false)

  const artistName = artist?.name || ''
  const artistAlias = artist?.alias?.length ? artist.alias[0] : ''
  const description = artist?.briefDesc || artist?.desc || ''
  const artistPic = artist?.picUrl || artist?.img1v1Url || artist?.img

  const back = () => {
    void pop(componentId)
  }

  return (
    <View style={{ paddingTop: statusBarHeight }}>
      <ImageBackground source={artistPic ? { uri: artistPic } : null} style={styles.headerContainer} blurRadius={10}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backBtn} onPress={back}>
            <Icon name="chevron-left" color="#fff" size={18} />
          </TouchableOpacity>
          <Image url={artistPic} style={styles.avatar} />
          <View style={styles.infoContainer}>
            <Text style={styles.name} size={18} color="#FFF" numberOfLines={2}>
              {artistName}
              {artistAlias ? <Text size={12} color="rgba(255,255,255,0.8)">{` ${artistAlias}`}</Text> : null}
            </Text>
            {artist.albumSize != null || artist.musicSize != null ? (
              <Text size={12} color="rgba(255,255,255,0.8)">
                {`专辑 ${artist.albumSize ?? 0} • 单曲 ${artist.musicSize ?? 0}`}
              </Text>
            ) : null}
            {description ? (
              <TouchableOpacity activeOpacity={0.8} onPress={() => { setDescExpanded(!isDescExpanded) }}>
                <Text
                  size={12}
                  color="rgba(255,255,255,0.8)"
                  numberOfLines={isDescExpanded ? undefined : 2}
                >
                  {description}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ImageBackground>
    </View>
  )
})

const styles = createStyle({
  headerContainer: {
    height: 200,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 10,
    zIndex: 10,
    padding: 5,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 15,
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%',
    paddingTop: 24,
    paddingBottom: 20,
    gap: 6,
  },
  name: {
    fontWeight: 'bold',
  },
})
