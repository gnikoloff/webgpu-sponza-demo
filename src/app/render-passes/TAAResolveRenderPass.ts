import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import RenderingContext from "../../renderer/core/RenderingContext";
import VRAMUsageTracker from "../../renderer/misc/VRAMUsageTracker";
import Scene from "../../renderer/scene/Scene";
import FullScreenVertexShaderUtils, {
	FullScreenVertexShaderEntryFn,
} from "../../renderer/shader/FullScreenVertexShaderUtils";
import { RenderPassType } from "../../renderer/types";

import {
	TAA_RESOLVE_FRAGMENT_SHADER_ENTRY_NAME,
	TAA_RESOLVE_FRAGMENT_SHADER_SRC,
} from "../shaders/TAAResolveShader";

export default class TAAResolveRenderPass extends RenderPass {
	private static readonly HISTORY_MIX_FACTOR = 0.9;

	private outTextureView: GPUTextureView;
	private historyTextureView: GPUTextureView;
	private sourceCopyTextureInfo: GPUTexelCopyTextureInfo;
	private destCopyTextureInfo: GPUTexelCopyTextureInfo;
	private copyTextureExtend: GPUExtent3DStrict;
	private renderPSO: GPURenderPipeline;
	private texturesBindGroupLayout: GPUBindGroupLayout;
	private textureBindGroup: GPUBindGroup;
	private historyMixFactorBuffer: GPUBuffer;
	private historyReset = false;

	public override destroy(): void {
		VRAMUsageTracker.removeBufferBytes(this.historyMixFactorBuffer);
		this.historyMixFactorBuffer.destroy();
	}

	public resetHistory() {
		this.historyReset = true;
		RenderingContext.device.queue.writeBuffer(
			this.historyMixFactorBuffer,
			0,
			new Float32Array([0]),
		);
	}

	constructor(width: number, height: number) {
		super(RenderPassType.TAAResolve, width, height);

		const vertexShaderModule = PipelineStates.createShaderModule(
			FullScreenVertexShaderUtils,
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
			{
				binding: 3,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {},
			},
		];

		this.texturesBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "TAA Resolve Input Textures Bind Group",
				entries: texturesBindGroupLayoutEntries,
			});

		const renderPSODescriptor: GPURenderPipelineDescriptor = {
			layout: RenderingContext.device.createPipelineLayout({
				bindGroupLayouts: [this.texturesBindGroupLayout],
			}),
			vertex: {
				module: vertexShaderModule,
				entryPoint: FullScreenVertexShaderEntryFn,
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

		this.outTextures.push(
			RenderingContext.device.createTexture({
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
			}),
		);
		this.outTextureView = this.outTextures[0].createView();

		VRAMUsageTracker.addTextureBytes(this.outTextures[0]);

		this.sourceCopyTextureInfo = {
			texture: this.outTextures[0],
			mipLevel: 0,
			origin: { x: 0, y: 0, z: 0 },
		};

		this.outTextures.push(
			RenderingContext.device.createTexture({
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
			}),
		);
		this.historyTextureView = this.outTextures[1].createView();

		VRAMUsageTracker.addTextureBytes(this.outTextures[1]);

		this.destCopyTextureInfo = {
			texture: this.outTextures[1],
			mipLevel: 0,
			origin: { x: 0, y: 0, z: 0 },
		};

		this.copyTextureExtend = {
			width,
			height,
			depthOrArrayLayers: 1,
		};

		this.historyMixFactorBuffer = RenderingContext.device.createBuffer({
			label: "TAA History Mix Factor Buffer",
			size: 1 * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		});

		new Float32Array(this.historyMixFactorBuffer.getMappedRange()).set([
			TAAResolveRenderPass.HISTORY_MIX_FACTOR,
		]);

		VRAMUsageTracker.addBufferBytes(this.historyMixFactorBuffer);

		this.historyMixFactorBuffer.unmap();
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		if (this.renderPassDescriptor) {
			return this.renderPassDescriptor;
		}
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.outTextureView,
				loadOp: "load",
				storeOp: "store",
			},
		];
		this.renderPassDescriptor =
			this.augmentRenderPassDescriptorWithTimestampQuery({
				label: "TAA Resolve Pass",
				colorAttachments: renderPassColorAttachments,
			});
		return this.renderPassDescriptor;
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		_scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		if (!this.inputTextureViews.length) {
			this.inputTextureViews.push(inputs[0].createView());
			this.inputTextureViews.push(inputs[1].createView());

			const texturesBindGroupEntries: GPUBindGroupEntry[] = [
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
					resource: this.historyTextureView,
				},
				{
					binding: 3,
					resource: {
						buffer: this.historyMixFactorBuffer,
					},
				},
			];

			this.textureBindGroup = RenderingContext.device.createBindGroup({
				layout: this.texturesBindGroupLayout,
				entries: texturesBindGroupEntries,
			});
		}
		const renderPassdescriptor = this.createRenderPassDescriptor();
		const renderPassEncoder =
			commandEncoder.beginRenderPass(renderPassdescriptor);

		RenderingContext.setActiveRenderPass(this.type, renderPassEncoder);

		RenderingContext.bindRenderPSO(this.renderPSO);
		renderPassEncoder.setBindGroup(0, this.textureBindGroup);
		renderPassEncoder.draw(3);
		renderPassEncoder.end();

		commandEncoder.copyTextureToTexture(
			this.sourceCopyTextureInfo,
			this.destCopyTextureInfo,
			this.copyTextureExtend,
		);

		this.postRender(commandEncoder);

		if (this.historyReset) {
			RenderingContext.device.queue.onSubmittedWorkDone().then(() => {
				RenderingContext.device.queue.writeBuffer(
					this.historyMixFactorBuffer,
					0,
					new Float32Array([TAAResolveRenderPass.HISTORY_MIX_FACTOR]),
				);
			});

			this.historyReset = false;
		}

		return this.outTextures;
	}
}
