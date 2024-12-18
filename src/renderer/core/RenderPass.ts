import Camera from "../camera/Camera";
import { RenderPassNames } from "../constants";
import RollingAverage from "../math/RollingAverage";
import VRAMUsageTracker from "../misc/VRAMUsageTracker";
import Scene from "../scene/Scene";
import {
	RenderPassTiming,
	RenderPassTimingRange,
	RenderPassTimingResolveBufferState,
	RenderPassType,
} from "../types";
import PipelineStates from "./PipelineStates";
import RenderingContext from "./RenderingContext";

export default class RenderPass {
	public name: string;
	public enabled = true;
	public inputTextureNames: string[] = [];
	public outputTextureNames: string[] = [];

	protected outTextures: GPUTexture[] = [];
	protected inputTextureViews: GPUTextureView[] = [];
	protected renderPassDescriptor!: GPURenderPassDescriptor;
	protected computePassDescriptor!: GPUComputePassDescriptor;
	protected cameraBindGroup?: GPUBindGroup;
	protected camera?: Camera;
	protected debugCamera?: Camera;

	protected querySet?: GPUQuerySet;
	protected resolveBuffer?: GPUBuffer;
	protected resultBuffer?: GPUBuffer;
	protected resultBuffers?: GPUBuffer[] = [];
	protected state: RenderPassTimingResolveBufferState = "free";

	protected gpuTimingAverage = new RollingAverage();

	public destroy() {
		for (const tex of this.outTextures) {
			VRAMUsageTracker.removeTextureBytes(tex);
			tex.destroy();
		}
		this.inputTextureViews.length = 0;
		this.querySet?.destroy();
		if (this.resolveBuffer) {
			VRAMUsageTracker.removeBufferBytes(this.resolveBuffer);
			this.resolveBuffer.destroy();
		}
		this.inputTextureNames.length = 0;
		this.inputTextureViews.length = 0;
		for (const buff of this.resultBuffers) {
			VRAMUsageTracker.removeBufferBytes(buff);
			buff.destroy();
		}
	}

	public resetInputs() {
		this.inputTextureNames.length = 0;
		this.inputTextureViews.length = 0;
		return this;
	}

	constructor(
		public type: RenderPassType,
		public width: number,
		public height: number,
	) {
		this.name = RenderPassNames.get(type);

		if (RenderingContext.supportsGPUTimestampQuery) {
			const renderPassName = RenderPassNames.get(type);
			this.querySet = RenderingContext.device.createQuerySet({
				label: `Timestamp Query for Render Pass: ${renderPassName}`,
				type: "timestamp",
				count: 2,
			});
			this.resolveBuffer = RenderingContext.device.createBuffer({
				label: `Timestamp Query Resolve GPUBuffer for Render Pass: ${renderPassName}`,
				size: 2 * 8,
				usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
			});

			VRAMUsageTracker.addBufferBytes(this.resolveBuffer);
		}
	}

	public clearInputTextures(): this {
		this.inputTextureNames.length = 0;
		this.inputTextureViews.length = 0;
		return this;
	}

	public clearOutputTextures(): this {
		this.outputTextureNames.length = 0;
		return this;
	}

	public addInputTexture(name: string): this {
		this.inputTextureNames.push(name);
		return this;
	}

	public addInputTextures(names: string[]): this {
		this.inputTextureNames.push(...names);
		return this;
	}

	public addOutputTexture(name: string): this {
		this.outputTextureNames.push(name);
		return this;
	}

	public addOutputTextures(names: string[]): this {
		this.outputTextureNames.push(...names);
		return this;
	}

	protected createRenderPassDescriptor(): GPURenderPassDescriptor {
		throw new Error("Needs implementation");
	}

	protected createComputePassDescriptor(): GPUComputePassDescriptor {
		throw new Error("Needs implementation");
	}

	protected augmentRenderPassDescriptorWithTimestampQuery(
		descriptor: GPURenderPassDescriptor,
	): GPURenderPassDescriptor {
		if (RenderingContext.supportsGPUTimestampQuery) {
			descriptor.timestampWrites = {
				querySet: this.querySet,
				beginningOfPassWriteIndex: 0,
				endOfPassWriteIndex: 1,
			};
		}
		return descriptor;
	}

	protected resolveTiming(commandEncoder: GPUCommandEncoder) {
		if (!RenderingContext.supportsGPUTimestampQuery) {
			return;
		}

		this.state = "wait for result";

		const buff = this.resultBuffers.pop();

		if (buff) {
			this.resultBuffer = buff;
		} else {
			this.resultBuffer = RenderingContext.device.createBuffer({
				label: `Timestamp Query Result Buffer for render pass: ${this.name}`,
				size: this.resolveBuffer.size,
				usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
			});
			VRAMUsageTracker.addBufferBytes(this.resultBuffer);
		}

		commandEncoder.resolveQuerySet(
			this.querySet,
			0,
			this.querySet.count,
			this.resolveBuffer,
			0,
		);
		commandEncoder.copyBufferToBuffer(
			this.resolveBuffer,
			0,
			this.resultBuffer,
			0,
			this.resultBuffer.size,
		);
	}

	public async getStartAndEndTimings(): Promise<RenderPassTimingRange> {
		if (!RenderingContext.supportsGPUTimestampQuery) {
			return [0, 0];
		}

		const resultBuffer = this.resultBuffer;

		this.state = "free";

		await resultBuffer.mapAsync(GPUMapMode.READ);
		const times = new BigInt64Array(resultBuffer.getMappedRange());
		const timeOffsets: RenderPassTimingRange = [
			Number(times[0]),
			Number(times[1]),
		];
		resultBuffer.unmap();
		this.resultBuffers.push(resultBuffer);
		return timeOffsets;
	}

	public async getTimingResult(): Promise<RenderPassTiming> {
		if (!RenderingContext.supportsGPUTimestampQuery) {
			return {
				avgValue: 0,
				timings: [0, 0],
			};
		}
		const times = await this.getStartAndEndTimings();

		const duration = (times[1] - times[0]) / 1_000_000;

		this.gpuTimingAverage.addSample(duration);

		return {
			timings: times,
			avgValue: this.gpuTimingAverage.get(),
		};
	}

	public setDebugCamera(camera: Camera) {
		this.debugCamera = camera;
	}

	public toggleDebugCamera(v: boolean) {
		this.cameraBindGroup = RenderingContext.device.createBindGroup({
			label: `Camera Bind Group for: ${RenderPassNames.get(this.type)}`,
			layout: PipelineStates.defaultCameraBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: v ? this.debugCamera.gpuBuffer : this.camera.gpuBuffer,
					},
				},
			],
		});
	}

	public setCamera(camera: Camera): this {
		this.camera = camera;

		this.cameraBindGroup = RenderingContext.device.createBindGroup({
			label: `Camera Bind Group for: ${RenderPassNames.get(this.type)}`,
			layout: PipelineStates.defaultCameraBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: camera.gpuBuffer,
					},
				},
			],
		});
		return this;
	}

	protected postRender(commandEncoder: GPUCommandEncoder) {
		this.resolveTiming(commandEncoder);
	}

	public onFrameEnd() {
		// ...
	}

	public render(
		_commandEncoder: GPUCommandEncoder,
		_scene: Scene,
		_inputs: GPUTexture[],
	): GPUTexture[] {
		throw new Error("Needs implementation");
	}
}
