import Camera from "../../renderer/camera/Camera";
import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import Renderer from "../Renderer";
import {
	GBUFFER_FRAGMENT_SHADER_ENTRY_NAME,
	GBUFFER_FRAGMENT_SHADER_SRC,
	FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME,
	FULLSCREEN_TRIANGLE_VERTEX_SHADER_SRC,
} from "../shaders/GBufferShader";

export default class GBufferIntegratePass extends RenderPass {
	public outTexture: GPUTexture;
	public outTextureView: GPUTextureView;

	private renderPSO: GPURenderPipeline;
	private gbufferTexturesBindGroup: GPUBindGroup;

	private gbufferTexturesBindGroupLayout: GPUBindGroupLayout;

	// private normalReflectanceTextureView: GPUTextureView;
	// private colorTextureView: GPUTextureView;

	constructor(
		private normalReflectanceTextureView: GPUTextureView,
		private colorTextureView: GPUTextureView,
		private velocityTextureView: GPUTextureView,
	) {
		super();

		// this.normalReflectanceTextureView = normalReflectanceTextureView;
		// this.colorTextureView = colorTextureView;

		const vertexShaderModule = PipelineStates.createShaderModule(
			FULLSCREEN_TRIANGLE_VERTEX_SHADER_SRC,
		);
		const fragmentShaderModule = PipelineStates.createShaderModule(
			GBUFFER_FRAGMENT_SHADER_SRC,
		);

		const targets: GPUColorTargetState[] = [
			{
				format: "rgba16float",
			},
		];

		const gbufferTexturesBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
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
		];

		this.gbufferTexturesBindGroupLayout = Renderer.device.createBindGroupLayout(
			{
				label: "GBuffer Textures Bind Group",
				entries: gbufferTexturesBindGroupLayoutEntries,
			},
		);

		// const gbufferTexturesBindGroupLayout = Renderer.device.createBindGroupLayout({
		// 	label: "Camera GPUBindGroupLayout",
		// 	entries: bindGroupLayoutEntries,
		// });

		const renderPSODescriptor: GPURenderPipelineDescriptor = {
			layout: Renderer.device.createPipelineLayout({
				bindGroupLayouts: [this.gbufferTexturesBindGroupLayout],
			}),
			vertex: {
				module: vertexShaderModule,
				entryPoint: FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME,
			},
			fragment: {
				module: fragmentShaderModule,
				entryPoint: GBUFFER_FRAGMENT_SHADER_ENTRY_NAME,
				targets,
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "back",
			},
		};

		this.renderPSO = PipelineStates.createRenderPipeline(renderPSODescriptor);
	}

	public override onResize(width: number, height: number): void {
		if (this.outTexture) {
			this.outTexture.destroy();
		}
		this.outTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: "rgba16float",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.STORAGE_BINDING |
				GPUTextureUsage.RENDER_ATTACHMENT |
				GPUTextureUsage.TEXTURE_BINDING,
			label: "GBuffer Result Texture",
		});
		this.outTextureView = this.outTexture.createView();

		const gbufferTexturesBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: this.normalReflectanceTextureView,
			},
			{
				binding: 1,
				resource: this.colorTextureView,
			},
			// {
			// 	binding: 2,
			// 	resource: this.velocityTextureView,
			// },
			// {
			// 	binding: 3,
			// 	resource: this.historyTextureView,
			// },
		];

		this.gbufferTexturesBindGroup = Renderer.device.createBindGroup({
			layout: this.gbufferTexturesBindGroupLayout,
			entries: gbufferTexturesBindGroupEntries,
		});
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.outTextureView,
				loadOp: "load",
				clearValue: [0.1, 0.1, 0.1, 1],
				storeOp: "store",
			},
		];
		return {
			colorAttachments: renderPassColorAttachments,
			label: "GBuffer Integrate Pass",
		};
	}

	public render(commandEncoder: GPUCommandEncoder): void {
		const renderPassDescriptor = this.createRenderPassDescriptor();
		const renderPassEncoder =
			commandEncoder.beginRenderPass(renderPassDescriptor);

		renderPassEncoder.setPipeline(this.renderPSO);
		renderPassEncoder.setBindGroup(0, this.gbufferTexturesBindGroup);
		renderPassEncoder.draw(3);
		renderPassEncoder.end();
	}
}
