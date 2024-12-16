import { Vec3 } from "wgpu-matrix";
import PipelineStates from "../../renderer/core/PipelineStates";
import RenderingContext from "../../renderer/core/RenderingContext";
import VRAMUsageTracker from "../../renderer/misc/VRAMUsageTracker";
import Transform from "../../renderer/scene/Transform";
import {
	LINE_DEBUG_FRAGMENT_SHADER_ENTRY_FN,
	LINE_DEBUG_SHADER_SRC,
	LINE_DEBUG_VERTEX_SHADER_ENTRY_FN,
} from "../shaders/LineDebugShader";

export default class LineDebugDrawable extends Transform {
	private renderPSO: GPURenderPipeline;
	private pointsGPUBuffer: GPUBuffer;
	private bindGroup: GPUBindGroup;

	constructor(private points: Vec3[]) {
		super();

		this.pointsGPUBuffer = RenderingContext.device.createBuffer({
			label: "Line Points GPU Buffer",
			size: 4 * points.length * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.STORAGE,
			mappedAtCreation: true,
		});
		VRAMUsageTracker.addBufferBytes(this.pointsGPUBuffer);

		const buffContents = new Float32Array(
			this.pointsGPUBuffer.getMappedRange(),
		);

		for (let i = 0; i < points.length; i++) {
			buffContents[i * 4 + 0] = points[i][0];
			buffContents[i * 4 + 1] = points[i][1];
			buffContents[i * 4 + 2] = points[i][2];
			buffContents[i * 4 + 3] = 1;
		}

		this.pointsGPUBuffer.unmap();

		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				buffer: {
					type: "read-only-storage",
				},
				visibility: GPUShaderStage.VERTEX,
			},
		];
		const bindGroupLayout = RenderingContext.device.createBindGroupLayout({
			label: "ParticlesMoveCurve Debug Bind Group Layout",
			entries: bindGroupLayoutEntries,
		});

		const bindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: {
					buffer: this.pointsGPUBuffer,
				},
			},
		];
		this.bindGroup = RenderingContext.device.createBindGroup({
			label: "ParticlesMoveCurve Debug Bind Group",
			layout: bindGroupLayout,
			entries: bindGroupEntries,
		});

		const shaderModule = PipelineStates.createShaderModule(
			LINE_DEBUG_SHADER_SRC,
			"ParticlesMoveCurve Debug Shader Module",
		);
		const colorTargets: GPUColorTargetState[] = [
			{
				format: "rgba16float",
			},
		];

		this.renderPSO = PipelineStates.createRenderPipeline({
			label: "ParticlesMoveCurve Debug Render PSO",
			layout: RenderingContext.device.createPipelineLayout({
				label: "ParticlesMoveCurve Debug Render PSO Layout",
				bindGroupLayouts: [
					PipelineStates.defaultCameraPlusLightsBindGroupLayout,
					bindGroupLayout,
				],
			}),
			vertex: {
				entryPoint: LINE_DEBUG_VERTEX_SHADER_ENTRY_FN,
				module: shaderModule,
			},
			fragment: {
				entryPoint: LINE_DEBUG_FRAGMENT_SHADER_ENTRY_FN,
				module: shaderModule,
				targets: colorTargets,
			},
			depthStencil: {
				format: RenderingContext.depthStencilFormat,
				depthCompare: "less",
				depthWriteEnabled: true,
			},
			primitive: {
				topology: "line-strip",
			},
		});
	}

	public render(renderEncoder: GPURenderPassEncoder): void {
		if (!this.visible) {
			return;
		}

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderEncoder.pushDebugGroup(`Render Debug Line: ${this.label}`);
		}

		renderEncoder.setPipeline(this.renderPSO);
		renderEncoder.setBindGroup(1, this.bindGroup);
		renderEncoder.draw(this.points.length);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderEncoder.popDebugGroup();
		}
	}
}
