import PipelineStates from '../../renderer/core/PipelineStates'
import RenderPass from '../../renderer/core/RenderPass'
import RenderingContext from '../../renderer/core/RenderingContext'
import VRAMUsageTracker from '../../renderer/misc/VRAMUsageTracker'
import Scene from '../../renderer/scene/Scene'
import SamplerController from '../../renderer/texture/SamplerController'
import { RenderPassType } from '../../renderer/types'
import {
  BLUR_MOMENTS_AXIS_GAUSSIAN_SHADER_ENTRY_FN,
  BLUR_MOMENTS_AXIS_GAUSSIAN_SHADER_SRC,
} from '../shaders/BlurMomentsDepthAxisGaussianShader'
import DirectionalShadowRenderPass from './DirectionalShadowRenderPass'

export default class MomentsDepthBlurComputePass extends RenderPass {
  private static readonly COMPUTE_WORKGROUP_SIZE_X = 16
  private static readonly COMPUTE_WORKGROUP_SIZE_Y = 16
  private static readonly BLUR_KERNEL_SIZE = 16

  static generateGaussianKernel(sigma: number): Float32Array {
    // Ensure odd kernel size
    const kernelSize = 2 * this.BLUR_KERNEL_SIZE + 1
    const kernel = new Float32Array(kernelSize)

    // Precompute normalization factor
    let sum = 0

    // Generate Gaussian kernel weights
    for (let x = -this.BLUR_KERNEL_SIZE; x <= this.BLUR_KERNEL_SIZE; x++) {
      const weight = Math.exp(-(x * x) / (2 * sigma * sigma))
      const kernelIndex = x + this.BLUR_KERNEL_SIZE
      kernel[kernelIndex] = weight
      sum += weight
    }

    // Normalize the kernel
    for (let i = 0; i < kernelSize; i++) {
      kernel[i] /= sum
    }

    return kernel
  }

  private computePSO: GPUComputePipeline
  private bindGroupLayout: GPUBindGroupLayout
  private bindGroupHorizontalBlurCascade0!: GPUBindGroup
  private bindGroupVerticalBlurCascade0!: GPUBindGroup
  private bindGroupHorizontalBlurCascade1!: GPUBindGroup
  private bindGroupVerticalBlurCascade1!: GPUBindGroup

  private blurDirHorizontalBuffer: GPUBuffer
  private blurDirVerticalBuffer: GPUBuffer

  public override async destroy() {
    super.destroy()
    await RenderingContext.device.queue.onSubmittedWorkDone()
    VRAMUsageTracker.removeBufferBytes(this.blurDirHorizontalBuffer)
    VRAMUsageTracker.removeBufferBytes(this.blurDirVerticalBuffer)
    this.blurDirHorizontalBuffer.destroy()
    this.blurDirVerticalBuffer.destroy()
  }

  constructor(width: number, height: number) {
    super(RenderPassType.BlurMomentsShadow, width, height)

    const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        texture: {},
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
      {
        binding: 2,
        sampler: {},
        visibility: GPUShaderStage.COMPUTE,
      },
      {
        binding: 3,
        buffer: {},
        visibility: GPUShaderStage.COMPUTE,
      },
    ]
    this.bindGroupLayout = RenderingContext.device.createBindGroupLayout({
      label: 'Moments Depth Blur Bind Group Layout',
      entries: bindGroupLayoutEntries,
    })

