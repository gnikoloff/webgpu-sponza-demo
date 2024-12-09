import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import Scene from "../../renderer/scene/Scene";
import Renderer from "../Renderer";
import FullScreenVertexShaderUtils, {
	FullScreenVertexShaderEntryFn,
} from "../../renderer/shader/FullScreenVertexShaderUtils";
import SSAOShaderSrc, {
	SSAOShaderName,
	SSSAOBlurShaderName,
} from "../shaders/SSAOShader";
import { vec4 } from "wgpu-matrix";
import { lerp } from "../../renderer/math/math";
import { RenderPassType } from "../../renderer/types";
import TextureLoader from "../../renderer/texture/TextureLoader";

export default class SSAORenderPass extends RenderPass {
	private outTexture: GPUTexture;
	private outTextureView: GPUTextureView;

	private ssaoTexture: GPUTexture;
	private ssaoTextureView: GPUTextureView;

	private blueNoiseTexture: GPUTexture;

	private gbufferCommonBindGroupLayout: GPUBindGroupLayout;
	private gbufferTexturesBindGroupEntries: GPUBindGroupEntry[] = [];
	private gbufferTexturesBindGroup: GPUBindGroup;
	private blurBindGroupLayout: GPUBindGroupLayout;
	private blurBindGroup: GPUBindGroup;

	private renderPSO: GPURenderPipeline;
	private blurPSO: GPURenderPipeline;

	private kernelBuffer: GPUBuffer;

