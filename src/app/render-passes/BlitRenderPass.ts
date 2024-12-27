import PipelineStates from '../../renderer/core/PipelineStates'
import RenderPass from '../../renderer/core/RenderPass'
import RenderingContext from '../../renderer/core/RenderingContext'
import Scene from '../../renderer/scene/Scene'
import FullScreenVertexShaderUtils, {
  FullScreenVertexShaderEntryFn,
} from '../../renderer/shader/FullScreenVertexShaderUtils'
import { RenderPassType } from '../../renderer/types'
import { BlitRenderMode } from '../constants'
import {
  BLIT_FRAGMENT_SHADER_ENTRY_NAME,
  getBlitFragmentShaderSrc,
} from '../shaders/BlitShader'

export default class BlitRenderPass extends RenderPass {
  private renderPSO: GPURenderPipeline

  private texturesBindGroupLayout: GPUBindGroupLayout
  private texturesBindGroup: GPUBindGroup

  constructor(
    private mode: BlitRenderMode,
    width: number,
    height: number
  ) {
    super(RenderPassType.Blit, width, height)
  }

  protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
    if (this.renderPassDescriptor) {
      return this.renderPassDescriptor
    }
    const colorAttachments: GPURenderPassColorAttachment[] = [
      {
        view: null,
        loadOp: 'load',
        storeOp: 'store',
      },
    ]
    this.renderPassDescriptor =
      this.augmentRenderPassDescriptorWithTimestampQuery({
        colorAttachments,
        label: 'Blit Pass',
      })
    return this.renderPassDescriptor
  }

  public override render(
    commandEncoder: GPUCommandEncoder,
    scene: Scene,
    inputs: GPUTexture[]
  ): GPUTexture[] {
    if (!this.inputTextureViews.length) {
      if (this.mode === BlitRenderMode.Depth) {
        this.inputTextureViews.push(
          inputs[0].createView({ aspect: 'depth-only' })
        )
      } else {
        this.inputTextureViews.push(inputs[0].createView({}))
      }

      const vertexShaderModule = PipelineStates.createShaderModule(
        FullScreenVertexShaderUtils
      )
      const fragmentShaderModule = PipelineStates.createShaderModule(
        getBlitFragmentShaderSrc(this.mode)
      )

      const targets: GPUColorTargetState[] = [{ format: 'bgra8unorm' }]

      const textureBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
        {
          binding: 0,
          texture: {
            sampleType: this.mode === BlitRenderMode.Depth ? 'depth' : 'float',
          },
          visibility: GPUShaderStage.FRAGMENT,
        },
      ]
      this.texturesBindGroupLayout =
        RenderingContext.device.createBindGroupLayout({
          entries: textureBindGroupLayoutEntries,
        })

      const renderPSODescriptor: GPURenderPipelineDescriptor = {
        layout: RenderingContext.device.createPipelineLayout({
          label: 'Blit Render Pass Render PSO Layout',
          bindGroupLayouts: [this.texturesBindGroupLayout],
        }),
        vertex: {
          module: vertexShaderModule,
          entryPoint: FullScreenVertexShaderEntryFn,
        },
        fragment: {
          module: fragmentShaderModule,
          entryPoint: BLIT_FRAGMENT_SHADER_ENTRY_NAME,
          targets,
        },
      }
      this.renderPSO = PipelineStates.createRenderPipeline(renderPSODescriptor)

      const bindGroupEntries: GPUBindGroupEntry[] = [
        {
          binding: 0,
          resource: this.inputTextureViews[0],
        },
      ]

      this.texturesBindGroup = RenderingContext.device.createBindGroup({
        layout: this.texturesBindGroupLayout,
        entries: bindGroupEntries,
      })
    }

    const descriptor = this.createRenderPassDescriptor()
    descriptor.colorAttachments[0].view = RenderingContext.canvasContext
      .getCurrentTexture()
      .createView()

    const renderPassEncoder = commandEncoder.beginRenderPass(descriptor)
    RenderingContext.setActiveRenderPass(this.type, renderPassEncoder)
    RenderingContext.bindRenderPSO(this.renderPSO)
    renderPassEncoder.setBindGroup(0, this.texturesBindGroup)
    renderPassEncoder.draw(6)
    renderPassEncoder.end()
    this.postRender(commandEncoder)

    return []
  }
}
