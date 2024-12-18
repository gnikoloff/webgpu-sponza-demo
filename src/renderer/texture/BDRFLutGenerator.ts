import BaseUtilObject from '../core/BaseUtilObject'
import PipelineStates from '../core/PipelineStates'
import RenderingContext from '../core/RenderingContext'
import VRAMUsageTracker from '../misc/VRAMUsageTracker'
import BDRFLutShaderUtils, {
  BDRFLutShaderEntryFn,
} from '../shader/BDRFLutShaderUtils'

let _computePSO: GPUComputePipeline

const _computePSOBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
  {
    binding: 0,
    visibility: GPUShaderStage.COMPUTE,
    storageTexture: {
      access: 'write-only',
      format: 'rgba16float',
      viewDimension: '2d',
    },
  },
]

export default class BDRFLutGenerator extends BaseUtilObject {
  private static get computePSO(): GPUComputePipeline {
    if (_computePSO) {
      return _computePSO
    }

    const computePSOBindGroupLayout =
      RenderingContext.device.createBindGroupLayout({
        label: 'BDRF Lut Compute PSO Bind Group Layout',
        entries: _computePSOBindGroupLayoutEntries,
      })

    _computePSO = RenderingContext.device.createComputePipeline({
      label: 'BDRF LUT Generate Compute PSO',
      compute: {
        module: PipelineStates.createShaderModule(BDRFLutShaderUtils),
        entryPoint: BDRFLutShaderEntryFn,
      },
      layout: RenderingContext.device.createPipelineLayout({
        label: 'BDRF LUT Generation Compute PSO Layout',
        bindGroupLayouts: [computePSOBindGroupLayout],
      }),
    })

    return _computePSO
  }

  public static encode = (outSize = 512): GPUTexture => {
    const outTexture = RenderingContext.device.createTexture({
      label: 'BDRF LUT Texture',
      size: { width: outSize, height: outSize, depthOrArrayLayers: 1 },
      // webgpu does not support rg16float as storage textures
      // let's create rgba16float (we will use only the .rg channels)
      format: 'rgba16float',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST,
      mipLevelCount: 1,
    })

    const commandBuffer = RenderingContext.device.createCommandEncoder({
      label: 'BDRF LUT Generate Command Encoder',
    })
    if (RenderingContext.ENABLE_DEBUG_GROUPS) {
      commandBuffer.pushDebugGroup('BDRF LUT Generation')
    }

    const computePass = commandBuffer.beginComputePass({
      label: 'BDRF LUT Generate Compute Pass',
    })
    const computePSOBindGroupLayout =
      RenderingContext.device.createBindGroupLayout({
        label: 'BDRF Lut Compute PSO Bind Group Layout',
        entries: _computePSOBindGroupLayoutEntries,
      })

    const entries: GPUBindGroupEntry[] = [
      {
        binding: 0,
        resource: outTexture.createView(),
      },
    ]

    const inputBindGroup = RenderingContext.device.createBindGroup({
      label: 'BDRF LUT Generate Input Bind Group',
      layout: computePSOBindGroupLayout,
      entries,
    })

    const workgroupSizePerDim = 8

    const workgroupCountX =
      (outSize + workgroupSizePerDim - 1) / workgroupSizePerDim
    const workgroupCountY =
      (outSize + workgroupSizePerDim - 1) / workgroupSizePerDim

    computePass.setPipeline(BDRFLutGenerator.computePSO)
    computePass.setBindGroup(0, inputBindGroup)
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1)

    computePass.end()
    if (RenderingContext.ENABLE_DEBUG_GROUPS) {
      commandBuffer.popDebugGroup()
    }
    RenderingContext.device.queue.submit([commandBuffer.finish()])

    VRAMUsageTracker.addTextureBytes(outTexture)

    return outTexture
  }
}
