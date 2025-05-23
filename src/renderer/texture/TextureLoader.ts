import HDRjs from 'hdr.js'
import BaseUtilObject from '../core/BaseUtilObject'
import RenderingContext from '../core/RenderingContext'
import { numMipLevelsForSize, toHalf } from '../math/math'
import VRAMUsageTracker from '../misc/VRAMUsageTracker'
import { HDRImageResult } from '../types'
import CubeTextureController from './CubeTextureController'
import TextureController from './TextureController'

// prettier-ignore
const BAYER_PATTERN = new Uint8Array([
  0, 32,  8, 40,  2, 34, 10, 42,   /* 8x8 Bayer ordered dithering  */
  48, 16, 56, 24, 50, 18, 58, 26,  /* pattern.  Each input pixel   */
  12, 44,  4, 36, 14, 46,  6, 38,  /* is scaled to the 0..63 range */
  60, 28, 52, 20, 62, 30, 54, 22,  /* before looking in this table */
  3, 35, 11, 43,  1, 33,  9, 41,   /* to determine the action.     */
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
])

// prettier-ignore
const DEBUG_PATTERN = new Uint8Array([
  0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
  0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
  0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
  0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
  0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
  0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
  0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
  0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
]);

let _dummyTexture: GPUTexture
let _dummyRGBA16FTexture: GPUTexture
let _dummyR16FTexture: GPUTexture
let _dummyCubeTexture: GPUTexture
let _bayerDitherPattern: GPUTexture

export default class TextureLoader extends BaseUtilObject {
  public static get dummyRGBA16FTexture(): GPUTexture {
    if (_dummyRGBA16FTexture) {
      return _dummyRGBA16FTexture
    }
    _dummyRGBA16FTexture = RenderingContext.device.createTexture({
      label: 'Dummy 1x1 RGBA16F Texture',
      size: { width: 1, height: 1 },
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING,
    })
    return _dummyRGBA16FTexture
  }

  public static get dummyR16FTexture(): GPUTexture {
    if (_dummyR16FTexture) {
      return _dummyR16FTexture
    }
    _dummyR16FTexture = RenderingContext.device.createTexture({
      label: 'Dummy 8x8 R16F Texture',
      size: { width: 8, height: 8, depthOrArrayLayers: 1 },
      format: 'r16float',
      usage: GPUTextureUsage.TEXTURE_BINDING,
    })
    return _dummyR16FTexture
  }

  public static get dummyTexture(): GPUTexture {
    if (_dummyTexture) {
      return _dummyTexture
    }
    _dummyTexture = RenderingContext.device.createTexture({
      label: 'Default Dummy 8x8 Texture',
      dimension: '2d',
      size: { width: 8, height: 8, depthOrArrayLayers: 1 },
      format: 'r8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC,
    })
    RenderingContext.device.queue.writeTexture(
      { texture: _dummyTexture, mipLevel: 0 },
      DEBUG_PATTERN,
      { offset: 0, bytesPerRow: 8 * Uint8Array.BYTES_PER_ELEMENT },
      {
        width: 8,
        height: 8,
        depthOrArrayLayers: 1,
      }
    )

    return _dummyTexture
  }

