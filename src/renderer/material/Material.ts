import Renderer from "../../app/Renderer";
import PipelineStates from "../core/PipelineStates";
import VertexDescriptor from "../core/VertexDescriptor";

export interface IMaterial {
	vertexShaderSrc: string;
	vertexShaderEntryFn: string;
	vertexBuffers?: GPUVertexBufferLayout[];
	fragmentShaderSrc?: string;
	fragmentShaderEntryFn?: string;
	bindGroupLayouts?: GPUBindGroupLayout[];
	constants?: Record<string, number>;
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
		vertexBuffers = VertexDescriptor.defaultLayout,
		fragmentShaderSrc,
		fragmentShaderEntryFn,
		bindGroupLayouts = [
			PipelineStates.defaultCameraBindGroupLayout,
			PipelineStates.defaultModelBindGroupLayout,
			PipelineStates.defaultModelMaterialBindGroupLayout,
		],
		constants = {},
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
		const descriptor: GPURenderPipelineDescriptor = {
			label: debugLabel,
			layout: Renderer.device.createPipelineLayout({
				bindGroupLayouts: bindGroupLayouts,
			}),
			vertex: {
				module: PipelineStates.createShaderModule(
					vertexShaderSrc,
					`${debugLabel} material vertex shader module`,
				),
				entryPoint: vertexShaderEntryFn,
				buffers: vertexBuffers,
			},
		};

		if (fragmentShaderEntryFn && fragmentShaderSrc && targets.length) {
			const fragmentShaderModule = PipelineStates.createShaderModule(
				fragmentShaderSrc,
				`${debugLabel} material fragment shader module`,
			);

			descriptor.fragment = {
				module: fragmentShaderModule,
				entryPoint: fragmentShaderEntryFn,
				targets,
				constants,
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
