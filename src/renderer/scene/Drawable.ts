import { mat4 } from "wgpu-matrix";
import {
	StructuredView,
	makeShaderDataDefinitions,
	makeStructuredView,
} from "webgpu-utils";

import { SHADER_CHUNKS } from "../shader/chunks";

import Renderer from "../../app/Renderer";
import Geometry from "../geometry/Geometry";
import Material from "../material/Material";
import MaterialProps from "../material/MaterialProps";
import PipelineStates from "../core/PipelineStates";
import TextureLoader from "../texture/TextureLoader";
import SamplerController from "../texture/SamplerController";
import Transform from "./Transform";
import { RenderPassType } from "../core/RenderPass";
import {
	BIND_GROUP_LOCATIONS,
	PBR_TEXTURES_LOCATIONS,
	SAMPLER_LOCATIONS,
	TextureLocation,
} from "../core/RendererBindings";

export default class Drawable extends Transform {
	public static readonly INDEX_FORMAT: GPUIndexFormat = "uint16";

	public geometry: Geometry;
	public materialProps = new MaterialProps();

	public firstIndex = 0;
	public baseVertex = 0;
	public firstInstance = 0;
	public instanceCount = 1;

	private modelBuffer: GPUBuffer;
	private modelBindGroup: GPUBindGroup;
	private texturesBindGroup: GPUBindGroup;

	private modelMaterialBindGroupEntries: GPUBindGroupEntry[] = [];
	private uploadModelBufferToGPU = true;

	private materials: Map<RenderPassType, Material> = new Map();
	private textures: Map<TextureLocation, GPUTexture> = new Map();

	private prevFrameModelMatrix = mat4.create();

	protected bufferUniformValues: StructuredView;

	private _sampler: GPUSampler = SamplerController.defaultSampler;

	public get sampler(): GPUSampler {
		return this.getSampler();
	}

	public set sampler(v: GPUSampler) {
		this.setSampler(v);
	}

	public getSampler(): GPUSampler {
		return this._sampler;
	}

	public setSampler(v: GPUSampler) {
		this._sampler = v;
	}

	public setTexture(texture: GPUTexture, location: TextureLocation = 1) {
		this.textures.set(location, texture);

		this.modelMaterialBindGroupEntries[location].resource =
			texture.createView();
		this.texturesBindGroup = Renderer.device.createBindGroup({
			label: "Model Textures Bind Group",
			layout: PipelineStates.defaultModelMaterialBindGroupLayout,
			entries: this.modelMaterialBindGroupEntries,
		});
	}

	public getTexture(location: TextureLocation): GPUTexture {
		return this.textures.get(location);
	}

	public get material(): Material {
		return this.materials.get(Renderer.activeRenderPass);
	}

	constructor(geometry: Geometry) {
		super();
		this.geometry = geometry;

		const modelShaderDefs = makeShaderDataDefinitions(
			SHADER_CHUNKS.ModelUniform,
		);

		this.bufferUniformValues = makeStructuredView(
			modelShaderDefs.structs.ModelUniform,
		);
		this.modelBuffer = Renderer.device.createBuffer({
			label: `${this.label} Model GPUBuffer`,
			size: this.bufferUniformValues.arrayBuffer.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		const modelBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: {
					buffer: this.modelBuffer,
				},
			},
		];

		this.modelBindGroup = Renderer.device.createBindGroup({
			layout: PipelineStates.defaultModelBindGroupLayout,
			entries: modelBindGroupEntries,
		});

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
		];

		this.texturesBindGroup = Renderer.device.createBindGroup({
			label: "Model Textures Bind Group",
			layout: PipelineStates.defaultModelMaterialBindGroupLayout,
			entries: this.modelMaterialBindGroupEntries,
		});

		this.setTexture(TextureLoader.dummyTexture, PBR_TEXTURES_LOCATIONS.Albedo);
		this.setTexture(TextureLoader.dummyTexture, PBR_TEXTURES_LOCATIONS.Normal);
		this.setTexture(
			TextureLoader.dummyTexture,
			PBR_TEXTURES_LOCATIONS.MetallicRoughness,
		);
	}

	public setMaterial(material: Material, forRenderPassType?: RenderPassType) {
		let renderPassType = forRenderPassType ?? RenderPassType.Deferred;
		this.materials.set(renderPassType, material);
	}

	public getMaterial(forRenderPassType?: RenderPassType): Material {
		let renderPassType = forRenderPassType ?? RenderPassType.Deferred;
		return this.materials.get(renderPassType);
	}

	override updateWorldMatrix(): boolean {
		const updated = super.updateWorldMatrix();
		this.uploadModelBufferToGPU = updated;

		return updated;
	}

	override preRender(renderEncoder: GPURenderPassEncoder): void {
		renderEncoder.pushDebugGroup(`Render Object ${this.label}`);

		if (this.uploadModelBufferToGPU) {
			this.bufferUniformValues.set({
				worldMatrix: this.modelMatrix,
				prevFrameWorldMatrix: this.prevFrameModelMatrix,
				normalMatrix: this.normalMatrix,
				isReflective: this.materialProps.isReflective ? 1 : 0,
				baseColor: this.materialProps.color,
				metallic: this.materialProps.metallic,
				roughness: this.materialProps.roughness,
			});
			Renderer.device.queue.writeBuffer(
				this.modelBuffer,
				0,
				this.bufferUniformValues.arrayBuffer,
			);
			this.uploadModelBufferToGPU = false;
		}

		if (this.geometry.indexBuffer) {
			renderEncoder.setIndexBuffer(
				this.geometry.indexBuffer,
				Drawable.INDEX_FORMAT,
			);
		}
		renderEncoder.setVertexBuffer(0, this.geometry.vertexBuffer);
		renderEncoder.setBindGroup(BIND_GROUP_LOCATIONS.Model, this.modelBindGroup);
		// renderEncoder.setBindGroup(
		// 	BIND_GROUP_LOCATIONS.Samplers,
		// 	this.samplersBindGroup,
		// );
		renderEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.PBRTextures,
			this.texturesBindGroup,
		);
	}

	override onRender(renderEncoder: GPURenderPassEncoder) {
		this.material.bind(renderEncoder);

		renderEncoder.drawIndexed(
			this.geometry.vertexCount,
			this.instanceCount,
			this.firstIndex,
			this.baseVertex,
			this.firstInstance,
		);
	}

	override postRender(renderEncoder: GPURenderPassEncoder): void {
		renderEncoder.popDebugGroup();

		mat4.copy(this.modelMatrix, this.prevFrameModelMatrix);
		this.uploadModelBufferToGPU = true;
	}

	override render(renderEncoder: GPURenderPassEncoder): void {
		if (!this.material) {
			return;
		}
		super.render(renderEncoder);
	}
}
