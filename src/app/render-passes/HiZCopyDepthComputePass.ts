import PipelineStates from '../../renderer/core/PipelineStates'
import RenderPass from '../../renderer/core/RenderPass'
import RenderingContext from '../../renderer/core/RenderingContext'
import { numMipLevelsForSize } from '../../renderer/math/math'
import VRAMUsageTracker from '../../renderer/misc/VRAMUsageTracker'
import Scene from '../../renderer/scene/Scene'
import { RenderPassType } from '../../renderer/types'
import {
  HI_Z_COPY_DEPTH_COMPUTE_SHADER_ENTRY_FN,
  HI_Z_COPY_DEPTH_COMPUTE_SHADER_SRC,
} from '../shaders/HiZDepthCopyShader'

export default class HiZCopyDepthComputePass extends RenderPass {
  private static readonly COMPUTE_WORKGROUP_SIZE_X = 8
  private static readonly COMPUTE_WORKGROUP_SIZE_Y = 8

  private computePSO: GPUComputePipeline
  private bindGroupLayout: GPUBindGroupLayout
  private bindGroup: GPUBindGroup

  constructor(width: number, height: number) {
    super(RenderPassType.CopyDepthForHiZ, width, height)

    const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        texture: {
          sampleType: 'depth',
        },
        visibility: GPUShaderStage.COMPUTE,
      },
      {
        binding: 1,
        storageTexture: {
          access: 'write-only',
          format: 'r32float',
          viewDimension: '2d',
        },
        visibility: GPUShaderStage.COMPUTE,
      },
    ]

    this.bindGroupLayout = RenderingContext.device.createBindGroupLayout({
      label: 'Hi-Z Copy Depth Bind Group Layout',
      entries: bindGroupLayoutEntries,
    })

    this.computePSO = PipelineStates.createComputePipeline({
      label: 'Hi-Z Copy Depth Compute PSO',
      layout: RenderingContext.device.createPipelineLayout({
        label: 'Hi-Z Copy Depth Compute PSO Layout',
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      compute: {
        entryPoint: HI_Z_COPY_DEPTH_COMPUTE_SHADER_ENTRY_FN,
        module: PipelineStates.createShaderModule(
          HI_Z_COPY_DEPTH_COMPUTE_SHADER_SRC,
          'Hi-Z Depth Copy Compute Shader Module'
        ),
        constants: {
          WORKGROUP_SIZE_X: HiZCopyDepthComputePass.COMPUTE_WORKGROUP_SIZE_X,
          WORKGROUP_SIZE_Y: HiZCopyDepthComputePass.COMPUTE_WORKGROUP_SIZE_Y,
        },
      },
    })

    this.outTextures.push(
      RenderingContext.device.createTexture({
        label: 'Hi-Z Depth Texture',
        size: { width, height },
        usage:
          GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
        format: 'r32float',
        mipLevelCount: numMipLevelsForSize(width, height),
      })
    )

    VRAMUsageTracker.addTextureBytes(this.outTextures[0])
  }

  protected override createComputePassDescriptor(): GPUComputePassDescriptor {
    if (this.computePassDescriptor) {
      return this.computePassDescriptor
    }
    this.computePassDescriptor = {
      label: 'Copy Hi-Z Depth Compute Pass',
    }
    return this.computePassDescriptor
  }

  public override render(
    commandEncoder: GPUCommandEncoder,
    scene: Scene,
    inputs: GPUTexture[]
  ): GPUTexture[] {
    if (!this.inputTextureViews.length) {
      this.inputTextureViews.push(
        inputs[0].createView({ aspect: 'depth-only' })
      )

      const bindGroupEntries: GPUBindGroupEntry[] = [
        {
          binding: 0,
          resource: this.inputTextureViews[0],
        },
        {
          binding: 1,
          resource: this.outTextures[0].createView({
            baseMipLevel: 0,
            mipLevelCount: 1,
          }),
        },
      ]

      this.bindGroup = RenderingContext.device.createBindGroup({
        label: 'Hi-Z Depth Copy Bind Group',
        layout: this.bindGroupLayout,
        entries: bindGroupEntries,
      })
    }

    const computePass = commandEncoder.beginComputePass(
      this.createComputePassDescriptor()
    )

    computePass.setPipeline(this.computePSO)
    computePass.setBindGroup(0, this.bindGroup)

    const workgroupCountX = Math.ceil(
      this.outTextures[0].width /
        HiZCopyDepthComputePass.COMPUTE_WORKGROUP_SIZE_X
    )
    const workgroupCountY = Math.ceil(
      this.outTextures[0].height /
        HiZCopyDepthComputePass.COMPUTE_WORKGROUP_SIZE_Y
    )
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1)

    computePass.end()

    this.postRender(commandEncoder)

    return this.outTextures
  }
}
