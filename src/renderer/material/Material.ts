import Renderer from "../../app/Renderer";
import PipelineStates from "../core/PipelineStates";
import { VertexDescriptor } from "../core/VertexDescriptor";

export interface IMaterial {
	vertexShaderSrc: string;
	vertexShaderEntryFn: string;
	vertexBuffers?: GPUVertexBufferLayout[];
	fragmentShaderSrc?: string;
	fragmentShaderEntryFn?: string;
	bindGroupLayouts?: GPUBindGroupLayout[];
	targets?: GPUColorTargetState[];
	depthStencilState?: GPUDepthStencilState;
	primitive?: GPUPrimitiveState;
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
		depthStencilState = {
			format: "depth32float",
			depthWriteEnabled: true,
			depthCompare: "less",
		},
		primitive = {
			cullMode: "back",
			topology: "triangle-list",
		},
		debugLabel,
	}: IMaterial) {
		const vertexShaderModule =
			PipelineStates.createShaderModule(vertexShaderSrc);

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
		};

		if (fragmentShaderEntryFn && fragmentShaderSrc && targets.length) {
			const fragmentShaderModule =
				PipelineStates.createShaderModule(fragmentShaderSrc);

			descriptor.fragment = {
				module: fragmentShaderModule,
				entryPoint: fragmentShaderEntryFn,
				targets,
			};
		}

		if (depthStencilState) {
			descriptor.depthStencil = depthStencilState;
		}

		if (primitive) {
			descriptor.primitive = primitive;
		}

		this.renderPSO = PipelineStates.createRenderPipeline(descriptor);
	}

	public bind(renderEncoder: GPURenderPassEncoder) {
		renderEncoder.setPipeline(this.renderPSO);
	}
}
