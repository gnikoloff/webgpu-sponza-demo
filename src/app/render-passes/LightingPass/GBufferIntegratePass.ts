import RenderPass from "../../../renderer/core/RenderPass";

import PointLight from "../../../renderer/lighting/PointLight";
import TextureLoader from "../../../renderer/texture/TextureLoader";
import Skybox from "../../meshes/Skybox";
import DirectionalLightSubPass from "./DirectionalLightSubPass";
import PointLightsRenderSubPass from "./PointLightsRenderSubPass";
import PointLightsMaskSubPass from "./PointLightsMaskSubPass";
import { RenderPassType } from "../../../renderer/types";
import SamplerController from "../../../renderer/texture/SamplerController";
import Scene from "../../../renderer/scene/Scene";
import RenderingContext from "../../../renderer/core/RenderingContext";

export default class GBufferIntegratePass extends RenderPass {
	public outTexture: GPUTexture;
	public outTextureView: GPUTextureView;

	public skybox?: Skybox;

	private gbufferTexturesBindGroup: GPUBindGroup;
	private gbufferCommonBindGroupLayout: GPUBindGroupLayout;

	private dirLightPass?: DirectionalLightSubPass;
	private pointsLightRenderPass?: PointLightsRenderSubPass;
	private pointsLightMasPass?: PointLightsMaskSubPass;

	private bayerDitherSampler: GPUSampler;

	private pointLights: PointLight[] = [];

	private debugLightsBuffer: GPUBuffer;

	private _debugPointLights = false;
	public get debugPointLights(): boolean {
		return this._debugPointLights;
	}
	public set debugPointLights(v: boolean) {
		if (v !== this._debugPointLights) {
			RenderingContext.device.queue.writeBuffer(
				this.debugLightsBuffer,
				0,
				new Float32Array([v ? 1 : 0]),
			);
		}
		this._debugPointLights = v;
	}

	private _debugShadowCascadeIndex = false;
	public get debugShadowCascadeIndex(): boolean {
		return this._debugShadowCascadeIndex;
	}
	public set debugShadowCascadeIndex(v: boolean) {
		if (v !== this.debugShadowCascadeIndex) {
			RenderingContext.device.queue.writeBuffer(
				this.debugLightsBuffer,
				Float32Array.BYTES_PER_ELEMENT,
				new Float32Array([v ? 1 : 0]),
			);
		}
		this._debugShadowCascadeIndex = v;
	}

	public setDiffuseIBLTexture(texture: GPUTexture): this {
		this.dirLightPass?.setDiffuseIBLTexture(texture);
		return this;
	}

	public setSpecularIBLTexture(texture: GPUTexture): this {
		this.dirLightPass?.setSpecularIBLTexture(texture);
		return this;
	}

	public setBDRFLutTexture(texture: GPUTexture): this {
		this.dirLightPass?.setBDRFLutTexture(texture);
		return this;
	}

