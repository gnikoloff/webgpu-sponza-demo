import Camera from "../../renderer/camera/Camera";
import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import Renderer from "../Renderer";
import {
	GBUFFER_FRAGMENT_SHADER_ENTRY_NAME,
	GBUFFER_FRAGMENT_SHADER_SRC,
	GBUFFER_VERTEX_SHADER_ENTRY_NAME,
	GBUFFER_VERTEX_SHADER_SRC,
} from "../shaders/GBufferShader";

export default class GBufferIntegratePass extends RenderPass {
	public outTexture: GPUTexture;
	public outTextureView: GPUTextureView;

	private renderPSO: GPURenderPipeline;
	private gbufferTexturesBindGroup: GPUBindGroup;

	// private normalReflectanceTextureView: GPUTextureView;
	// private colorTextureView: GPUTextureView;

	constructor(
		normalReflectanceTextureView: GPUTextureView,
		colorTextureView: GPUTextureView,
	) {
		super();

		// this.normalReflectanceTextureView = normalReflectanceTextureView;
		// this.colorTextureView = colorTextureView;

		const vertexShaderModule = PipelineStates.createShaderModule(
			GBUFFER_VERTEX_SHADER_SRC,
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

		const gbufferTexturesBindGroupLayout =
			Renderer.device.createBindGroupLayout({
				label: "GBuffer Textures Bind Group",
				entries: gbufferTexturesBindGroupLayoutEntries,
			});
		const gbufferTexturesBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: normalReflectanceTextureView,
			},
			{
				binding: 1,
				resource: colorTextureView,
			},
		];

		// const gbufferTexturesBindGroupLayout = Renderer.device.createBindGroupLayout({
		// 	label: "Camera GPUBindGroupLayout",
		// 	entries: bindGroupLayoutEntries,
		// });

		const renderPSODescriptor: GPURenderPipelineDescriptor = {
			layout: Renderer.device.createPipelineLayout({
				bindGroupLayouts: [gbufferTexturesBindGroupLayout],
			}),
			vertex: {
				module: vertexShaderModule,
				entryPoint: GBUFFER_VERTEX_SHADER_ENTRY_NAME,
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

		this.gbufferTexturesBindGroup = Renderer.device.createBindGroup({
			layout: gbufferTexturesBindGroupLayout,
			entries: gbufferTexturesBindGroupEntries,
		});
	}

	public override resize(width: number, height: number): void {
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
		renderPassEncoder.draw(6);

		renderPassEncoder.end();
	}
}
