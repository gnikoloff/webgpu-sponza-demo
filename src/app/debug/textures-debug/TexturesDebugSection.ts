import { TextureDebugMeshType } from '../../../types'
import DebugTextureCanvas from './DebugTextureCanvas'

export enum DebugSectionType {
  GBuffer,
  Shadow,
}

const debugSectionTypeToTitle: Map<DebugSectionType, string> = new Map([
  [DebugSectionType.GBuffer, 'G-Buffer Debug'],
  [DebugSectionType.Shadow, 'Shadows Debug'],
])

export default class TexturesDebugSection {
  protected static createRootElement(): HTMLDivElement {
    const $el = document.createElement('div')
    $el.classList.add('texture-debug-wrapper')
    return $el
  }

  public $root: HTMLDivElement
  protected $main: HTMLDivElement

  protected canvases: Map<TextureDebugMeshType, DebugTextureCanvas> = new Map()

  constructor(type: DebugSectionType) {
    this.$root = TexturesDebugSection.createRootElement()
    this.$main = document.createElement('div')
    this.$main.classList.add('section')

    const $headline = document.createElement('h2')
    $headline.textContent = debugSectionTypeToTitle.get(type)
    $headline.classList.add('section-headline')

    this.$root.appendChild($headline)
    this.$root.appendChild(this.$main)
  }

  public appendTo(parent: HTMLElement) {
    parent.appendChild(this.$root)
  }

  public setTextureFor(
    type: TextureDebugMeshType,
    texture: GPUTexture,
    w = texture.width * 0.2,
    h = texture.height * 0.2
  ): this {
    const debugCanvas = this.canvases.get(type)
    debugCanvas.setTexture(texture, w, h)
    return this
  }

  public render(commandEncoder: GPUCommandEncoder) {
    for (const debugCanvas of this.canvases.values()) {
      debugCanvas.render(commandEncoder)
    }
  }
}
