import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import Scene from "../../renderer/scene/Scene";
import { RenderPassType } from "../../renderer/types";
import Renderer from "../Renderer";

import {
	TAA_RESOLVE_FRAGMENT_SHADER_ENTRY_NAME,
	TAA_RESOLVE_FRAGMENT_SHADER_SRC,
} from "../shaders/TAAResolveShader";
import {
	FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME,
	FULLSCREEN_TRIANGLE_VERTEX_SHADER_SRC,
} from "../shaders/VertexShader";

export default class TAAResolvePass extends RenderPass {
	public outTexture: GPUTexture;
	public outTextureView: GPUTextureView;

	private historyTexture: GPUTexture;
	private historyTextureView: GPUTextureView;

	private sourceCopyTextureInfo: GPUTexelCopyTextureInfo;
	private destCopyTextureInfo: GPUTexelCopyTextureInfo;
	private copyTextureExtend: GPUExtent3DStrict;

	private renderPSO: GPURenderPipeline;
	private texturesBindGroupLayout: GPUBindGroupLayout;
	private textureBindGroup: GPUBindGroup;

	constructor(
		scene: Scene,
		private colorTextureView: GPUTextureView,
		private velocityTextureView: GPUTextureView,
	) {
		super(RenderPassType.TAAResolve, scene);

		const vertexShaderModule = PipelineStates.createShaderModule(
			FULLSCREEN_TRIANGLE_VERTEX_SHADER_SRC,
		);
		const fragmentShaderModule = PipelineStates.createShaderModule(
			TAA_RESOLVE_FRAGMENT_SHADER_SRC,
		);

		const targets: GPUColorTargetState[] = [
			{
				format: "rgba16float",
			},
		];

		const texturesBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
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
				texture: {},
			},
		];

		this.texturesBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "GBuffer Textures Bind Group",
			entries: texturesBindGroupLayoutEntries,
		});

		const renderPSODescriptor: GPURenderPipelineDescriptor = {
			layout: Renderer.device.createPipelineLayout({
				bindGroupLayouts: [this.texturesBindGroupLayout],
			}),
			vertex: {
				module: vertexShaderModule,
				entryPoint: FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME,
			},
			fragment: {
				module: fragmentShaderModule,
				entryPoint: TAA_RESOLVE_FRAGMENT_SHADER_ENTRY_NAME,
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
				GPUTextureUsage.RENDER_ATTACHMENT |
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.STORAGE_BINDING |
				GPUTextureUsage.COPY_SRC,
			label: "TAA Resolve Texture",
		});
		this.outTextureView = this.outTexture.createView();

		this.sourceCopyTextureInfo = {
			texture: this.outTexture,
			mipLevel: 0,
			origin: { x: 0, y: 0, z: 0 },
		};

		if (this.historyTexture) {
			this.historyTexture.destroy();
		}

		this.historyTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: "rgba16float",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT |
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST,
			label: "TAA Resolve Texture",
		});
		this.historyTextureView = this.historyTexture.createView();

		this.destCopyTextureInfo = {
			texture: this.historyTexture,
			mipLevel: 0,
			origin: { x: 0, y: 0, z: 0 },
		};

		this.copyTextureExtend = {
			width,
			height,
			depthOrArrayLayers: 1,
		};

		const texturesBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: this.colorTextureView,
			},
			{
				binding: 1,
				resource: this.velocityTextureView,
			},
			{
				binding: 2,
				resource: this.historyTextureView,
			},
		];

		this.textureBindGroup = Renderer.device.createBindGroup({
			layout: this.texturesBindGroupLayout,
			entries: texturesBindGroupEntries,
		});
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.outTextureView,
				loadOp: "load",
				storeOp: "store",
			},
		];
		return {
			colorAttachments: renderPassColorAttachments,
			label: "TAA Resolve Pass",
		};
	}

	public render(commandEncoder: GPUCommandEncoder): void {
		const renderPassdescriptor = this.createRenderPassDescriptor();
		const renderPassEncoder =
			commandEncoder.beginRenderPass(renderPassdescriptor);

		renderPassEncoder.setPipeline(this.renderPSO);
		renderPassEncoder.setBindGroup(0, this.textureBindGroup);
		renderPassEncoder.draw(3);
		renderPassEncoder.end();

		commandEncoder.copyTextureToTexture(
			this.sourceCopyTextureInfo,
			this.destCopyTextureInfo,
			this.copyTextureExtend,
		);
	}
}
