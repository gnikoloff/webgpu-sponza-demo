import { Tween } from '../../renderer/animation/Tween'
import PipelineStates from '../../renderer/core/PipelineStates'
import RenderPass from '../../renderer/core/RenderPass'
import RenderingContext from '../../renderer/core/RenderingContext'
import VRAMUsageTracker from '../../renderer/misc/VRAMUsageTracker'
import Scene from '../../renderer/scene/Scene'
import FullScreenVertexShaderUtils, {
  FullScreenVertexShaderEntryFn,
} from '../../renderer/shader/FullScreenVertexShaderUtils'
import TextureLoader from '../../renderer/texture/TextureLoader'
import { EaseType, RenderPassType } from '../../renderer/types'
import {
  BLIT_FRAGMENT_SHADER_ENTRY_NAME,
  BLIT_FRAGMENT_SHADER_SRC,
} from '../shaders/BlitShader'

export default class BlitRenderPass extends RenderPass {
  private static readonly BLOOM_MIX_FACTOR = 0.035

  private static renderPSO: GPURenderPipeline

  private texturesBindGroupLayout: GPUBindGroupLayout
  private textureBindGroup: GPUBindGroup
  private bloomMixFactorBuffer: GPUBuffer
  private timeBuffer: GPUBuffer
  private revealFactorBuffer: GPUBuffer

  public override async destroy() {
    super.destroy()
    await RenderingContext.device.queue.onSubmittedWorkDone()
    VRAMUsageTracker.removeBufferBytes(this.bloomMixFactorBuffer)
    VRAMUsageTracker.removeBufferBytes(this.timeBuffer)
    VRAMUsageTracker.removeBufferBytes(this.revealFactorBuffer)
    this.bloomMixFactorBuffer.destroy()
    this.timeBuffer.destroy()
    this.revealFactorBuffer.destroy()
  }

  public set bloomEnabled(v: boolean) {
    RenderingContext.device.queue.writeBuffer(
      this.bloomMixFactorBuffer,
      0,
      new Float32Array([v ? BlitRenderPass.BLOOM_MIX_FACTOR : 0])
    )
  }

  public revealWithAnimation(duration = 500, easeName: EaseType = 'quad_Out') {
    new Tween({
      durationMS: duration,
      easeName,
      onUpdate: (t) => {
        this.updateRevealFactor(t)
      },
    }).start()
  }

  private updateRevealFactor(v: number) {
    RenderingContext.device.queue.writeBuffer(
      this.revealFactorBuffer,
      0,
      new Float32Array([v])
    )
  }

  constructor(width: number, height: number, alreadyRevealed = false) {
    super(RenderPassType.Blit, width, height)
    const vertexShaderModule = PipelineStates.createShaderModule(
      FullScreenVertexShaderUtils
    )
    const fragmentShaderModule = PipelineStates.createShaderModule(
      BLIT_FRAGMENT_SHADER_SRC
    )

    const targets: GPUColorTargetState[] = [
      {
        format: 'bgra8unorm',
      },
    ]

    const texturesBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {},
      },
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {},
      },
      {
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {},
      },
    ]

    this.texturesBindGroupLayout =
      RenderingContext.device.createBindGroupLayout({
        label: 'GBuffer Textures Bind Group',
        entries: texturesBindGroupLayoutEntries,
      })

    if (!BlitRenderPass.renderPSO) {
      const renderPSODescriptor: GPURenderPipelineDescriptor = {
        layout: RenderingContext.device.createPipelineLayout({
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
        primitive: {
          topology: 'triangle-list',
          cullMode: 'back',
        },
      }

      BlitRenderPass.renderPSO =
        PipelineStates.createRenderPipeline(renderPSODescriptor)
    }

    this.bloomMixFactorBuffer = RenderingContext.device.createBuffer({
      label: 'Bloom Mix Factor GPU Buffer',
      size: 1 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    })

    VRAMUsageTracker.addBufferBytes(this.bloomMixFactorBuffer)

    new Float32Array(this.bloomMixFactorBuffer.getMappedRange()).set([
      BlitRenderPass.BLOOM_MIX_FACTOR,
    ])

    this.bloomMixFactorBuffer.unmap()

    this.timeBuffer = RenderingContext.device.createBuffer({
      label: 'Bloom Elapsed Time Buffer',
      size: 1 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    VRAMUsageTracker.addBufferBytes(this.timeBuffer)

    this.revealFactorBuffer = RenderingContext.device.createBuffer({
      label: 'Blit Loading Reveal Factor Buffer',
      size: 1 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    })

    VRAMUsageTracker.addBufferBytes(this.revealFactorBuffer)

    new Float32Array(this.revealFactorBuffer.getMappedRange()).set([
      alreadyRevealed ? 1 : 0,
    ])

    this.revealFactorBuffer.unmap()
  }

  protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
    if (this.renderPassDescriptor) {
      return this.renderPassDescriptor
    }
    const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
      {
        view: null,
        loadOp: 'load',
        storeOp: 'store',
      },
    ]
    this.renderPassDescriptor =
      this.augmentRenderPassDescriptorWithTimestampQuery({
        colorAttachments: renderPassColorAttachments,
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
      if (inputs.length === 1) {
        this.inputTextureViews.push(
          TextureLoader.dummyRGBA16FTexture.createView()
        )
        this.inputTextureViews.push(inputs[0].createView())
      } else {
        this.inputTextureViews.push(inputs[0].createView())
        this.inputTextureViews.push(inputs[1].createView())
      }

      const texturesBindGroupEntries: GPUBindGroupEntry[] = [
        {
          binding: 0,
          resource: this.inputTextureViews[0],
        },
        {
          binding: 1,
          resource: this.inputTextureViews[1],
        },
        {
          binding: 2,
          resource: {
            buffer: this.bloomMixFactorBuffer,
          },
        },
        {
          binding: 3,
          resource: {
            buffer: this.timeBuffer,
          },
        },
        {
          binding: 4,
          resource: {
            buffer: this.revealFactorBuffer,
          },
        },
      ]
      this.textureBindGroup = RenderingContext.device.createBindGroup({
        layout: this.texturesBindGroupLayout,
        entries: texturesBindGroupEntries,
      })
    }

    RenderingContext.device.queue.writeBuffer(
      this.timeBuffer,
      0,
      new Float32Array([RenderingContext.elapsedTimeMs])
    )

    const descriptor = this.createRenderPassDescriptor()
    descriptor.colorAttachments[0].view = RenderingContext.canvasContext
      .getCurrentTexture()
      .createView()
    const renderPassEncoder = commandEncoder.beginRenderPass(descriptor)

    RenderingContext.setActiveRenderPass(this.type, renderPassEncoder)

    RenderingContext.bindRenderPSO(BlitRenderPass.renderPSO)
    renderPassEncoder.setBindGroup(0, this.textureBindGroup)
    renderPassEncoder.draw(6)

    renderPassEncoder.end()

    this.postRender(commandEncoder)

    return []
  }
}
