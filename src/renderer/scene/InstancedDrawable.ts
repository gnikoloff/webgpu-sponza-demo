import { Mat4, mat4 } from "wgpu-matrix";
import Drawable from "./Drawable";
import Geometry from "../geometry/Geometry";
import Renderer from "../../app/Renderer";
import PipelineStates from "../core/PipelineStates";
import { BIND_GROUP_LOCATIONS } from "../../app/constants";

export default class InstancedDrawable extends Drawable {
	private instanceMatrices: Mat4[] = [];
	private uploadMatricesToGPUArr: Float32Array;

	private instanceBuffer!: GPUBuffer;
	private instanceMatricesBindGroup: GPUBindGroup;

	constructor(geometry: Geometry, maxInstanceCount: number) {
		super(geometry);
		this.instanceCount = maxInstanceCount;
		this.uploadMatricesToGPUArr = new Float32Array(maxInstanceCount * 16);

		for (let i = 0; i < maxInstanceCount; i++) {
			this.instanceMatrices.push(mat4.create());
		}
	}

	public setMatrixAt(at: number, matrix: Mat4) {
		if (at > this.instanceMatrices.length) {
			throw new Error(
				"Setting instanced matrix at index outside of array boundary",
			);
		}
		this.instanceMatrices[at] = matrix;
	}

	public updateInstances() {
		if (!this.instanceBuffer) {
			this.instanceBuffer = Renderer.device.createBuffer({
				label: "Drawable Instances GPUBuffer",
				size: this.instanceCount * 16 * Float32Array.BYTES_PER_ELEMENT,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			});

			const instanceMatricesBindGroupEntries: GPUBindGroupEntry[] = [
				{
					binding: 0,
					resource: {
						buffer: this.instanceBuffer,
					},
				},
			];

			this.instanceMatricesBindGroup = Renderer.device.createBindGroup({
				layout: PipelineStates.instanceMatricesBindGroupLayout,
				entries: instanceMatricesBindGroupEntries,
			});
		}

		for (let i = 0; i < this.instanceCount; i++) {
			this.uploadMatricesToGPUArr.set(this.instanceMatrices[i], i * 16);
		}

		Renderer.device.queue.writeBuffer(
			this.instanceBuffer,
			0,
			this.uploadMatricesToGPUArr,
		);
	}

	override preRender(renderEncoder: GPURenderPassEncoder): void {
		super.preRender(renderEncoder);
		renderEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.InstanceMatrices,
			this.instanceMatricesBindGroup,
		);
	}
}
