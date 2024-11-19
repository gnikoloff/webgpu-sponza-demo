import { Renderer } from "../Renderer";
import { PipelineStates } from "../core/PipelineStates";
import { VertexDescriptor } from "../core/VertexDescriptor";

export interface MaterialProps {
	vertexShaderSrc: string;
	vertexShaderEntryFn: string;
	vertexBuffers?: GPUVertexBufferLayout[];
	fragmentShaderSrc: string;
	fragmentShaderEntryFn: string;
	targets: GPUColorTargetState[];
	depthFormat?: GPUTextureFormat;
	depthWriteEnabled?: boolean;
	depthCompareFn?: GPUCompareFunction;
	topology?: GPUPrimitiveTopology;
	debugLabel?: string;
}

export class Material {
	private renderPSO: GPURenderPipeline;

	constructor({
		vertexShaderSrc,
		vertexShaderEntryFn,
		vertexBuffers = [VertexDescriptor.defaultLayout],
		fragmentShaderSrc,
		fragmentShaderEntryFn,
		targets = [],
		depthFormat = Renderer.depthFormat,
		depthWriteEnabled = true,
		depthCompareFn = "always",
		topology = "triangle-list",
		debugLabel,
	}: MaterialProps) {
		const vertexShaderModule =
			PipelineStates.createShaderModule(vertexShaderSrc);
		const fragmentShaderModule =
			PipelineStates.createShaderModule(fragmentShaderSrc);

		const descriptor: GPURenderPipelineDescriptor = {
			label: debugLabel,
			layout: Renderer.device.createPipelineLayout({
				bindGroupLayouts: [
					PipelineStates.defaultCameraBindGroupLayout,
					PipelineStates.defaultModelBindGroupLayout,
				],
			}),
			vertex: {
				module: vertexShaderModule,
				entryPoint: vertexShaderEntryFn,
				buffers: vertexBuffers,
			},
			fragment: {
				module: fragmentShaderModule,
				entryPoint: fragmentShaderEntryFn,
				targets,
			},
			depthStencil: {
				format: depthFormat,
				depthWriteEnabled,
				depthCompare: depthCompareFn,
			},
			primitive: {
				topology,
				cullMode: "back",
			},
		};

		this.renderPSO = PipelineStates.createRenderPipeline(descriptor);
	}

	public bind(renderEncoder: GPURenderPassEncoder) {
		renderEncoder.setPipeline(this.renderPSO);
	}
}
