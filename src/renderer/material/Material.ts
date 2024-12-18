import PipelineStates from '../core/PipelineStates'
import RenderingContext from '../core/RenderingContext'
import VertexDescriptor from '../core/VertexDescriptor'
import { IMaterial } from '../types'

export default class Material {
  private renderPSO: GPURenderPipeline

  constructor({
    vertexShaderSrc,
    vertexShaderEntryFn,
    vertexBuffers = VertexDescriptor.defaultLayout,
    fragmentShaderSrc,
    fragmentShaderEntryFn,
    bindGroupLayouts = [
      PipelineStates.defaultCameraBindGroupLayout,
      PipelineStates.defaultModelBindGroupLayout,
      PipelineStates.defaultModelMaterialBindGroupLayout,
    ],
    constants = {},
    targets = [],
    depthStencilState = {
      format: 'depth24plus',
      depthWriteEnabled: true,
      depthCompare: 'less',
    },
    primitive = {
      cullMode: 'back',
      topology: 'triangle-list',
    },
    debugLabel,
  }: IMaterial) {
    const descriptor: GPURenderPipelineDescriptor = {
      label: debugLabel,
      layout: RenderingContext.device.createPipelineLayout({
        bindGroupLayouts: bindGroupLayouts,
      }),
      vertex: {
        module: PipelineStates.createShaderModule(
          vertexShaderSrc,
          `${debugLabel} material vertex shader module`
        ),
        entryPoint: vertexShaderEntryFn,
        buffers: vertexBuffers,
      },
    }

    if (fragmentShaderEntryFn && fragmentShaderSrc && targets.length) {
      const fragmentShaderModule = PipelineStates.createShaderModule(
        fragmentShaderSrc,
        `${debugLabel} material fragment shader module`
      )

      descriptor.fragment = {
        module: fragmentShaderModule,
        entryPoint: fragmentShaderEntryFn,
        targets,
        constants,
      }
    }

    if (depthStencilState) {
      descriptor.depthStencil = depthStencilState
    }

    if (primitive) {
      descriptor.primitive = primitive
    }

    this.renderPSO = PipelineStates.createRenderPipeline(descriptor)
  }

  public bind() {
    RenderingContext.bindRenderPSO(this.renderPSO)
  }
}
