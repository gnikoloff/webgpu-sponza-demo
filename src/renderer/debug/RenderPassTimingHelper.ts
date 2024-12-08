import Renderer from "../../app/Renderer";
import { RenderPassNames } from "../constants";
import { RenderPassType } from "../types";

type RenderPassTimigHelperState = "free" | "need resolve" | "wait for result";

export default class RenderPassTimingHelper {
	private canTimestamp = Renderer.supportsGPUTimestampQuery;
	private querySet?: GPUQuerySet;
	private resolveBuffer?: GPUBuffer;
	private resultBuffer?: GPUBuffer;
	private resultBuffers?: GPUBuffer[] = [];
	private state: RenderPassTimigHelperState = "free";

	public name: string;

	constructor(protected type: RenderPassType) {
		this.name = RenderPassNames.get(type);
		if (!this.canTimestamp) {
			return;
		}
		this.querySet = Renderer.device.createQuerySet({
			type: "timestamp",
			count: 2,
		});

		this.resolveBuffer = Renderer.device.createBuffer({
			label: `Timestamp Query Resolve Buffer for pass: ${this.name}`,
			size: 2 * 8,
			usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
		});
	}

	protected getTimestampedRenderPassDescriptor(
		descriptor: GPURenderPassDescriptor,
	): GPURenderPassDescriptor {
		if (this.canTimestamp) {
			descriptor.timestampWrites = {
				querySet: this.querySet,
				beginningOfPassWriteIndex: 0,
				endOfPassWriteIndex: 1,
			};
		}
		return descriptor;
	}

	protected resolveTiming(commandEncoder: GPUCommandEncoder) {
		if (!this.canTimestamp) {
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

	public async getResult(): Promise<number> {
		if (!this.canTimestamp) {
			return 0;
		}

		this.state = "free";

		const resultBuffer = this.resultBuffer;
		await resultBuffer.mapAsync(GPUMapMode.READ);
		const times = new BigInt64Array(resultBuffer.getMappedRange());
		const duration = Math.abs(Number(times[1] - times[0])) / 1_000_000;
		resultBuffer.unmap();
		this.resultBuffers.push(resultBuffer);
		return duration;
	}
}
