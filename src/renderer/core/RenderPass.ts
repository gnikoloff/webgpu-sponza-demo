import Renderer from "../../app/Renderer";
import Camera from "../camera/Camera";
import PipelineStates from "./PipelineStates";
import {
	RenderPassTiming,
	RenderPassTimingRange,
	RenderPassTimingResolveBufferState,
	RenderPassType,
} from "../types";
import { RenderPassNames } from "../constants";
import RollingAverage from "../math/RollingAverage";
import Scene from "../scene/Scene";

export default class RenderPass {
	public name: string;
	public inputTextureNames: string[] = [];
	public outputTextureNames: string[] = [];

	protected inputTextureViews: GPUTextureView[] = [];

	protected cameraBindGroup?: GPUBindGroup;
	protected camera?: Camera;
	protected debugCamera?: Camera;

	protected querySet?: GPUQuerySet;
	protected resolveBuffer?: GPUBuffer;
	protected resultBuffer?: GPUBuffer;
	protected resultBuffers?: GPUBuffer[] = [];
	protected state: RenderPassTimingResolveBufferState = "free";

	protected gpuTimingAverage = new RollingAverage();

	constructor(public type: RenderPassType) {
		this.name = RenderPassNames.get(type);

		if (Renderer.supportsGPUTimestampQuery) {
			const renderPassName = RenderPassNames.get(type);
			this.querySet = Renderer.device.createQuerySet({
				label: `Timestamp Query for Render Pass: ${renderPassName}`,
				type: "timestamp",
				count: 2,
			});
			this.resolveBuffer = Renderer.device.createBuffer({
				label: `Timestamp Query Resolve GPUBuffer for Render Pass: ${renderPassName}`,
				size: 2 * 8,
				usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
			});
		}
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

	protected augmentRenderPassDescriptorWithTimestampQuery(
		descriptor: GPURenderPassDescriptor,
	): GPURenderPassDescriptor {
		if (Renderer.supportsGPUTimestampQuery) {
			descriptor.timestampWrites = {
				querySet: this.querySet,
				beginningOfPassWriteIndex: 0,
				endOfPassWriteIndex: 1,
			};
		}
		return descriptor;
	}

	protected resolveTiming(commandEncoder: GPUCommandEncoder) {
		if (!Renderer.supportsGPUTimestampQuery) {
			return;
		}

		this.state = "wait for result";

		this.resultBuffer =
			this.resultBuffers.pop() ||
			Renderer.device.createBuffer({
				label: `Timestamp Query Result Buffer for render pass: ${this.name}`,
				size: this.resolveBuffer.size,
				usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
			});

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
		if (!Renderer.supportsGPUTimestampQuery) {
			return [0, 0];
		}

		this.state = "free";

		const resultBuffer = this.resultBuffer;
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
		if (!Renderer.supportsGPUTimestampQuery) {
			return {
				avgValue: 0,
				timings: [0, 0],
			};
		}
		const times = await this.getStartAndEndTimings();

		const duration = Math.abs(times[1] - times[0]) / 1_000_000;

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
		this.cameraBindGroup = Renderer.device.createBindGroup({
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

		this.cameraBindGroup = Renderer.device.createBindGroup({
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

	public onResize(_width: number, _height: number) {
		// noop
	}

	public render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		throw new Error("Needs implementation");
	}
}
