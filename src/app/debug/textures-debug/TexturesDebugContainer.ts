import { TextureDebugMeshType } from '../../../types'
import GBufferDebugSection from './GBufferDebugSection'
import ShadowDebugSection from './ShadowDebugSection'

export default class TexturesDebugContainer {
  private static readonly ROOT_EL_ID = 'webgpu-debug-root'

  private $root: HTMLDivElement
  private open = false

  public gbufferDebugSection: GBufferDebugSection
  public shadowDebugSection: ShadowDebugSection

  constructor() {
    this.$root = document.createElement('div')
    this.$root.id = TexturesDebugContainer.ROOT_EL_ID
    document.body.appendChild(this.$root)

    this.gbufferDebugSection = new GBufferDebugSection()
    this.gbufferDebugSection.appendTo(this.$root)

    this.shadowDebugSection = new ShadowDebugSection()
    this.shadowDebugSection.appendTo(this.$root)
  }

  public reveal() {
    this.open = true
    this.$root.classList.add('open')
  }

  public hide() {
    this.open = false
    this.$root.classList.remove('open')
  }

  public scrollToShadowSection() {
    this.shadowDebugSection.$root.scrollIntoView({
      block: 'start',
      inline: 'nearest',
    })
  }

  public scrollIntoGbufferSection() {
    this.gbufferDebugSection.$root.scrollIntoView({
      block: 'start',
      inline: 'nearest',
    })
  }

  public setTextureGBufferSection(
    type: TextureDebugMeshType,
    texture: GPUTexture,
    w = texture.width * 0.2,
    h = texture.height * 0.2
  ): this {
    if (!this.open) {
      return this
    }
    this.gbufferDebugSection.setTextureFor(type, texture, w, h)
    return this
  }

  public setTextureShadowSection(
    type: TextureDebugMeshType,
    texture: GPUTexture,
    w = texture.width * 0.2,
    h = texture.height * 0.2
  ): this {
    if (!this.open) {
      return this
    }
    this.shadowDebugSection.setTextureFor(type, texture, w, h)
    return this
  }

  public render(commandEncoder: GPUCommandEncoder) {
    if (!this.open) {
      return
    }
    this.gbufferDebugSection.render(commandEncoder)
    this.shadowDebugSection.render(commandEncoder)
  }
}
