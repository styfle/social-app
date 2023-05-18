import {Dimensions} from './types'
import {Image as RNImage} from 'react-native-image-crop-picker'
import {getDataUriSize, blobToDataUri} from './util'

export async function compressIfNeeded(
  img: RNImage,
  maxSize: number,
): Promise<RNImage> {
  if (img.size < maxSize) {
    return img
  }
  return await doResize(img.path, {
    width: img.width,
    height: img.height,
    mode: 'stretch',
    maxSize,
  })
}

export interface DownloadAndResizeOpts {
  uri: string
  width: number
  height: number
  mode: 'contain' | 'cover' | 'stretch'
  maxSize: number
  timeout: number
}

export async function downloadAndResize(opts: DownloadAndResizeOpts) {
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(), opts.timeout || 5e3)
  const res = await fetch(opts.uri)
  const resBody = await res.blob()
  clearTimeout(to)

  const dataUri = await blobToDataUri(resBody)
  return await doResize(dataUri, opts)
}

export async function saveImageModal(_opts: {uri: string}) {
  // TODO
  throw new Error('TODO')
}

export async function getImageDim(path: string): Promise<Dimensions> {
  var img = document.createElement('img')
  const promise = new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
  })
  img.src = path
  await promise
  return {width: img.width, height: img.height}
}

// internal methods
// =

interface DoResizeOpts {
  width: number
  height: number
  mode: 'contain' | 'cover' | 'stretch'
  maxSize: number
}

async function doResize(dataUri: string, opts: DoResizeOpts): Promise<RNImage> {
  let newDataUri

  for (let i = 0; i <= 10; i++) {
    newDataUri = await createResizedImage(dataUri, {
      width: opts.width,
      height: opts.height,
      quality: 1 - i * 0.1,
      mode: opts.mode,
    })
    if (getDataUriSize(newDataUri) < opts.maxSize) {
      break
    }
  }
  if (!newDataUri) {
    throw new Error('Failed to compress image')
  }
  return {
    path: newDataUri,
    mime: 'image/jpeg',
    size: getDataUriSize(newDataUri),
    width: opts.width,
    height: opts.height,
  }
}

function createResizedImage(
  dataUri: string,
  {
    width,
    height,
    quality,
    mode,
  }: {
    width: number
    height: number
    quality: number
    mode: 'contain' | 'cover' | 'stretch'
  },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.addEventListener('load', () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return reject(new Error('Failed to resize image'))
      }

      canvas.width = width
      canvas.height = height

      let scale = 1
      if (mode === 'cover') {
        scale = img.width < img.height ? width / img.width : height / img.height
      } else if (mode === 'contain') {
        scale = img.width > img.height ? width / img.width : height / img.height
      }
      let w = img.width * scale
      let h = img.height * scale
      let x = (width - w) / 2
      let y = (height - h) / 2

      ctx.drawImage(img, x, y, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    })
    img.src = dataUri
  })
}
