import PipelineStates from '../../renderer/core/PipelineStates'
import RenderPass from '../../renderer/core/RenderPass'
import RenderingContext from '../../renderer/core/RenderingContext'
import { numMipLevelsForSize } from '../../renderer/math/math'
import VRAMUsageTracker from '../../renderer/misc/VRAMUsageTracker'
import Scene from '../../renderer/scene/Scene'
import SamplerController from '../../renderer/texture/SamplerController'
import { RenderPassType } from '../../renderer/types'
import {
  BloomDownscaleShaderEntryFn,
  BloomDownscaleShaderSrc,
} from '../shaders/BloomDownscaleShader'

export default class BloomDownscaleRenderPass extends RenderPass {
  private static readonly COMPUTE_WORKGROUP_SIZE_X = 8
  private static readonly COMPUTE_WORKGROUP_SIZE_Y = 8

  private static computePSO: GPUComputePipeline

  private bindGroupLayout: GPUBindGroupLayout
  private mipLevelCount: number
  private sampler: GPUSampler

  constructor(width: number, height: number) {
    super(RenderPassType.BloomDownsample, width, height)

    this.mipLevelCount = numMipLevelsForSize(width, height)
    this.outTextures.push(
      RenderingContext.device.createTexture({
        label: 'Bloom Downscale Texture',
        size: { width, height },
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.STORAGE_BINDING |
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.COPY_DST,
        format: 'rgba16float',
        mipLevelCount: this.mipLevelCount,
      })
    )

    VRAMUsageTracker.addTextureBytes(this.outTextures[0])

    this.sampler = SamplerController.createSampler({
      label: 'Bloom Downscale Sampler',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      minFilter: 'linear',
      magFilter: 'linear',
      // mipmapFilter: "linear",
    })

    const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        texture: {},
        visibility: GPUShaderStage.COMPUTE,
      },
      {
        binding: 1,
        storageTexture: {
          format: 'rgba16float',
        },
        visibility: GPUShaderStage.COMPUTE,
      },
      {
        binding: 2,
        sampler: {},
        visibility: GPUShaderStage.COMPUTE,
      },
    ]

    this.bindGroupLayout = RenderingContext.device.createBindGroupLayout({
      label: 'Bloom Downscale Bind Group Layout',
      entries: bindGroupLayoutEntries,
    })

    if (!BloomDownscaleRenderPass.computePSO) {
      BloomDownscaleRenderPass.computePSO =
        PipelineStates.createComputePipeline({
          label: 'Bloom Downscale Render PSO',
          layout: RenderingContext.device.createPipelineLayout({
            label: 'Bloom Downscale Render PSO Layout',
            bindGroupLayouts: [this.bindGroupLayout],
          }),
          compute: {
            entryPoint: BloomDownscaleShaderEntryFn,
            module: PipelineStates.createShaderModule(BloomDownscaleShaderSrc),
            constants: {
              WORKGROUP_SIZE_X:
                BloomDownscaleRenderPass.COMPUTE_WORKGROUP_SIZE_X,
              WORKGROUP_SIZE_Y:
                BloomDownscaleRenderPass.COMPUTE_WORKGROUP_SIZE_Y,
            },
          },
        })
    }
  }

  public override render(
    commandEncoder: GPUCommandEncoder,
    scene: Scene,
    inputs: GPUTexture[]
  ): GPUTexture[] {
    // first we copy the input tex to out texture mip level 0
    commandEncoder.copyTextureToTexture(
      {
        texture: inputs[0],
        mipLevel: 0,
      },
      { texture: this.outTextures[0], mipLevel: 0 },
      {
        width: this.width,
        height: this.height,
      }
    )

    const bindGroupEntries: GPUBindGroupEntry[] = [
      {
        binding: 0,
        resource: null,
      },
      {
        binding: 1,
        resource: null,
      },
      {
        binding: 2,
        resource: this.sampler,
      },
    ]

    const computePass = commandEncoder.beginComputePass({
      label: 'Bloom Downscale Compute Pass',
    })
    computePass.setPipeline(BloomDownscaleRenderPass.computePSO)

    for (let i = 1; i < this.mipLevelCount; i++) {
      bindGroupEntries[0].resource = this.outTextures[0].createView({
        baseMipLevel: i - 1,
        mipLevelCount: 1,
      })
      bindGroupEntries[1].resource = this.outTextures[0].createView({
        baseMipLevel: i,
        mipLevelCount: 1,
      })
      const bindGroup = RenderingContext.device.createBindGroup({
        label: `Bloom Downscale Bind Group for Mip ${i}`,
        entries: bindGroupEntries,
        layout: this.bindGroupLayout,
      })
      computePass.setBindGroup(0, bindGroup)

      const width = this.outTextures[0].width / Math.pow(2, i)
      const height = this.outTextures[0].height / Math.pow(2, i)

      const workgroupCountX = Math.ceil(
        width / BloomDownscaleRenderPass.COMPUTE_WORKGROUP_SIZE_X
      )
      const workgroupCountY = Math.ceil(
        height / BloomDownscaleRenderPass.COMPUTE_WORKGROUP_SIZE_Y
      )
      computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1)
    }
    computePass.end()

    this.postRender(commandEncoder)

    return this.outTextures
  }
}
