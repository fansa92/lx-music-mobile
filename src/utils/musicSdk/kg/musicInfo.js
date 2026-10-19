import { decodeName, formatPlayTime, sizeFormate } from '../../index'
import { createHttpFetch, formatKgImg } from './util'

const createGetMusicInfosTask = (hashs) => {
  let data = {
    area_code: '1',
    show_privilege: 1,
    show_album_info: '1',
    is_publish: '',
    appid: 1005,
    clientver: 11451,
    mid: '1',
    dfid: '-',
    clienttime: Date.now(),
    key: 'OIlwieks28dk2k092lksi2UIkp',
    fields: 'album_info,author_name,audio_info,ori_audio_name,base,songname,classification',
  }
  let list = hashs
  let tasks = []
  while (list.length) {
    tasks.push(Object.assign({ data: list.slice(0, 100) }, data))
    if (list.length < 100) break
    list = list.slice(100)
  }
  let url = 'http://gateway.kugou.com/v3/album_audio/audio'
  return tasks.map(task => createHttpFetch(url, {
    method: 'POST',
    body: task,
    headers: {
      'KG-THash': '13a3164',
      'KG-RC': '1',
      'KG-Fake': '0',
      'KG-RF': '00869891',
      'User-Agent': 'Android712-AndroidPhone-11451-376-0-FeeCacheUpdate-wifi',
      'x-router': 'kmr.service.kugou.com',
    },
  }).then(data => data.map(s => s[0])))
}

export const filterMusicInfoList = (rawList) => {
  // console.log(rawList)
  let ids = new Set()
  let list = []
  rawList.forEach(item => {
    if (!item) return
    if (ids.has(item.audio_info.audio_id)) return
    ids.add(item.audio_info.audio_id)
    const types = []
    const _types = {}
    if (item.audio_info.filesize !== '0') {
      let size = sizeFormate(parseInt(item.audio_info.filesize))
      types.push({ type: '128k', size, hash: item.audio_info.hash })
      _types['128k'] = {
        size,
        hash: item.audio_info.hash,
      }
    }
    if (item.audio_info.filesize_320 !== '0') {
      let size = sizeFormate(parseInt(item.audio_info.filesize_320))
      types.push({ type: '320k', size, hash: item.audio_info.hash_320 })
      _types['320k'] = {
        size,
        hash: item.audio_info.hash_320,
      }
    }
    if (item.audio_info.filesize_flac !== '0') {
      let size = sizeFormate(parseInt(item.audio_info.filesize_flac))
      types.push({ type: 'flac', size, hash: item.audio_info.hash_flac })
      _types.flac = {
        size,
        hash: item.audio_info.hash_flac,
      }
    }
    if (item.audio_info.filesize_high !== '0') {
      let size = sizeFormate(parseInt(item.audio_info.filesize_high))
      types.push({ type: 'flac24bit', size, hash: item.audio_info.hash_high })
      _types.flac24bit = {
        size,
        hash: item.audio_info.hash_high,
      }
    }
    list.push({
      singer: decodeName(item.author_name),
      name: decodeName(item.songname),
      albumName: decodeName(item.album_info.album_name),
      albumId: item.album_info.album_id,
      songmid: item.audio_info.audio_id,
      source: 'kg',
      interval: formatPlayTime(parseInt(item.audio_info.timelength) / 1000),
      // 详情接口本来就带了专辑封面（sizable_cover），直接用，避免再单独查一次专辑封面
      img: item.album_info.sizable_cover
        ? item.album_info.sizable_cover.replace('{size}', '480').replace(/^http:\/\//, 'https://')
        : null,
      lrc: null,
      hash: item.audio_info.hash,
      otherSource: null,
      types,
      _types,
      typeUrl: {},
    })
  })
  return list
}

// 新接口的音质字段可能是数字也可能是字符串，0 / '0' / 空都表示没有该音质
const createTypesFromAudioInfo = (audioInfo) => {
  const types = []
  const _types = {}
  const add = (type, size, hash) => {
    if (!hash || size === undefined || size === null || size === '0' || size === 0) return
    const sizeText = sizeFormate(parseInt(size))
    types.push({ type, size: sizeText, hash })
    _types[type] = { size: sizeText, hash }
  }
  add('128k', audioInfo.filesize, audioInfo.hash)
  add('320k', audioInfo.filesize_320, audioInfo.hash_320)
  add('flac', audioInfo.filesize_flac, audioInfo.hash_flac)
  add('flac24bit', audioInfo.filesize_high, audioInfo.hash_high)
  return { types, _types }
}

/**
 * 转换 openapi 接口返回的歌曲列表
 *
 * 兼容三种结构：
 * - /openapi/kmr/v2/audio_group/author：audio_id、audio_name、album_id 在顶层
 * - /v1/album_audio/lite：audio_id、audio_name、album_id 在 base 里
 * - /kmr/v1/audio_group/author：字段全部扁平在最外层（音质字段也在顶层）
 * 时长字段有 timelength / duration 两种，单位都是毫秒
 *
 * @param {Array} rawList
 * @param {string|number} [albumId] 兜底专辑 id（专辑歌曲接口里部分曲目没有 album_id）
 * @param {string} [albumName] 兜底专辑名
 */
export const filterAudioGroupList = (rawList, albumId, albumName) => {
  const ids = new Set()
  const list = []
  rawList.forEach(item => {
    if (!item) return
    const base = item.base || item
    // 扁平结构下音质字段与专辑字段都在顶层，直接复用 item
    const audioInfo = item.audio_info || item
    const audioId = base.audio_id ?? audioInfo.audio_id
    if (!audioId || ids.has(String(audioId))) return
    ids.add(String(audioId))

    const album = item.album_info || item
    const authors = (item.authors || []).map(author => author?.base || author)
    const singer = item.author_name || authors.map(author => author?.author_name).filter(Boolean).join('、')
    const duration = parseInt(audioInfo.timelength ?? audioInfo.duration ?? 0)
    const { types, _types } = createTypesFromAudioInfo(audioInfo)

    list.push({
      singer: decodeName(singer),
      name: decodeName(base.audio_name),
      albumName: decodeName(album.album_name || albumName || ''),
      albumId: album.album_id ?? base.album_id ?? albumId,
      songmid: audioId,
      source: 'kg',
      interval: formatPlayTime(duration / 1000),
      img: formatKgImg(album.sizable_cover || album.cover || item.trans_param?.union_cover) || null,
      lrc: null,
      hash: audioInfo.hash,
      otherSource: null,
      types,
      _types,
      typeUrl: {},
    })
  })
  return list
}

export const getMusicInfos = async(hashs) => {
  return filterMusicInfoList(await Promise.all(createGetMusicInfosTask(hashs)).then(data => data.flat()))
}

export const getMusicInfoRaw = async(hash) => {
  return Promise.all(createGetMusicInfosTask([{ hash }])).then(data => data.flat()[0])
}

export const getMusicInfo = async(hash) => {
  return getMusicInfos([{ hash }]).then(data => data[0])
}

export const getMusicInfosByList = (list) => {
  return getMusicInfos(list.map(item => ({ hash: item.hash })))
}
