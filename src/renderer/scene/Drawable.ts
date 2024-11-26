import { mat4 } from "wgpu-matrix";
import {
	StructuredView,
	makeShaderDataDefinitions,
	makeStructuredView,
} from "webgpu-utils";

import { BIND_GROUP_LOCATIONS } from "../../app/constants";
import { SHADER_CHUNKS } from "../shader/chunks";
import Renderer from "../../app/Renderer";
import Geometry from "../geometry/Geometry";
import Material from "../material/Material";
import MaterialProps from "../material/MaterialProps";
import PipelineStates from "../core/PipelineStates";
import Transform from "./Transform";
import { RenderPassType } from "../core/RenderPass";

export default class Drawable extends Transform {
	public static readonly INDEX_FORMAT: GPUIndexFormat = "uint16";

	public geometry: Geometry;
	// public material: Material;
	public materialProps = new MaterialProps();

	public firstIndex = 0;
	public baseVertex = 0;
	public firstInstance = 0;
	public instanceCount = 1;

	private modelBuffer: GPUBuffer;
	private modelBindGroup: GPUBindGroup;
	private uploadModelBufferToGPU = true;

	private materials: Map<RenderPassType, Material> = new Map();

	public get material(): Material {
		return this.materials.get(Renderer.activeRenderPass);
	}

	private prevFrameModelMatrix = mat4.create();

	protected bufferUniformValues: StructuredView;

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
			// mappedAtCreation: true,
		});
		// this.matricesUploadArr.set(MAT4x4_IDENTITY_MATRIX, 0);
		// this.matricesUploadArr.set(MAT4x4_IDENTITY_MATRIX, 16);
		// new Float32Array(this.modelBuffer.getMappedRange()).set(
		// 	this.matricesUploadArr,
		// );
		// this.modelBuffer.unmap();

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
			});
			Renderer.device.queue.writeBuffer(
				this.modelBuffer,
				0,
				this.bufferUniformValues.arrayBuffer,
			);
			this.uploadModelBufferToGPU = false;
		}

		renderEncoder.setVertexBuffer(0, this.geometry.vertexBuffer);
		renderEncoder.setIndexBuffer(
			this.geometry.indexBuffer,
			Drawable.INDEX_FORMAT,
		);
		renderEncoder.setBindGroup(BIND_GROUP_LOCATIONS.Model, this.modelBindGroup);
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
