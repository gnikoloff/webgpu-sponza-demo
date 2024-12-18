import PipelineStates from '../../renderer/core/PipelineStates'
import RenderPass from '../../renderer/core/RenderPass'
import RenderingContext from '../../renderer/core/RenderingContext'
import { numMipLevelsForSize } from '../../renderer/math/math'
import VRAMUsageTracker from '../../renderer/misc/VRAMUsageTracker'
import Scene from '../../renderer/scene/Scene'
import FullScreenVertexShaderUtils, {
  FullScreenVertexShaderEntryFn,
} from '../../renderer/shader/FullScreenVertexShaderUtils'
import SamplerController from '../../renderer/texture/SamplerController'
import { RenderPassType } from '../../renderer/types'
import {
  BloomUpscaleShaderEntryFn,
  BloomUpscaleShaderSrc,
} from '../shaders/BloomUpscaleShader'

export default class BloomUpscaleRenderPass extends RenderPass {
  private renderPSO: GPURenderPipeline
  private bindGroupLayout: GPUBindGroupLayout
  private sampler: GPUSampler
  private filterRadiusBuffer: GPUBuffer

  public override async destroy() {
    super.destroy()
    await RenderingContext.device.queue.onSubmittedWorkDone()
    VRAMUsageTracker.removeBufferBytes(this.filterRadiusBuffer)
    this.filterRadiusBuffer.destroy()
  }

  public set bloomFilterRadius(v: number) {
    RenderingContext.device.queue.writeBuffer(
      this.filterRadiusBuffer,
      0,
      new Float32Array([v])
    )
  }

  constructor(width: number, height: number) {
    super(RenderPassType.BloomUpsample, width, height)

    this.sampler = SamplerController.createSampler({
      label: 'Bloom Downscale Sampler',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      minFilter: 'linear',
      magFilter: 'linear',
      // mipmapFilter: "linear",
    })

    this.filterRadiusBuffer = RenderingContext.device.createBuffer({
      label: 'Bloom Upscale Filter Radius GPU Buffer',
      size: 1 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    })

    VRAMUsageTracker.addBufferBytes(this.filterRadiusBuffer)

    new Float32Array(this.filterRadiusBuffer.getMappedRange()).set([0.0035])
    this.filterRadiusBuffer.unmap()

    const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        texture: {},
        visibility: GPUShaderStage.FRAGMENT,
      },
      {
        binding: 1,
        sampler: {},
        visibility: GPUShaderStage.FRAGMENT,
      },
      {
        binding: 2,
        buffer: {},
        visibility: GPUShaderStage.FRAGMENT,
      },
    ]

    this.bindGroupLayout = RenderingContext.device.createBindGroupLayout({
      label: 'Bloom Upscale Bind Group Layout',
      entries: bindGroupLayoutEntries,
    })

    const colorTargets: GPUColorTargetState[] = [
      {
        format: 'rgba16float',
        blend: {
          color: {
            operation: 'add',
            srcFactor: 'one',
            dstFactor: 'one',
          },
          alpha: {
            operation: 'add',
            srcFactor: 'one',
            dstFactor: 'one',
          },
        },
      },
    ]
    this.renderPSO = PipelineStates.createRenderPipeline({
      label: 'Bloom Upscale Render PSO',
      layout: RenderingContext.device.createPipelineLayout({
        label: 'Bloom Upscale Render PSO Layout',
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      vertex: {
        entryPoint: FullScreenVertexShaderEntryFn,
        module: PipelineStates.createShaderModule(FullScreenVertexShaderUtils),
      },
      fragment: {
        entryPoint: BloomUpscaleShaderEntryFn,
        module: PipelineStates.createShaderModule(BloomUpscaleShaderSrc),
        targets: colorTargets,
      },
    })
  }

  public override render(
    commandEncoder: GPUCommandEncoder,
    scene: Scene,
    inputs: GPUTexture[]
  ): GPUTexture[] {
    const bindGroupEntries: GPUBindGroupEntry[] = [
      {
        binding: 0,
        resource: null,
      },
      {
        binding: 1,
        resource: this.sampler,
      },
      {
        binding: 2,
        resource: {
          buffer: this.filterRadiusBuffer,
        },
      },
    ]

    const colorAttachments: GPURenderPassColorAttachment[] = [
      {
        loadOp: 'load',
        storeOp: 'store',
        view: null,
      },
    ]

    const renderPassDesc: GPURenderPassDescriptor = {
      colorAttachments,
    }

    const mipLevelCount = Math.ceil(
      numMipLevelsForSize(inputs[0].width, inputs[0].height) * 0.5
    )

    for (let i = mipLevelCount - 1; i > 0; i--) {
      renderPassDesc.label = `Bloom Upscale Mip Level ${i}`
      renderPassDesc.colorAttachments[0].view = inputs[0].createView({
        baseMipLevel: i - 1,
        mipLevelCount: 1,
      })

      const renderPass = commandEncoder.beginRenderPass(renderPassDesc)
      renderPass.setPipeline(this.renderPSO)

      bindGroupEntries[0].resource = inputs[0].createView({
        baseMipLevel: i,
        mipLevelCount: 1,
      })

      const bindGroup = RenderingContext.device.createBindGroup({
        label: `Bloom Upscale Bind Group for Mip ${i}`,
        entries: bindGroupEntries,
        layout: this.bindGroupLayout,
      })

      renderPass.setBindGroup(0, bindGroup)
      renderPass.draw(3)
      renderPass.end()
    }

    this.postRender(commandEncoder)

    return inputs
  }
}
