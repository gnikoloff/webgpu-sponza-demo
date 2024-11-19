import { Renderer } from "../Renderer";
import { BIND_GROUP_LOCATIONS } from "../constants";
import { Geometry } from "../geometry/Geometry";
import { Material } from "../material/Material";
import { PipelineStates } from "./PipelineStates";
import { Transform } from "./Transform";

export default class Drawable extends Transform {
	public geometry: Geometry;
	public material: Material;

	public firstIndex = 0;
	public baseVertex = 0;
	public firstInstance = 0;
	public instanceCount = 1;

	private modelBuffer: GPUBuffer;
	private modelBindGroup: GPUBindGroup;
	private uploadModelBufferToGPU = true;

	constructor(geometry: Geometry) {
		super();
		this.geometry = geometry;

		this.modelBuffer = Renderer.device.createBuffer({
			label: `${this.label} Model GPUBuffer`,
			size: 16 * Float32Array.BYTES_PER_ELEMENT,
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
	}

	override updateWorldMatrix(): boolean {
		const updated = super.updateWorldMatrix();
		this.uploadModelBufferToGPU = updated;

		return updated;
	}

	override preRender(renderEncoder: GPURenderPassEncoder): void {
		renderEncoder.pushDebugGroup(`Render Object ${this.label}`);

		if (this.uploadModelBufferToGPU) {
			Renderer.device.queue.writeBuffer(this.modelBuffer, 0, this.modelMatrix);

			this.uploadModelBufferToGPU = false;
		}

		renderEncoder.setVertexBuffer(0, this.geometry.vertexBuffer);
		renderEncoder.setIndexBuffer(this.geometry.indexBuffer, "uint16");
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
	}
}
