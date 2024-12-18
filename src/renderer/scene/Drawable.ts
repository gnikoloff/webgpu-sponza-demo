import {
  StructuredView,
  makeShaderDataDefinitions,
  makeStructuredView,
} from 'webgpu-utils'
import { vec3 } from 'wgpu-matrix'

import { SHADER_CHUNKS } from '../shader/chunks'

import PipelineStates from '../core/PipelineStates'
import {
  BIND_GROUP_LOCATIONS,
  PBR_TEXTURES_LOCATIONS,
  SAMPLER_LOCATIONS,
} from '../core/RendererBindings'
import RenderingContext from '../core/RenderingContext'
import Geometry from '../geometry/Geometry'
import Material from '../material/Material'
import MaterialProps from '../material/MaterialProps'
import BoundingBox from '../math/BoundingBox'
import VRAMUsageTracker from '../misc/VRAMUsageTracker'
import SamplerController from '../texture/SamplerController'
import TextureLoader from '../texture/TextureLoader'
import { RenderPassType, TextureLocation } from '../types'
import Node from './Node'

export default class Drawable extends Node {
  public static readonly INDEX_FORMAT: GPUIndexFormat = 'uint16'

  public geometry: Geometry
  public materialProps = new MaterialProps()

  public firstIndex = 0
  public baseVertex = 0
  public firstInstance = 0
  public instanceCount = 1

  public isOpaque = true

  private modelBuffer: GPUBuffer
  private modelBindGroup: GPUBindGroup
  private texturesBindGroup: GPUBindGroup

  private modelMaterialBindGroupEntries: GPUBindGroupEntry[] = []
  private uploadModelBufferToGPU = true

  private materials: Map<RenderPassType, Material> = new Map()
  private textures: Map<TextureLocation, GPUTexture> = new Map()

  protected bufferUniformValues: StructuredView

  private _worldBoundingBox = new BoundingBox()
  public get worldBoundingBox(): BoundingBox {
    vec3.transformMat4(
      this.geometry.boundingBox.min,
      this.modelMatrix,
      this._worldBoundingBox.min
    )
    vec3.transformMat4(
      this.geometry.boundingBox.max,
      this.modelMatrix,
      this._worldBoundingBox.max
    )
    return this._worldBoundingBox
  }
  public get boundingBox(): BoundingBox {
    return this.geometry.boundingBox
  }
  public set boundingBox(v: BoundingBox) {
    this.geometry.boundingBox = v
  }

  private _sampler: GPUSampler = SamplerController.defaultSampler

  public get sampler(): GPUSampler {
    return this.getSampler()
  }

  public set sampler(v: GPUSampler) {
    this.setSampler(v)
    this.modelMaterialBindGroupEntries[0].resource = v
    this.updateTexturesBindGroup()
  }

  public getSampler(): GPUSampler {
    return this._sampler
  }

  public setSampler(v: GPUSampler) {
    this._sampler = v
  }

  public setTexture(texture: GPUTexture, location: TextureLocation = 1) {
    this.textures.set(location, texture)

    this.modelMaterialBindGroupEntries[location].resource = texture.createView()
    this.updateTexturesBindGroup()
  }

  public getTexture(location: TextureLocation): GPUTexture {
    return this.textures.get(location)
  }

  public get material(): Material {
    return this.materials.get(RenderingContext.getActiveRenderPassType())
  }

  private updateTexturesBindGroup() {
    this.texturesBindGroup = RenderingContext.device.createBindGroup({
      label: 'Model Textures Bind Group',
      layout: PipelineStates.defaultModelMaterialBindGroupLayout,
      entries: this.modelMaterialBindGroupEntries,
    })
  }

