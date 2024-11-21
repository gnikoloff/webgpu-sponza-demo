import Renderer from "../../app/Renderer";
import PipelineStates from "../core/PipelineStates";
import { VertexDescriptor } from "../core/VertexDescriptor";

export interface IMaterial {
	vertexShaderSrc: string;
	vertexShaderEntryFn: string;
	vertexBuffers?: GPUVertexBufferLayout[];
	fragmentShaderSrc: string;
	fragmentShaderEntryFn: string;
	bindGroupLayouts?: GPUBindGroupLayout[];
	targets: GPUColorTargetState[];
	depthFormat?: GPUTextureFormat;
	hasDepthStencilState?: boolean;
	depthWriteEnabled?: boolean;
	depthCompareFn?: GPUCompareFunction;
	topology?: GPUPrimitiveTopology;
	debugLabel?: string;
}

export default class Material {
	private renderPSO: GPURenderPipeline;

	constructor({
		vertexShaderSrc,
		vertexShaderEntryFn,
		vertexBuffers = [VertexDescriptor.defaultLayout],
		fragmentShaderSrc,
		fragmentShaderEntryFn,
		bindGroupLayouts = [
			PipelineStates.defaultCameraBindGroupLayout,
			PipelineStates.defaultModelBindGroupLayout,
		],
		targets = [],
		depthFormat = Renderer.depthFormat,
		hasDepthStencilState = true,
		depthWriteEnabled = true,
		depthCompareFn = "less",
		topology = "triangle-list",
		debugLabel,
	}: IMaterial) {
		const vertexShaderModule =
			PipelineStates.createShaderModule(vertexShaderSrc);
		const fragmentShaderModule =
			PipelineStates.createShaderModule(fragmentShaderSrc);

		const descriptor: GPURenderPipelineDescriptor = {
			label: debugLabel,
			layout: Renderer.device.createPipelineLayout({
				bindGroupLayouts: bindGroupLayouts,
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
			primitive: {
				topology,
				cullMode: "none",
			},
		};

		if (hasDepthStencilState) {
			descriptor.depthStencil = {
				format: depthFormat,
				depthWriteEnabled,
				depthCompare: depthCompareFn,
			};
		}

		this.renderPSO = PipelineStates.createRenderPipeline(descriptor);
	}

	public bind(renderEncoder: GPURenderPassEncoder) {
		renderEncoder.setPipeline(this.renderPSO);
	}
}
