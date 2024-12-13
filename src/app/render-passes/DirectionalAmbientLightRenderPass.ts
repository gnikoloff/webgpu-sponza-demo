import PipelineStates from "../../renderer/core/PipelineStates";
import RenderingContext from "../../renderer/core/RenderingContext";
import Scene from "../../renderer/scene/Scene";
import FullScreenVertexShaderUtils, {
	FullScreenVertexShaderEntryFn,
} from "../../renderer/shader/FullScreenVertexShaderUtils";
import SamplerController from "../../renderer/texture/SamplerController";
import TextureLoader from "../../renderer/texture/TextureLoader";
import { RenderPassType } from "../../renderer/types";
import LightRenderPass from "./LightRenderPass";
import GetGBufferIntegrateShader, {
	GBufferIntegrateShaderEntryFn,
} from "../shaders/GBufferIntegrateShader";

export default class DirectionalAmbientLightRenderPass extends LightRenderPass {
	private outTexture: GPUTexture;
	private outTextureView: GPUTextureView;

	private renderPSO: GPURenderPipeline;
	private dirLightShadowBindGroupLayout: GPUBindGroupLayout;

	private shadowSampler: GPUSampler;
	private envSampler: GPUSampler;

	private dirLightShadowBindGroup: GPUBindGroup;
	private dirLightShadowBindGroupEntries: GPUBindGroupEntry[] = [];

	public setDiffuseIBLTexture(texture: GPUTexture): this {
		this.dirLightShadowBindGroupEntries[3].resource = texture.createView({
			dimension: "cube",
		});
		this.recreateDirLightShadowBindGroup();
		return this;
	}

	public setSpecularIBLTexture(texture: GPUTexture): this {
		this.dirLightShadowBindGroupEntries[4].resource = texture.createView({
			dimension: "cube",
		});
		this.recreateDirLightShadowBindGroup();
		return this;
	}

	public setBDRFLutTexture(texture: GPUTexture): this {
		this.dirLightShadowBindGroupEntries[5].resource = texture.createView({
			dimension: "2d",
		});
		this.recreateDirLightShadowBindGroup();
		return this;
	}