  public static get dummyCubeTexture(): GPUTexture {
    if (_dummyCubeTexture) {
      return _dummyCubeTexture
    }
    _dummyCubeTexture = RenderingContext.device.createTexture({
      label: 'Default Dummy 8x8 Cube Texture',
      dimension: '2d',
      size: { width: 8, height: 8, depthOrArrayLayers: 6 },
      format: 'r8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })
    for (let face = 0; face < 6; face++) {
      RenderingContext.device.queue.writeTexture(
        {
          texture: _dummyCubeTexture,
          mipLevel: 0,
          origin: { x: 0, y: 0, z: face },
        },
        DEBUG_PATTERN,
        {
          offset: 0,
          bytesPerRow: 8,
        },
        {
          width: 8,
          height: 8,
          depthOrArrayLayers: 0,
        }
      )
    }
    return _dummyCubeTexture
  }

  public static get bayerDitherPatternTexture(): GPUTexture {
    if (_bayerDitherPattern) {
      return _bayerDitherPattern
    }
    _bayerDitherPattern = RenderingContext.device.createTexture({
      label: 'Bayer ordered dithered GPUTexture',
      dimension: '2d',
      size: { width: 8, height: 8, depthOrArrayLayers: 1 },
      format: 'r8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })
    RenderingContext.device.queue.writeTexture(
      { texture: _bayerDitherPattern, mipLevel: 0 },
      BAYER_PATTERN,
      { offset: 0, bytesPerRow: 8 },
      {
        width: 8,
        height: 8,
        depthOrArrayLayers: 1,
      }
    )
    return _bayerDitherPattern
  }

  public static loadHDRImage = async (url: string): Promise<HDRImageResult> => {
    const hdr = await HDRjs.load(url)
    const len = hdr.width * hdr.height
    const result: HDRImageResult = {
      width: hdr.width,
      height: hdr.height,
      // webgpu does not support multiple of 3 floating point arrays
      // need to add some padding ourselves
      rgbaHalfFloat: new Uint16Array(hdr.width * hdr.height * 4),
    }
    for (let i = 0; i < len; i++) {
      const sourceR = hdr.rgbFloat[i * 3 + 0]
      const sourceG = hdr.rgbFloat[i * 3 + 1]
      const sourceB = hdr.rgbFloat[i * 3 + 2]

      result.rgbaHalfFloat[i * 4 + 0] = toHalf(sourceR)
      result.rgbaHalfFloat[i * 4 + 1] = toHalf(sourceG)
      result.rgbaHalfFloat[i * 4 + 2] = toHalf(sourceB)
      result.rgbaHalfFloat[i * 4 + 3] = toHalf(1)
    }
    return result
  }

  public static loadHDRTexture = async (
    url: string,
    usage: number = GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC,
    debugLabel = `HDR Texture ${url}`
  ): Promise<GPUTexture> => {
    const hdrImage = await TextureLoader.loadHDRImage(url)
    const hdrTexture = await TextureController.createHDRTexture(
      hdrImage,
      usage,
      debugLabel
    )
    VRAMUsageTracker.addTextureBytes(hdrTexture)
    return hdrTexture
  }

  public static load6SeparateHDRFacesAsCubeMapTexture = async (
    faceUrls: string[],
    outTextureSize: number,
    hasMips: boolean,
    debugLabel: string = null
  ): Promise<GPUTexture> => {
    if (faceUrls.length !== 6) {
      console.error('Need 6 separate urls for 6 separate environment textures')
      return
    }
    const hdrTextures = await Promise.all(
      faceUrls.map((url) => TextureLoader.loadHDRTexture(url))
    )
    const tex = CubeTextureController.cubeTextureFromIndividualHDRTextures(
      hdrTextures,
      debugLabel,
      outTextureSize,
      hasMips
    )
    VRAMUsageTracker.addTextureBytes(tex)
    return tex
  }

  public static loadTextureFromData = async (
    data: Uint8Array,
    format: GPUTextureFormat = 'rgba8unorm',
    generateMips = true,
    flipY = false,
    showDebug = false,
    debugLabel = 'Bitmap Texture'
  ): Promise<GPUTexture> => {
    const blob = new Blob([data], {
      type: 'image/png',
    })
    const bitmap = await createImageBitmap(blob, {
      colorSpaceConversion: 'none',
    })
    let usage =
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT

    if (generateMips) {
      usage |= GPUTextureUsage.STORAGE_BINDING
    }

    const texDescriptor: GPUTextureDescriptor = {
      label: debugLabel,
      dimension: '2d',
      size: {
        width: bitmap.width,
        height: bitmap.height,
        depthOrArrayLayers: 1,
      },
      format,
      usage,
    }

    if (generateMips) {
      texDescriptor.mipLevelCount = numMipLevelsForSize(
        bitmap.width,
        bitmap.height
      )
    }

    const texture = RenderingContext.device.createTexture(texDescriptor)
    RenderingContext.device.queue.copyExternalImageToTexture(
      {
        source: bitmap,
        flipY,
      },
      { texture },
      { width: bitmap.width, height: bitmap.height }
    )

    if (!generateMips) {
      VRAMUsageTracker.addTextureBytes(texture)
      return texture
    }
    TextureController.generateMipsFor2DTextureWithComputePSO(texture)

    VRAMUsageTracker.addTextureBytes(texture)

    if (showDebug) {
      const debugCavas = document.createElement('canvas')
      const ctx = debugCavas.getContext('2d')
      debugCavas.width = texture.width / 2
      debugCavas.height = texture.height / 2
      ctx.drawImage(bitmap, 0, 0)
      debugCavas.style.setProperty('position', 'fixed')
      debugCavas.style.setProperty('z-index', '99')
      debugCavas.style.setProperty('left', '2rem')
      debugCavas.style.setProperty('bottom', '2rem')
      debugCavas.style.setProperty('width', `${texture.width * 0.1}px`)
      debugCavas.style.setProperty('height', `${texture.height * 0.1}px`)
      debugCavas.dataset.debugLabel = `${debugLabel.toLowerCase()}`
      document.body.appendChild(debugCavas)
    }

    bitmap.close()
    return texture
  }
}
