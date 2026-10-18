import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { dateFormat } from '@/utils/common'
import { useStatusbarHeight } from '@/store/common/hook'
import { Icon } from '@/components/common/Icon'
import { pop, navigations } from '@/navigation'

interface Props {
  albumInfo: {
    id?: string
    name: string
    author?: string
    picUrl?: string
    img?: string
    artists?: Array<{ id: string, name: string }>
    size?: number
    publishTime?: number
  }
  componentId: string
}

export default memo(({ albumInfo, componentId }: Props) => {
  const statusBarHeight = useStatusbarHeight()
  const albumPic = albumInfo.picUrl ?? albumInfo.img
  const artists: Array<{ id: string, name: string }> = albumInfo.artists?.length
    ? albumInfo.artists
    : (albumInfo.author ? [{ id: '', name: albumInfo.author }] : [])

  const back = () => {
    void pop(componentId)
  }

  const handleArtistPress = (artist: { id: string, name: string }) => {
    if (!artist.id) return
    navigations.pushArtistDetailScreen(componentId, { id: String(artist.id), name: artist.name })
  }

  return (
    <View style={{ paddingTop: statusBarHeight, backgroundColor: 'rgba(0,0,0,0.2)' }}>
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={back}>
          <Icon name="chevron-left" color="#fff" size={18} />
        </TouchableOpacity>
        <Image url={albumPic} style={styles.albumArt} />
        <View style={styles.infoContainer}>
          <Text style={styles.albumName} size={18} color="#FFF" numberOfLines={2}>{albumInfo.name}</Text>
          <View style={styles.artistContainer}>
            {artists.map((artist, index) => (
              <TouchableOpacity key={artist.id || `${artist.name}_${index}`} onPress={() => { handleArtistPress(artist) }}>
                <Text style={styles.artistName} size={14} color="rgba(255,255,255,0.9)">
                  {artist.name}{index < artists.length - 1 ? ' / ' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.metaInfo} size={12} color="rgba(255,255,255,0.8)">
            {albumInfo.publishTime ? dateFormat(albumInfo.publishTime, 'Y.M.D') : ''}
            {albumInfo.size ? ` • ${albumInfo.size} tracks` : ''}
          </Text>
        </View>
      </View>
    </View>
  )
})

const styles = createStyle({
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 10,
    zIndex: 10,
    padding: 5,
  },
  headerContainer: {
    padding: 20,
    paddingTop: 36,
    flexDirection: 'row',
    alignItems: 'center',
  },
  albumArt: {
    width: 96,
    height: 96,
    borderRadius: 8,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 20,
    justifyContent: 'center',
  },
  albumName: {
    fontWeight: 'bold',
  },
  artistContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  artistName: {
    textDecorationLine: 'underline',
  },
  metaInfo: {
    marginTop: 8,
  },
})