	constructor() {
		super(RenderPassType.SSAO);

		const kernelSize = 64;
		const kernel = new Float32Array(kernelSize * 4);

		for (let i = 0; i < kernelSize; i++) {
			const sample = vec4.create(
				Math.random() * 2 - 1,
				Math.random() * 2 - 1,
				Math.random(),
				0,
			);
			vec4.normalize(sample, sample);

			// bias sampler closer to the origin
			const scale = i / kernelSize;

			vec4.scale(sample, lerp(0.1, 1, scale * scale), sample);

			kernel.set(sample, i * 4);
		}

		this.kernelBuffer = Renderer.device.createBuffer({
			label: "SSAO Kernel Buffer",
			mappedAtCreation: true,
			size: kernelSize * 4 * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.STORAGE,
		});
		new Float32Array(this.kernelBuffer.getMappedRange()).set(kernel);
		this.kernelBuffer.unmap();

		const gbufferCommonBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: "depth",
				},
			},
			{
				binding: 2,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: "unfilterable-float",
				},
			},
			{
				binding: 3,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {
					type: "read-only-storage",
				},
			},
			{
				binding: 4,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform",
				},
			},
		];

		this.gbufferCommonBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "SSAO Input Bind Group",
			entries: gbufferCommonBindGroupLayoutEntries,
		});

		const blurBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {},
			},
		];

		this.blurBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "SSAO Blur Input Bind Group",
			entries: blurBindGroupLayoutEntries,
		});

		const renderTargets: GPUColorTargetState[] = [
			{
				format: "r16float",
			},
		];

		this.renderPSO = PipelineStates.createRenderPipeline({
			label: `SSAO RenderPSO`,
			layout: Renderer.device.createPipelineLayout({
				label: `SSAO RenderPSO Layout`,
				bindGroupLayouts: [this.gbufferCommonBindGroupLayout],
			}),
			vertex: {
				module: PipelineStates.createShaderModule(FullScreenVertexShaderUtils),
				entryPoint: FullScreenVertexShaderEntryFn,
			},
			fragment: {
				module: PipelineStates.createShaderModule(SSAOShaderSrc),
				entryPoint: SSAOShaderName,
				targets: renderTargets,
			},
		});

		this.blurPSO = PipelineStates.createRenderPipeline({
			label: "SSAO Blur RenderPSO",
			layout: Renderer.device.createPipelineLayout({
				label: "SSAO Blur RenderPSO Layout",
				bindGroupLayouts: [
					this.gbufferCommonBindGroupLayout,
					this.blurBindGroupLayout,
				],
			}),
			vertex: {
				module: PipelineStates.createShaderModule(FullScreenVertexShaderUtils),
				entryPoint: FullScreenVertexShaderEntryFn,
			},
			fragment: {
				module: PipelineStates.createShaderModule(SSAOShaderSrc),
				entryPoint: SSSAOBlurShaderName,
				targets: renderTargets,
			},
		});
	}

	public override onResize(width: number, height: number): void {
		if (this.ssaoTexture) {
			this.ssaoTexture.destroy();
		}
		this.ssaoTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: "r16float",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
			label: "SSAO Texture",
		});
		this.ssaoTextureView = this.ssaoTexture.createView();

		if (this.outTexture) {
			this.outTexture.destroy();
		}
		this.outTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: "r16float",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
			label: "SSAO Blurred Texture",
		});
		this.outTextureView = this.outTexture.createView();

		this.loadBlueNoiseTexture();
	}

	private async loadBlueNoiseTexture() {
		const url = "/blueNoise.png";
		const responce = await fetch(url);
		const blob = await responce.blob();
		const imageBitmap = await createImageBitmap(blob);
		this.blueNoiseTexture = Renderer.device.createTexture({
			label: "SSAO Noise Texture",
			format: "rgba32float",
			size: { width: 32, height: 32, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST |
				GPUTextureUsage.RENDER_ATTACHMENT,
		});

		Renderer.device.queue.copyExternalImageToTexture(
			{ source: imageBitmap },
			{ texture: this.blueNoiseTexture },
			{ width: 32, height: 32 },
		);

		imageBitmap.close();

		const blurInputBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: this.ssaoTextureView,
			},
		];
		this.blurBindGroup = Renderer.device.createBindGroup({
			label: "Blur Input Bind Group",
			entries: blurInputBindGroupEntries,
			layout: this.blurBindGroupLayout,
		});
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		const colorAttachments: GPURenderPassColorAttachment[] = [
			{
				loadOp: "load",
				storeOp: "store",
				view: this.ssaoTextureView,
			},
		];
		return this.augmentRenderPassDescriptorWithTimestampQuery({
			label: "SSAO Render Pass Descriptor",
			colorAttachments,
		});
	}

	protected createBlurRenderPassDescriptor(): GPURenderPassDescriptor {
		const colorAttachments: GPURenderPassColorAttachment[] = [
			{
				loadOp: "load",
				storeOp: "store",
				view: this.outTextureView,
			},
		];
		return {
			label: "SSAO Blur Render Pass Descriptor",
			colorAttachments,
		};
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		if (!this.inputTextureViews.length) {
			this.inputTextureViews.push(inputs[0].createView());
			this.inputTextureViews.push(
				inputs[1].createView({ aspect: "depth-only" }),
			);

			this.gbufferTexturesBindGroupEntries = [
				{
					binding: 0,
					resource: this.inputTextureViews[0],
				},
				{
					binding: 1,
					resource: this.inputTextureViews[1],
				},
				{
					binding: 2,
					resource: (
						this.blueNoiseTexture || TextureLoader.dummyTexture
					).createView(),
				},
				{
					binding: 3,
					resource: {
						buffer: this.kernelBuffer,
					},
				},
				{
					binding: 4,
					resource: {
						buffer: this.camera.gpuBuffer,
					},
				},
			];

			this.gbufferTexturesBindGroup = Renderer.device.createBindGroup({
				layout: this.gbufferCommonBindGroupLayout,
				entries: this.gbufferTexturesBindGroupEntries,
			});
		}

		const renderPassDesc = this.createRenderPassDescriptor();
		const renderPass = commandEncoder.beginRenderPass(renderPassDesc);
		renderPass.pushDebugGroup("Begin SSAO");

		renderPass.setBindGroup(0, this.gbufferTexturesBindGroup);
		renderPass.setPipeline(this.renderPSO);
		renderPass.draw(3);

		renderPass.popDebugGroup();
		renderPass.end();

		this.resolveTiming(commandEncoder);

		const blurPassDesc = this.createBlurRenderPassDescriptor();
		const blurPass = commandEncoder.beginRenderPass(blurPassDesc);
		blurPass.pushDebugGroup("Begin SSAO Blur");

		blurPass.setBindGroup(0, this.gbufferTexturesBindGroup);
		blurPass.setBindGroup(1, this.blurBindGroup);
		blurPass.setPipeline(this.blurPSO);
		blurPass.draw(3);

		blurPass.popDebugGroup();
		blurPass.end();

		return [this.ssaoTexture];
	}
}
