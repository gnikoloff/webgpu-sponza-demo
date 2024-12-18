import byteSize from 'byte-size'
import BaseUtilObject from '../core/BaseUtilObject'

const TEXTURE_FORMAT_TO_BYTE_PER_PIXEL: Map<GPUTextureFormat, number> = new Map(
  [
    ['r16float', Uint16Array.BYTES_PER_ELEMENT],
    ['rg16float', Uint16Array.BYTES_PER_ELEMENT * 2],
    ['rgba16float', Uint16Array.BYTES_PER_ELEMENT * 4],
    ['r32float', Float32Array.BYTES_PER_ELEMENT],
    ['rg32float', Float32Array.BYTES_PER_ELEMENT * 2],
    ['rgba32float', Float32Array.BYTES_PER_ELEMENT * 4],
    ['bgra8unorm', Uint8Array.BYTES_PER_ELEMENT * 4],
    ['rgba8unorm', Uint8Array.BYTES_PER_ELEMENT * 4],
    ['depth24plus', 3],
    ['depth32float', Float32Array.BYTES_PER_ELEMENT],
    ['depth24plus-stencil8', Float32Array.BYTES_PER_ELEMENT],
  ]
)

export default class VRAMUsageTracker extends BaseUtilObject {
  private static bytesAllocated = 0

  public static get formattedSize(): string {
    return this.getFormattedSize()
  }

  public static getFormattedSize(): string {
    return byteSize(this.bytesAllocated).toString()
  }

  public static addBytes(v: number) {
    this.bytesAllocated += v
  }

  public static removeBytes(v: number) {
    this.bytesAllocated -= v
    if (this.bytesAllocated < 0) {
      console.warn('Bytes allocated less than 0!')
    }
  }

  public static addBufferBytes(buffer: GPUBuffer) {
    this.addBytes(buffer.size)
  }

  public static removeBufferBytes(buffer: GPUBuffer) {
    this.removeBytes(buffer.size)
  }

  public static addTextureBytes(texture: GPUTexture) {
    const byteSizePerPixel = TEXTURE_FORMAT_TO_BYTE_PER_PIXEL.get(
      texture.format
    )
    if (!byteSizePerPixel) {
      console.warn(`No byte size per pixel info for ${texture.format}`)
      return
    }
    for (let i = 0; i < texture.depthOrArrayLayers; i++) {
      for (let n = 0; n < texture.mipLevelCount; n++) {
        const width = Math.ceil(texture.width / Math.pow(2, n))
        const height = Math.ceil(texture.height / Math.pow(2, n))
        const byteSize = byteSizePerPixel * width * height
        this.addBytes(byteSize)
      }
    }
  }

  public static removeTextureBytes(texture: GPUTexture) {
    const byteSizePerPixel = TEXTURE_FORMAT_TO_BYTE_PER_PIXEL.get(
      texture.format
    )
    if (!byteSizePerPixel) {
      console.warn(`No byte size per pixel info for ${texture.format}`)
      return
    }
    for (let i = 0; i < texture.depthOrArrayLayers; i++) {
      for (let n = 0; n < texture.mipLevelCount; n++) {
        const width = Math.ceil(texture.width / Math.pow(2, n))
        const height = Math.ceil(texture.height / Math.pow(2, n))
        const byteSize = byteSizePerPixel * width * height
        this.removeBytes(byteSize)
      }
    }
  }
}