	constructor() {
		super(RenderPassType.DeferredLighting);

		// this.pointLights = scene.getPointLights();

		const gbufferCommonBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
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

		this.gbufferCommonBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "GBuffer Textures Bind Group",
				entries: gbufferCommonBindGroupLayoutEntries,
			});

		const lightsMaskBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX,
				buffer: {
					type: "uniform",
				},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX,
				buffer: {
					type: "read-only-storage",
				},
			},
		];

		this.lightsMaskBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "Light Masking Bind Group",
				entries: lightsMaskBindGroupLayoutEntries,
			});

		// const lightMaskStencilState: GPUStencilFaceState = {
		// 	compare: "always",
		// 	depthFailOp: "increment-clamp",
		// 	failOp: "keep",
		// 	passOp: "keep",
		// };

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
	}

	public override onResize(width: number, height: number): void {
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

		this.bayerDitherSampler = SamplerController.createSampler({
			addressModeU: "repeat",
			addressModeV: "repeat",
			minFilter: "nearest",
			magFilter: "nearest",
		});

		this.dirLightPass = new DirectionalLightSubPass(
			this.gbufferCommonBindGroupLayout,
			this.gbufferTexturesBindGroup,
			this.shadowCascadesBuffer,
			this.shadowDepthTextureView,
		);

		// this.pointsLightRenderPass = new PointLightsRenderSubPass(
		// 	this.gbufferCommonBindGroupLayout,
		// 	this.gbufferTexturesBindGroup,
		// );
		// this.pointsLightRenderPass?.setPointLights(this.pointLights);

		// const lightsMaskBindGroupEntries: GPUBindGroupEntry[] = [
		// 	{
		// 		binding: 0,
		// 		resource: {
		// 			buffer: this.camera.gpuBuffer,
		// 		},
		// 	},
		// 	{
		// 		binding: 1,
		// 		resource: {
		// 			buffer: this.scene.lightsBuffer,
		// 		},
		// 	},
		// ];

		// const lightMaskBindGroup = RenderingContext.device.createBindGroup({
		// 	layout: this.lightsMaskBindGroupLayout,
		// 	entries: lightsMaskBindGroupEntries,
		// });

		// this.pointsLightMasPass = new PointLightsMaskSubPass(
		// 	this.lightsMaskBindGroupLayout,
		// 	lightMaskBindGroup,
		// );
		// this.pointsLightMasPass.setPointLights(this.pointLights);
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.outTextureView,
				loadOp: "clear",
				clearValue: [0, 0, 0, 1],
				storeOp: "store",
			},
		];
		return {
			label: "GBuffer Integrate Render Pass",
			colorAttachments: renderPassColorAttachments,
			depthStencilAttachment: {
				depthReadOnly: true,
				stencilReadOnly: false,
				view: this.inputTextures[2].createView(),
				// depthLoadOp: "load",
				// depthStoreOp: "store",
				stencilLoadOp: "load",
				stencilStoreOp: "store",
			},
		};
	}

	protected createSkyboxRenderPassDescriptor(): GPURenderPassDescriptor {
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.outTextureView,
				loadOp: "load",
				storeOp: "store",
			},
		];
		return {
			label: "Skybox render Pass",
			colorAttachments: renderPassColorAttachments,
			depthStencilAttachment: {
				depthReadOnly: true,
				view: this.inputTextures[2].createView(),
				stencilLoadOp: "load",
				stencilStoreOp: "store",
			},
		};
	}

	private createLightMaskPassDescriptor(): GPURenderPassDescriptor {
		return {
			label: "Mask Lights Render Pass",
			colorAttachments: [],
			depthStencilAttachment: {
				view: this.inputTextures[2].createView(),
				// depthReadOnly: true,
				// stencilReadOnly: false,
				depthLoadOp: "load",
				depthStoreOp: "store",
				stencilLoadOp: "clear",
				stencilStoreOp: "store",
				stencilClearValue: 0,
			},
		};
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		if (!this.inputTextureViews.length) {
			this.inputTextures = inputs;
		}

		// Mask Point Lights
		const lightMaskPassDescriptor = this.createLightMaskPassDescriptor();
		const lightMaskEncoder = commandEncoder.beginRenderPass(
			lightMaskPassDescriptor,
		);

		this.pointsLightMasPass?.render(lightMaskEncoder);

		lightMaskEncoder.end();

		const renderPassDescriptor = this.createRenderPassDescriptor();
		const renderPassEncoder =
			commandEncoder.beginRenderPass(renderPassDescriptor);

		this.pointsLightRenderPass?.render(renderPassEncoder);
		this.dirLightPass?.render(renderPassEncoder);

		renderPassEncoder.end();

		// Skybox
		if (this.skybox) {
			// const skyboxRenderPassEncoder = commandEncoder.beginRenderPass(
			// 	this.createSkyboxRenderPassDescriptor(),
			// );
			// skyboxRenderPassEncoder.setBindGroup(
			// 	BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			// 	this.cameraBindGroup,
			// );
			// this.skybox.render(skyboxRenderPassEncoder);
			// skyboxRenderPassEncoder.end();
		}

		return [this.outTexture];
	}
}
