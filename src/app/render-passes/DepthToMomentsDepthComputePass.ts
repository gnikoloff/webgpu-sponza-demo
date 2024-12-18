import PipelineStates from '../../renderer/core/PipelineStates'
import RenderPass from '../../renderer/core/RenderPass'
import RenderingContext from '../../renderer/core/RenderingContext'
import VRAMUsageTracker from '../../renderer/misc/VRAMUsageTracker'
import Scene from '../../renderer/scene/Scene'
import { RenderPassType } from '../../renderer/types'
import {
  VARIANCE_SHADOW_SHADER_ENTRY_FN,
  VARIANCE_SHADOW_SHADER_SRC,
} from '../shaders/VarianceShadow'
import DirectionalShadowRenderPass from './DirectionalShadowRenderPass'

export default class DepthToMomentsDepthComputePass extends RenderPass {
  private static readonly COMPUTE_WORKGROUP_SIZE_X = 8
  private static readonly COMPUTE_WORKGROUP_SIZE_Y = 8

  private computePSO: GPUComputePipeline
  private bindGroupLayout: GPUBindGroupLayout
  private bindGroupCascade0: GPUBindGroup
  private bindGroupCascade1: GPUBindGroup

  constructor(width: number, height: number) {
    super(RenderPassType.MomentsShadow, width, height)

    this.outTextures.push(
      RenderingContext.device.createTexture({
        label: 'Directional Shadow Variance Depth Texture',
        dimension: '2d',
        format: 'rg32float',
        size: {
          width: DirectionalShadowRenderPass.TEXTURE_SIZE,
          height: DirectionalShadowRenderPass.TEXTURE_SIZE,
          depthOrArrayLayers:
            DirectionalShadowRenderPass.TEXTURE_CASCADES_COUNT,
        },
        usage:
          GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        mipLevelCount: 1,

        sampleCount: 1,
      })
    )

    VRAMUsageTracker.addTextureBytes(this.outTextures[0])

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
          format: 'rg32float',
          access: 'write-only',
        },
        visibility: GPUShaderStage.COMPUTE,
      },
    ]
    this.bindGroupLayout = RenderingContext.device.createBindGroupLayout({
      label: 'Depth to Moments Depth Bind Group Layout',
      entries: bindGroupLayoutEntries,
    })

    this.computePSO = PipelineStates.createComputePipeline({
      label: 'Depth To Moments Depth Compute PSO',
      layout: RenderingContext.device.createPipelineLayout({
        label: 'Depth To Moments Depth Compute PSO Layout',
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      compute: {
        entryPoint: VARIANCE_SHADOW_SHADER_ENTRY_FN,
        module: PipelineStates.createShaderModule(
          VARIANCE_SHADOW_SHADER_SRC,
          'Copy Depth to Moments Depth Shader Module'
        ),
        constants: {
          WORKGROUP_SIZE_X:
            DepthToMomentsDepthComputePass.COMPUTE_WORKGROUP_SIZE_X,
          WORKGROUP_SIZE_Y:
            DepthToMomentsDepthComputePass.COMPUTE_WORKGROUP_SIZE_Y,
        },
      },
    })
  }

  public override render(
    commandEncoder: GPUCommandEncoder,
    scene: Scene,
    inputs: GPUTexture[]
  ): GPUTexture[] {
    if (!this.inputTextureViews.length) {
      this.inputTextureViews.push(
        inputs[0].createView({
          baseArrayLayer: 0,
          dimension: '2d',
        })
      )
      this.inputTextureViews.push(
        inputs[0].createView({
          baseArrayLayer: 1,
          dimension: '2d',
        })
      )

      const bindGroup0Entries: GPUBindGroupEntry[] = [
        {
          binding: 0,
          resource: this.inputTextureViews[0],
        },
        {
          binding: 1,
          resource: this.outTextures[0].createView({
            baseArrayLayer: 0,
            dimension: '2d',
          }),
        },
      ]

      this.bindGroupCascade0 = RenderingContext.device.createBindGroup({
        label: 'Copy Depth To Moments Bind Group Cascade 0',
        layout: this.bindGroupLayout,
        entries: bindGroup0Entries,
      })

      const bindGroup1Entries: GPUBindGroupEntry[] = [
        {
          binding: 0,
          resource: this.inputTextureViews[1],
        },
        {
          binding: 1,
          resource: this.outTextures[0].createView({
            baseArrayLayer: 1,
            dimension: '2d',
          }),
        },
      ]

      this.bindGroupCascade1 = RenderingContext.device.createBindGroup({
        label: 'Copy Depth To Moments Bind Group Cascade 1',
        layout: this.bindGroupLayout,
        entries: bindGroup1Entries,
      })
    }

    const workgroupCountX = Math.ceil(
      inputs[0].width / DepthToMomentsDepthComputePass.COMPUTE_WORKGROUP_SIZE_X
    )
    const workgroupCountY = Math.ceil(
      inputs[0].height / DepthToMomentsDepthComputePass.COMPUTE_WORKGROUP_SIZE_Y
    )

    const computePass = commandEncoder.beginComputePass({
      label: 'Copy Depth To Moments Compute Pass',
    })
    computePass.setPipeline(this.computePSO)

    // Copy depth cascade 0
    computePass.setBindGroup(0, this.bindGroupCascade0)
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1)

    // Copy depth cascade 1
    computePass.setBindGroup(0, this.bindGroupCascade1)
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1)

    computePass.end()

    return this.outTextures
  }
}
