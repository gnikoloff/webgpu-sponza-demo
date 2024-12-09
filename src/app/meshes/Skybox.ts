import PipelineStates from "../../renderer/core/PipelineStates";
import RenderingContext from "../../renderer/core/RenderingContext";
import Material from "../../renderer/material/Material";
import Drawable from "../../renderer/scene/Drawable";
import SamplerController from "../../renderer/texture/SamplerController";
import { RenderPassType } from "../../renderer/types";
import SkyboxShader, {
	SkyboxShaderFragmentEntryFn,
	SkyboxShaderVertexEntryFn,
} from "../shaders/SkyboxShader";

import GeometryCache from "../utils/GeometryCache";

export default class Skybox extends Drawable {
	private _texture?: GPUTexture;

	private texSamplerBindGroupLayout: GPUBindGroupLayout;
	private texSamplerBindGroup!: GPUBindGroup;

	public set texture(v: GPUTexture) {
		this.setTexture(v);
	}

	public setTexture(texture: GPUTexture) {
		if (texture.depthOrArrayLayers !== 6) {
			return;
		}

		this._texture = texture;

		const texSamplerBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: texture.createView({
					dimension: "cube",
				}),
			},
			{
				binding: 1,
				resource: SamplerController.createSampler({
					minFilter: "linear",
					magFilter: "linear",
					mipmapFilter: "linear",
				}),
			},
		];
		this.texSamplerBindGroup = RenderingContext.device.createBindGroup({
			label: "Skybox Sampler + Texture Bind Group",
			layout: this.texSamplerBindGroupLayout,
			entries: texSamplerBindGroupEntries,
		});
	}

	constructor() {
		super(GeometryCache.unitCubeGeometry);

		this.label = "Skybox";

		const texSamplerBindgroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				texture: {
					viewDimension: "cube",
					sampleType: "float",
				},
				visibility: GPUShaderStage.FRAGMENT,
			},
			{
				binding: 1,
				sampler: {
					type: "filtering",
				},
				visibility: GPUShaderStage.FRAGMENT,
			},
		];
		this.texSamplerBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "Skybox Sampler + Texture Bind Group Layout",
				entries: texSamplerBindgroupLayoutEntries,
			});

		const material = new Material({
			debugLabel: "Skybox Material",
			vertexShaderSrc: SkyboxShader,
			vertexShaderEntryFn: SkyboxShaderVertexEntryFn,
			fragmentShaderSrc: SkyboxShader,
			fragmentShaderEntryFn: SkyboxShaderFragmentEntryFn,
			targets: [
				{
					format: "rgba16float",
				},
			],
			bindGroupLayouts: [
				PipelineStates.defaultCameraBindGroupLayout,
				this.texSamplerBindGroupLayout,
			],
			depthStencilState: {
				format: RenderingContext.depthStencilFormat,
				depthWriteEnabled: false,
				depthCompare: "less-equal",
			},
			primitive: {
				cullMode: "front",
			},
		});

		this.setMaterial(material, RenderPassType.Skybox);
	}

	override preRender(renderEncoder: GPURenderPassEncoder): void {
		super.preRender(renderEncoder);

		if (this._texture) {
			renderEncoder.setBindGroup(1, this.texSamplerBindGroup);
		}
	}

	override render(renderEncoder: GPURenderPassEncoder): void {
		if (!this._texture) {
			return;
		}
		super.render(renderEncoder);
	}
}