    this.computePSO = PipelineStates.createComputePipeline({
      label: 'Moments Depth Blur Compute PSO',
      layout: RenderingContext.device.createPipelineLayout({
        label: 'Moments Depth Blur Compute PSO Layout',
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      compute: {
        entryPoint: BLUR_MOMENTS_AXIS_GAUSSIAN_SHADER_ENTRY_FN,
        module: PipelineStates.createShaderModule(
          BLUR_MOMENTS_AXIS_GAUSSIAN_SHADER_SRC,
          'Blur Moments Depth Shader Module'
        ),
        constants: {
          WORKGROUP_SIZE_X:
            MomentsDepthBlurComputePass.COMPUTE_WORKGROUP_SIZE_X,
          WORKGROUP_SIZE_Y:
            MomentsDepthBlurComputePass.COMPUTE_WORKGROUP_SIZE_Y,
        },
      },
    })

    this.outTextures.push(
      RenderingContext.device.createTexture({
        label: 'Moments Depth Blur Texture',
        size: {
          width: DirectionalShadowRenderPass.TEXTURE_SIZE,
          height: DirectionalShadowRenderPass.TEXTURE_SIZE,
          depthOrArrayLayers:
            DirectionalShadowRenderPass.TEXTURE_CASCADES_COUNT,
        },
        usage:
          GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        format: 'rg32float',
      })
    )

    VRAMUsageTracker.addTextureBytes(this.outTextures[0])

    this.blurDirHorizontalBuffer = RenderingContext.device.createBuffer({
      label: 'Moments Depth Horizontal Blur Direction GPU Buffer',
      size: 1 * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    })

    VRAMUsageTracker.addBufferBytes(this.blurDirHorizontalBuffer)

    new Uint32Array(this.blurDirHorizontalBuffer.getMappedRange()).set([0])

    this.blurDirHorizontalBuffer.unmap()

    this.blurDirVerticalBuffer = RenderingContext.device.createBuffer({
      label: 'Moments Depth Vertical Blur Direction GPU Buffer',
      size: 1 * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    })

    VRAMUsageTracker.addBufferBytes(this.blurDirVerticalBuffer)

    new Uint32Array(this.blurDirVerticalBuffer.getMappedRange()).set([1])

    this.blurDirVerticalBuffer.unmap()
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

      const bindGroupCascadeEntries: GPUBindGroupEntry[] = [
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
        {
          binding: 2,
          resource: SamplerController.createSampler({
            minFilter: 'linear',
            magFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
          }),
        },
        {
          binding: 3,
          resource: {
            buffer: this.blurDirHorizontalBuffer,
          },
        },
      ]

      this.bindGroupHorizontalBlurCascade0 =
        RenderingContext.device.createBindGroup({
          label: 'Moments Depth Horizontal Blur Bind Group Cascade 0',
          entries: bindGroupCascadeEntries,
          layout: this.bindGroupLayout,
        })
      bindGroupCascadeEntries[3].resource = {
        buffer: this.blurDirVerticalBuffer,
      }
      this.bindGroupVerticalBlurCascade0 =
        RenderingContext.device.createBindGroup({
          label: 'Moments Depth Vertical Blur Bind Group Cascade 0',
          entries: bindGroupCascadeEntries,
          layout: this.bindGroupLayout,
        })

      bindGroupCascadeEntries[0].resource = this.inputTextureViews[1]
      bindGroupCascadeEntries[1].resource = this.outTextures[0].createView({
        baseArrayLayer: 1,
        dimension: '2d',
      })
      bindGroupCascadeEntries[3].resource = {
        buffer: this.blurDirHorizontalBuffer,
      }
      this.bindGroupHorizontalBlurCascade1 =
        RenderingContext.device.createBindGroup({
          label: 'Moments Depth Horizontal Blur Bind Group Cascade 1',
          entries: bindGroupCascadeEntries,
          layout: this.bindGroupLayout,
        })
      bindGroupCascadeEntries[3].resource = {
        buffer: this.blurDirVerticalBuffer,
      }
      this.bindGroupVerticalBlurCascade1 =
        RenderingContext.device.createBindGroup({
          label: 'Moments Depth Vertical Blur Bind Group Cascade 1',
          entries: bindGroupCascadeEntries,
          layout: this.bindGroupLayout,
        })
    }

    const workgroupCountX = Math.ceil(
      inputs[0].width / MomentsDepthBlurComputePass.COMPUTE_WORKGROUP_SIZE_X
    )
    const workgroupCountY = Math.ceil(
      inputs[0].height / MomentsDepthBlurComputePass.COMPUTE_WORKGROUP_SIZE_Y
    )

    const computePass = commandEncoder.beginComputePass({
      label: 'Moments Depth Blur Compute Pass',
    })

    computePass.setPipeline(this.computePSO)

    computePass.setBindGroup(0, this.bindGroupHorizontalBlurCascade0)
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1)
    computePass.setBindGroup(0, this.bindGroupVerticalBlurCascade0)
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1)

    computePass.setBindGroup(0, this.bindGroupHorizontalBlurCascade1)
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1)
    computePass.setBindGroup(0, this.bindGroupVerticalBlurCascade1)
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1)

    computePass.end()

    this.postRender(commandEncoder)

    return this.outTextures
  }
}