  constructor(geometry: Geometry) {
    super()
    this.geometry = geometry

    const modelShaderDefs = makeShaderDataDefinitions(
      SHADER_CHUNKS.ModelUniform
    )

    this.bufferUniformValues = makeStructuredView(
      modelShaderDefs.structs.ModelUniform
    )
    this.modelBuffer = RenderingContext.device.createBuffer({
      label: `${this.label} Model GPUBuffer`,
      size: this.bufferUniformValues.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    VRAMUsageTracker.addBufferBytes(this.modelBuffer)

    const modelBindGroupEntries: GPUBindGroupEntry[] = [
      {
        binding: 0,
        resource: {
          buffer: this.modelBuffer,
        },
      },
    ]

    this.modelBindGroup = RenderingContext.device.createBindGroup({
      layout: PipelineStates.defaultModelBindGroupLayout,
      entries: modelBindGroupEntries,
    })

    this.modelMaterialBindGroupEntries = [
      {
        binding: SAMPLER_LOCATIONS.Default,
        resource: this.sampler,
      },
      {
        binding: PBR_TEXTURES_LOCATIONS.Albedo,
        resource: TextureLoader.dummyTexture.createView(),
      },
      {
        binding: PBR_TEXTURES_LOCATIONS.Normal,
        resource: TextureLoader.dummyTexture.createView(),
      },
      {
        binding: PBR_TEXTURES_LOCATIONS.MetallicRoughness,
        resource: TextureLoader.dummyTexture.createView(),
      },
    ]

    this.texturesBindGroup = RenderingContext.device.createBindGroup({
      label: 'Model Textures Bind Group',
      layout: PipelineStates.defaultModelMaterialBindGroupLayout,
      entries: this.modelMaterialBindGroupEntries,
    })

    this.setTexture(TextureLoader.dummyTexture, PBR_TEXTURES_LOCATIONS.Albedo)
    this.setTexture(TextureLoader.dummyTexture, PBR_TEXTURES_LOCATIONS.Normal)
    this.setTexture(
      TextureLoader.dummyTexture,
      PBR_TEXTURES_LOCATIONS.MetallicRoughness
    )
  }

  public setMaterial(material: Material, forRenderPassType?: RenderPassType) {
    const renderPassType = forRenderPassType ?? RenderPassType.Deferred
    this.materials.set(renderPassType, material)
  }

  public getMaterial(forRenderPassType?: RenderPassType): Material {
    const renderPassType = forRenderPassType ?? RenderPassType.Deferred
    return this.materials.get(renderPassType)
  }

  override updateWorldMatrix(): boolean {
    const updated = super.updateWorldMatrix()
    this.uploadModelBufferToGPU = updated

    return updated
  }

  override preRender(renderEncoder: GPURenderPassEncoder): void {
    if (RenderingContext.ENABLE_DEBUG_GROUPS) {
      renderEncoder.pushDebugGroup(`Render ${this.label}`)
    }

    if (this.uploadModelBufferToGPU) {
      this.bufferUniformValues.set({
        worldMatrix: this.modelMatrix,
        prevFrameWorldMatrix: this.prevFrameModelMatrix,
        normalMatrix: this.normalMatrix,
        isReflective: this.materialProps.isReflective ? 1 : 0,
        baseColor: this.materialProps.color,
        metallic: this.materialProps.metallic,
        roughness: this.materialProps.roughness,
      })
      this.uploadModelBufferToGPU = false
      RenderingContext.device.queue.writeBuffer(
        this.modelBuffer,
        0,
        this.bufferUniformValues.arrayBuffer
      )
    }

    renderEncoder.setIndexBuffer(
      this.geometry.indexBuffer,
      Drawable.INDEX_FORMAT,
      this.geometry.indexBufferOffsets[0]
      // this.geometry.indexBufferOffsets[1],
    )

    for (let i = 0; i < this.geometry.vertexBuffers.length; i++) {
      const offsets = this.geometry.vertexBufferOffsets.get(
        this.geometry.vertexBuffers[i]
      )
      renderEncoder.setVertexBuffer(
        i,
        this.geometry.vertexBuffers[i],
        offsets[0]
        // offsets[1],
      )
    }
    renderEncoder.setBindGroup(BIND_GROUP_LOCATIONS.Model, this.modelBindGroup)

    renderEncoder.setBindGroup(
      BIND_GROUP_LOCATIONS.PBRTextures,
      this.texturesBindGroup
    )
  }

  override onRender(renderEncoder: GPURenderPassEncoder) {
    this.material.bind()

    renderEncoder.drawIndexed(
      this.geometry.indexCount,
      this.instanceCount,
      this.firstIndex,
      this.baseVertex,
      this.firstInstance
    )
  }

  override postRender(renderEncoder: GPURenderPassEncoder): void {
    if (RenderingContext.ENABLE_DEBUG_GROUPS) {
      renderEncoder.popDebugGroup()
    }
  }

  override render(renderEncoder: GPURenderPassEncoder): void {
    if (!this.material) {
      return
    }
    super.render(renderEncoder)
  }
}
