import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import Scene from "../../renderer/scene/Scene";
import FullScreenVertexShaderUtils, {
	FullScreenVertexShaderEntryFn,
} from "../../renderer/shader/FullScreenVertexShaderUtils";
import SSAOShaderSrc, { SSAOShaderName } from "../shaders/SSAOShader";
import { vec4 } from "wgpu-matrix";
import { lerp } from "../../renderer/math/math";
import { RenderPassType } from "../../renderer/types";
import RenderingContext from "../../renderer/core/RenderingContext";
import TextureLoader from "../../renderer/texture/TextureLoader";

export default class SSAORenderPass extends RenderPass {
	private outTexture: GPUTexture;
	private outTextureView: GPUTextureView;

	private gbufferCommonBindGroupLayout: GPUBindGroupLayout;
	private gbufferTexturesBindGroupEntries: GPUBindGroupEntry[] = [];
	private gbufferTexturesBindGroup: GPUBindGroup;

	private renderPSO: GPURenderPipeline;

	private noiseTexture: GPUTexture;

	private kernelBuffer: GPUBuffer;

	constructor() {
		super(RenderPassType.SSAO);
		const kernel = new Float32Array(16 * 4);

		for (let i = 0; i < 16; i++) {
			const sample = vec4.create(
				Math.random() * 2 - 1,
				Math.random() * 2 - 1,
				Math.random(),
				0,
			);

			// bias sampler closer to the origin
			const scale = i / 16;

			vec4.scale(sample, lerp(0.1, 1, scale * scale), sample);

			// vec4.normalize(sample, sample);
			kernel.set(sample, i * 4);
		}

		this.kernelBuffer = RenderingContext.device.createBuffer({
			label: "SSAO Kernel Buffer",
			mappedAtCreation: true,
			size: 16 * 4 * Float32Array.BYTES_PER_ELEMENT,
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

		this.gbufferCommonBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "SSAO Input Bind Group",
				entries: gbufferCommonBindGroupLayoutEntries,
			});

		const renderTargets: GPUColorTargetState[] = [
			{
				format: "r16float",
			},
		];

		this.renderPSO = PipelineStates.createRenderPipeline({
			label: `SSAO RenderPSO`,
			layout: RenderingContext.device.createPipelineLayout({
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
	}

	private async loadBlueNoiseTexture() {
		const url = "/blueNoise.png";
		const response = await fetch(url);
		const blob = await response.blob();
		const imageBitmap = await createImageBitmap(blob);
		this.noiseTexture = RenderingContext.device.createTexture({
			label: "Blue Noise Texture",
			format: "rgba32float",
			size: { width: imageBitmap.width, height: imageBitmap.height },
			usage: GPUTextureUsage.TEXTURE_BINDING,
		});
		RenderingContext.device.queue.copyExternalImageToTexture(
			{
				source: imageBitmap,
			},
			{
				texture: this.noiseTexture,
			},
			{
				width: imageBitmap.width,
				height: imageBitmap.height,
			},
		);
		imageBitmap.close();
	}

	public override onResize(width: number, height: number): void {
		super.onResize(width, height);
		if (this.outTexture) {
			this.outTexture.destroy();
		}
		this.outTexture = RenderingContext.device.createTexture({
			dimension: "2d",
			format: "r16float",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
			label: "SSAO Texture",
		});
		this.outTextureView = this.outTexture.createView();
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		if (this.renderPassDescriptor) {
			return this.renderPassDescriptor;
		}
		const colorAttachments: GPURenderPassColorAttachment[] = [
			{
				loadOp: "load",
				storeOp: "store",
				view: this.outTextureView,
			},
		];
		this.renderPassDescriptor =
			this.augmentRenderPassDescriptorWithTimestampQuery({
				label: "SSAO Render Pass Descriptor",
				colorAttachments,
			});
		return this.renderPassDescriptor;
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		if (this.hasResized) {
			this.hasResized = false;
			return [];
		}
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
					resource:
						this.noiseTexture?.createView() ||
						TextureLoader.dummyTexture.createView(),
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

			this.gbufferTexturesBindGroup = RenderingContext.device.createBindGroup({
				layout: this.gbufferCommonBindGroupLayout,
				entries: this.gbufferTexturesBindGroupEntries,
			});
		}

		const renderPassDesc = this.createRenderPassDescriptor();
		const renderPass = commandEncoder.beginRenderPass(renderPassDesc);

		RenderingContext.setActiveRenderPass(this.type, renderPass);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPass.pushDebugGroup("Begin SSAO");
		}

		renderPass.setBindGroup(0, this.gbufferTexturesBindGroup);
		RenderingContext.bindRenderPSO(this.renderPSO);
		renderPass.draw(3);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPass.popDebugGroup();
		}
		renderPass.end();

		this.postRender(commandEncoder);

		return [this.outTexture];
	}
}
