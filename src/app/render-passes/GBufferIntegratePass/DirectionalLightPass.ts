import PipelineStates from "../../../renderer/core/PipelineStates";
import { LightType } from "../../../renderer/lighting/Light";
import SamplerController from "../../../renderer/texture/SamplerController";
import TextureLoader from "../../../renderer/texture/TextureLoader";
import Renderer from "../../Renderer";
import FullscreenTriangleShader, {
	FullscreenTriangleShaderEntryFn,
} from "../../shaders/FullscreenTriangleShader";
import DirectionalShadowPass from "../DirectionalShadowPass";
import LightPass from "./LightPass";
import GetGBufferIntegrateShader, {
	GBufferIntegrateShaderEntryFn,
} from "./shader/GBufferIntegrateShader";

export class DirectionalLightPass extends LightPass {
	private renderPSO: GPURenderPipeline;
	private dirLightShadowBindGroupLayout: GPUBindGroupLayout;
	private dirLightShadowBindGroupEntries: GPUBindGroupEntry[];
	private dirLightShadowBindGroup: GPUBindGroup;

	public setDiffuseIBLTexture(texture: GPUTexture) {
		this.dirLightShadowBindGroupEntries[3].resource = texture.createView({
			dimension: "cube",
		});
	}

	public setSpecularIBLTexture(texture: GPUTexture) {
		this.dirLightShadowBindGroupEntries[4].resource = texture.createView({
			dimension: "cube",
		});
	}

	public setBDRFLutTexture(texture: GPUTexture) {
		this.dirLightShadowBindGroupEntries[5].resource = texture.createView({
			dimension: "2d",
		});
	}

	constructor(
		gbufferCommonBindGroupLayout: GPUBindGroupLayout,
		protected gbufferCommonBindGroup: GPUBindGroup,
		shadowCascadesBuffer: GPUBuffer,
		shadowDepthTextureView: GPUTextureView,
	) {
		super(gbufferCommonBindGroupLayout);

		this.dirLightShadowBindGroupEntries = [
			{
				binding: 0,
				resource: {
					buffer: shadowCascadesBuffer,
				},
			},
			{
				binding: 1,
				resource: SamplerController.createSampler({
					addressModeU: "clamp-to-edge",
					addressModeV: "clamp-to-edge",
					minFilter: "nearest",
					magFilter: "nearest",
				}),
			},
			{
				binding: 2,
				resource: shadowDepthTextureView,
			},
			{
				binding: 3,
				resource: TextureLoader.dummyCubeTexture.createView({
					dimension: "cube",
				}),
			},
			{
				binding: 4,
				resource: TextureLoader.dummyCubeTexture.createView({
					dimension: "cube",
				}),
			},
			{
				binding: 5,
				resource: TextureLoader.dummyTexture.createView({}),
			},
			{
				binding: 6,
				resource: SamplerController.createSampler({
					minFilter: "linear",
					magFilter: "linear",
					mipmapFilter: "linear",
				}),
			},
		];
		const dirLightShadowBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {
					type: "read-only-storage",
				},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {
					type: "filtering",
				},
			},
			{
				binding: 2,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: "depth",
					viewDimension: "2d-array",
				},
			},
			{
				binding: 3,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					viewDimension: "cube",
				},
			},
			{
				binding: 4,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					viewDimension: "cube",
				},
			},
			{
				binding: 5,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					viewDimension: "2d",
				},
			},
			{
				binding: 6,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {
					type: "filtering",
				},
			},
		];
		this.dirLightShadowBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Direcional Light Shadow Bind Group Layout",
			entries: dirLightShadowBindGroupLayoutEntries,
		});

		const dirLightRenderPSOLayout = Renderer.device.createPipelineLayout({
			label: "Dir Light PSO Layout",
			bindGroupLayouts: [
				this.gbufferCommonBindGroupLayout,
				this.dirLightShadowBindGroupLayout,
			],
		});

		const renderPSODescriptor: GPURenderPipelineDescriptor = {
			label: "Directional Light Render PSO",
			layout: dirLightRenderPSOLayout,
			vertex: {
				module: PipelineStates.createShaderModule(
					FullscreenTriangleShader,
					"Fullscreen Vertex Shader Module",
				),
				entryPoint: FullscreenTriangleShaderEntryFn,
			},
			fragment: {
				module: PipelineStates.createShaderModule(
					GetGBufferIntegrateShader(
						LightType.Directional,
						DirectionalShadowPass.TEXTURE_SIZE,
						0,
					),
					"Directional Light Pass Shader Module",
				),
				entryPoint: GBufferIntegrateShaderEntryFn,
				targets: DirectionalLightPass.RENDER_TARGETS,
			},
			depthStencil: {
				format: Renderer.depthStencilFormat,
				depthWriteEnabled: false,
			},
		};
		this.renderPSO = PipelineStates.createRenderPipeline(renderPSODescriptor);
	}

	public override render(renderPassEncoder: GPURenderPassEncoder) {
		this.dirLightShadowBindGroup = Renderer.device.createBindGroup({
			layout: this.dirLightShadowBindGroupLayout,
			entries: this.dirLightShadowBindGroupEntries,
		});
		renderPassEncoder.setPipeline(this.renderPSO);
		renderPassEncoder.setBindGroup(0, this.gbufferCommonBindGroup);
		renderPassEncoder.setBindGroup(1, this.dirLightShadowBindGroup);
		renderPassEncoder.draw(3);
	}
}
