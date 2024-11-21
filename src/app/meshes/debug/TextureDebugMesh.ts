import Drawable from "../../../renderer/scene/Drawable";
import PipelineStates from "../../../renderer/core/PipelineStates";
import Material from "../../../renderer/material/Material";

import {
	FRAGMENT_SHADER_DEBUG_TEXTURE_ENTRY_FN,
	getDebugFragmentShader,
} from "../../shaders/FragmentShader";

import GeometryCache from "../../utils/GeometryCache";
import Renderer from "../../Renderer";
import {
	VERTEX_SHADER_DEFAULT_ENTRY_FN,
	getVertexShader,
} from "../../shaders/VertexShader";

export enum TextureDebugMeshType {
	Normal,
	Reflectance,
	Albedo,
	Depth,
}

export default class TextureDebugMesh extends Drawable {
	private samplerTextureBindGroup: GPUBindGroup;

	constructor(type: TextureDebugMeshType, debugTextureView: GPUTextureView) {
		super(GeometryCache.defaultPlaneGeometry);

		const sampler = Renderer.device.createSampler({
			magFilter: "nearest",
			minFilter: "nearest",
		});

		const samplerTextureBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {
					type: "filtering",
				},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: type === TextureDebugMeshType.Depth ? "depth" : "float",
				},
			},
		];
		const samplerTextureBindGroupLayout = Renderer.device.createBindGroupLayout(
			{
				label: "TextureDebugMesh Sampler + Texture GPUBindGroupLayout",
				entries: samplerTextureBindGroupLayoutEntries,
			},
		);

		const samplerTextureBindGroupEntries = [
			{
				binding: 0,
				resource: sampler,
			},
			{
				binding: 1,
				resource: debugTextureView,
			},
		];

		this.samplerTextureBindGroup = Renderer.device.createBindGroup({
			layout: samplerTextureBindGroupLayout,
			entries: samplerTextureBindGroupEntries,
		});
		this.material = new Material({
			debugLabel: "Debug Material",
			vertexShaderSrc: getVertexShader(),
			vertexShaderEntryFn: VERTEX_SHADER_DEFAULT_ENTRY_FN,
			fragmentShaderSrc: getDebugFragmentShader(type),
			fragmentShaderEntryFn: FRAGMENT_SHADER_DEBUG_TEXTURE_ENTRY_FN,
			bindGroupLayouts: [
				PipelineStates.defaultCameraBindGroupLayout,
				PipelineStates.defaultModelBindGroupLayout,
				samplerTextureBindGroupLayout,
			],
			targets: [
				{
					format: Renderer.pixelFormat,
				},
			],
			hasDepthStencilState: false,
			depthCompareFn: "always",
			depthWriteEnabled: false,
		});
	}

	override preRender(renderEncoder: GPURenderPassEncoder): void {
		super.preRender(renderEncoder);
		renderEncoder.setBindGroup(2, this.samplerTextureBindGroup);
	}
}
