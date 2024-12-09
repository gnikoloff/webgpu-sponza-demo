import RenderPass from "../../renderer/core/RenderPass";
import RenderingContext from "../../renderer/core/RenderingContext";
import SamplerController from "../../renderer/texture/SamplerController";
import TextureLoader from "../../renderer/texture/TextureLoader";
import { RenderPassType } from "../../renderer/types";

export default class LightRenderPass extends RenderPass {
	protected static readonly RENDER_TARGETS: GPUColorTargetState[] = [
		{
			format: "rgba16float",
			blend: {
				color: {
					srcFactor: "one",
					dstFactor: "one",
					operation: "add",
				},
				alpha: {
					srcFactor: "one",
					dstFactor: "one",
					operation: "add",
				},
			},
		},
	];

	protected static readonly gbufferCommonBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] =
		[
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {},
			},
			{
				binding: 2,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: "depth",
				},
			},
			{
				binding: 3,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {},
			},
			{
				binding: 4,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {},
			},
			{
				binding: 5,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {},
			},
			{
				binding: 6,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform",
				},
			},
			{
				binding: 7,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "read-only-storage",
				},
			},
			{
				binding: 8,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform",
				},
			},
		];

	protected gbufferCommonBindGroupLayout: GPUBindGroupLayout;
	protected gbufferTexturesBindGroupEntries: GPUBindGroupEntry[] = [];
	protected gbufferTexturesBindGroup: GPUBindGroup;
	protected bayerDitherSampler: GPUSampler;
	protected debugLightsBuffer: GPUBuffer;

	protected updateGbufferBindGroupEntryAt(
		idx: number,
		val: GPUBindingResource,
	): this {
		this.gbufferTexturesBindGroupEntries[idx].resource = val;
		return this;
	}

	protected recreateGBufferTexturesBindGroup() {
		this.gbufferTexturesBindGroup = RenderingContext.device.createBindGroup({
			label: "G-Buffer Textures Input Bind Group",
			layout: this.gbufferCommonBindGroupLayout,
			entries: this.gbufferTexturesBindGroupEntries,
		});
	}

	constructor(type: RenderPassType) {
		super(type);

		this.gbufferCommonBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "GBuffer Textures Bind Group",
				entries: LightRenderPass.gbufferCommonBindGroupLayoutEntries,
			});

		this.bayerDitherSampler = SamplerController.createSampler({
			addressModeU: "repeat",
			addressModeV: "repeat",
			minFilter: "nearest",
			magFilter: "nearest",
		});

		this.debugLightsBuffer = RenderingContext.device.createBuffer({
			label: "Debug Lights GPUBuffer",
			size: 4 * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		});
		new Float32Array(this.debugLightsBuffer.getMappedRange()).set(
			new Float32Array([0, 0]),
		);
		this.debugLightsBuffer.unmap();

		this.gbufferTexturesBindGroupEntries = [
			{
				binding: 0,
				resource: null,
			},
			{
				binding: 1,
				resource: null,
			},
			{
				binding: 2,
				resource: null,
			},
			{
				binding: 3,
				resource: null,
			},
			{
				binding: 4,
				resource: TextureLoader.bayerDitherPatternTexture.createView(),
			},
			{
				binding: 5,
				resource: this.bayerDitherSampler,
			},
			{
				binding: 6,
				resource: {
					buffer: null,
				},
			},
			{
				binding: 7,
				resource: {
					buffer: null,
				},
			},
			{
				binding: 8,
				resource: {
					buffer: this.debugLightsBuffer,
				},
			},
		];
	}
}