	constructor(protected shadowCascadesBuffer: GPUBuffer) {
		super(RenderPassType.DirectionalAmbientLighting);

		this.shadowSampler = SamplerController.createSampler({
			addressModeU: "clamp-to-edge",
			addressModeV: "clamp-to-edge",
			minFilter: "nearest",
			magFilter: "nearest",
		});
		this.envSampler = SamplerController.createSampler({
			minFilter: "linear",
			magFilter: "linear",
			mipmapFilter: "linear",
		});

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
		this.dirLightShadowBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "Direcional Light Shadow Bind Group Layout",
				entries: dirLightShadowBindGroupLayoutEntries,
			});

		const dirLightRenderPSOLayout =
			RenderingContext.device.createPipelineLayout({
				label: "Dir Light PSO Layout",
				bindGroupLayouts: [
					this.gbufferCommonBindGroupLayout,
					this.dirLightShadowBindGroupLayout,
				],
			});

		this.dirLightShadowBindGroupEntries = [
			{
				binding: 0,
				resource: {
					buffer: this.shadowCascadesBuffer,
				},
			},
			{
				binding: 1,
				resource: this.shadowSampler,
			},
			{
				binding: 2,
				resource: TextureLoader.dummyCubeTexture.createView({
					dimension: "cube",
				}),
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
				resource: this.envSampler,
			},
		];

		const renderPSODescriptor: GPURenderPipelineDescriptor = {
			label: "Directional Light Render PSO",
			layout: dirLightRenderPSOLayout,
			vertex: {
				module: PipelineStates.createShaderModule(
					FullScreenVertexShaderUtils,
					"Fullscreen Vertex Shader Module",
				),
				entryPoint: FullScreenVertexShaderEntryFn,
			},
			fragment: {
				module: PipelineStates.createShaderModule(
					GetGBufferIntegrateShader(RenderPassType.DirectionalAmbientLighting),
					"Directional Light Pass Shader Module",
				),
				entryPoint: GBufferIntegrateShaderEntryFn,
				targets: DirectionalAmbientLightRenderPass.RENDER_TARGETS,
			},
			depthStencil: {
				format: RenderingContext.depthStencilFormat,
				depthWriteEnabled: false,
			},
		};
		this.renderPSO = PipelineStates.createRenderPipeline(renderPSODescriptor);
	}

	public override onResize(width: number, height: number): void {
		super.onResize(width, height);
		if (this.outTexture) {
			this.outTexture.destroy();
		}
		this.outTexture = RenderingContext.device.createTexture({
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
		if (this.renderPassDescriptor) {
			return this.renderPassDescriptor;
		}
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.outTextureView,
				loadOp: "clear",
				clearValue: [0, 0, 0, 1],
				storeOp: "store",
			},
		];
		this.renderPassDescriptor =
			this.augmentRenderPassDescriptorWithTimestampQuery({
				label: "Directional + Ambient Render Pass",
				colorAttachments: renderPassColorAttachments,
				depthStencilAttachment: {
					depthReadOnly: true,
					stencilReadOnly: false,
					view: this.inputTextureViews[3],
					// depthLoadOp: "load",
					// depthStoreOp: "store",
					stencilLoadOp: "load",
					stencilStoreOp: "store",
				},
			});
		return this.renderPassDescriptor;
	}

	private recreateDirLightShadowBindGroup() {
		this.dirLightShadowBindGroup = RenderingContext.device.createBindGroup({
			label:
				"Directional Ambient LightingSystem G-Buffer Directional Shadow Input Bind Group",
			layout: this.dirLightShadowBindGroupLayout,
			entries: this.dirLightShadowBindGroupEntries,
		});
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		if (!this.inputTextureViews.length) {
			this.inputTextureViews.push(inputs[0].createView());
			this.inputTextureViews.push(inputs[1].createView());
			this.inputTextureViews.push(
				inputs[2].createView({
					aspect: "depth-only",
				}),
			);
			this.inputTextureViews.push(
				inputs[2].createView({
					aspect: "all",
				}),
			);
			this.inputTextureViews.push(inputs[3].createView());
			this.inputTextureViews.push(
				inputs[4].createView({
					dimension: "2d-array",
				}),
			);
			this.updateGbufferBindGroupEntryAt(0, this.inputTextureViews[0])
				.updateGbufferBindGroupEntryAt(1, this.inputTextureViews[1])
				.updateGbufferBindGroupEntryAt(2, this.inputTextureViews[2])
				.updateGbufferBindGroupEntryAt(3, this.inputTextureViews[4])
				.updateGbufferBindGroupEntryAt(4, {
					buffer: this.camera.gpuBuffer,
				})
				.updateGbufferBindGroupEntryAt(5, {
					buffer: scene.lightingManager.gpuBuffer,
				})
				.recreateGBufferTexturesBindGroup();

			this.dirLightShadowBindGroupEntries[2].resource =
				this.inputTextureViews[5];
			this.recreateDirLightShadowBindGroup();
		}

		const renderPass = commandEncoder.beginRenderPass(
			this.createRenderPassDescriptor(),
		);

		RenderingContext.setActiveRenderPass(this.type, renderPass);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPass.pushDebugGroup("Begin Directional + Ambient LightingSystem");
		}
		RenderingContext.bindRenderPSO(this.renderPSO);
		renderPass.setBindGroup(0, this.gbufferTexturesBindGroup);
		renderPass.setBindGroup(1, this.dirLightShadowBindGroup);
		renderPass.draw(3);
		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPass.popDebugGroup();
		}
		renderPass.end();

		this.resolveTiming(commandEncoder);

		return [this.outTexture];
	}
}
