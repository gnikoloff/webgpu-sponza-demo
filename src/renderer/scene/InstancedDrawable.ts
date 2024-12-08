import { Mat4, mat4 } from "wgpu-matrix";

import Drawable from "./Drawable";
import Geometry from "../geometry/Geometry";
import Renderer from "../../app/Renderer";
import PipelineStates from "../core/PipelineStates";
import { BIND_GROUP_LOCATIONS } from "../core/RendererBindings";

interface InstanceValue {
	worldMatrix: Mat4;
	roughness: number;
	metallic: number;
}

export default class InstancedDrawable extends Drawable {
	private instanceValues: InstanceValue[] = [];
	private uploadValuesToGPU: Float32Array;

	private instanceBuffer!: GPUBuffer;
	private instanceMatricesBindGroup: GPUBindGroup;

	constructor(geometry: Geometry, maxInstanceCount: number) {
		super(geometry);
		this.instanceCount = maxInstanceCount;
		this.uploadValuesToGPU = new Float32Array(20 * maxInstanceCount);

		for (let i = 0; i < maxInstanceCount; i++) {
			const instanceInput: InstanceValue = {
				worldMatrix: mat4.create(),
				roughness: 0,
				metallic: 1,
			};
			this.instanceValues.push(instanceInput);
		}
	}

	private checkIndexBoundaries(idx: number) {
		if (idx > this.instanceValues.length) {
			throw new Error(
				"Setting instanced matrix at index outside of array boundary",
			);
		}
	}

	public setMatrixAt(at: number, matrix: Mat4): this {
		this.checkIndexBoundaries(at);
		this.instanceValues[at].worldMatrix = matrix;
		return this;
	}

	public setRoughnessAt(at: number, v: number): this {
		this.checkIndexBoundaries(at);
		this.instanceValues[at].roughness = v;
		return this;
	}

	public setMetallicAt(at: number, v: number): this {
		this.checkIndexBoundaries(at);
		this.instanceValues[at].metallic = v;
		return this;
	}

	public updateInstances() {
		if (!this.instanceBuffer) {
			this.instanceBuffer = Renderer.device.createBuffer({
				label: "Drawable Instances GPUBuffer",
				size: this.instanceCount * 20 * Float32Array.BYTES_PER_ELEMENT,
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
				layout: PipelineStates.instancesBindGroupLayout,
				entries: instanceMatricesBindGroupEntries,
			});
		}

		for (let i = 0; i < this.instanceCount; i++) {
			this.uploadValuesToGPU.set(
				this.instanceValues[i].worldMatrix,
				i * 20 + 0,
			);
			this.uploadValuesToGPU.set(
				new Float32Array([this.instanceValues[i].metallic]),
				i * 20 + 16,
			);
			this.uploadValuesToGPU.set(
				new Float32Array([this.instanceValues[i].roughness]),
				i * 20 + 17,
			);
		}

		Renderer.device.queue.writeBuffer(
			this.instanceBuffer,
			0,
			this.uploadValuesToGPU,
		);
	}

	override preRender(renderEncoder: GPURenderPassEncoder): void {
		super.preRender(renderEncoder);
		renderEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.InstanceInputs,
			this.instanceMatricesBindGroup,
		);
	}
}
