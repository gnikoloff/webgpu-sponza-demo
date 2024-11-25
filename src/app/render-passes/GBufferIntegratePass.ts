import { mat4 } from "wgpu-matrix";
import PipelineStates from "../../renderer/core/PipelineStates";
import { VertexDescriptor } from "../../renderer/core/VertexDescriptor";
import RenderPass from "../../renderer/core/RenderPass";
import Light, { LightType } from "../../renderer/lighting/Light";
import Camera from "../../renderer/camera/Camera";
import Drawable from "../../renderer/scene/Drawable";

import Renderer from "../Renderer";
import GeometryCache from "../utils/GeometryCache";

import {
	getGBufferFragShader,
	getGBufferPointVertexShader,
	LIGHT_FRAGMENT_SHADER_ENTRY_NAME,
	POINT_LIGHT_VERTEX_SHADER_ENTRY_NAME,
} from "../shaders/GBufferShader";

import {
	FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME,
	FULLSCREEN_TRIANGLE_VERTEX_SHADER_SRC,
} from "../shaders/VertexShader";
import PointLight from "../../renderer/lighting/PointLight";
import DirectionalLight from "../../renderer/lighting/DirectionalLight";
import TextureController from "../../renderer/texture/TextureController";

export default class GBufferIntegratePass extends RenderPass {
	public outTexture: GPUTexture;
	public outTextureView: GPUTextureView;

	private dirLightPSO: GPURenderPipeline;
	private pointLightRenderPSO: GPURenderPipeline;
	private pointLightMaskPSO: GPURenderPipeline;

	private gbufferTexturesBindGroup: GPUBindGroup;
	private gbufferTexturesBindGroupLayout: GPUBindGroupLayout;

	private lightMaskBindGroup: GPUBindGroup;
	private lightsMaskBindGroupLayout: GPUBindGroupLayout;

	private dirLights: DirectionalLight[] = [];
	private pointLights: PointLight[] = [];

	private lightsBuffer!: GPUBuffer;
	private debugLightsBuffer: GPUBuffer;

	private _debugPointLights = false;
	public get debugPointLights(): boolean {
		return this._debugPointLights;
	}
	public set debugPointLights(v: boolean) {
		if (v !== this._debugPointLights) {
			Renderer.device.queue.writeBuffer(
				this.debugLightsBuffer,
				0,
				new Float32Array([v ? 1 : 0]),
			);
		}
		this._debugPointLights = v;
	}

	constructor(
		private normalReflectanceTextureView: GPUTextureView,
		private colorTextureView: GPUTextureView,
		private depthTextureView: GPUTextureView,
		private depthStencilTextureView: GPUTextureView,
		private stencilTextureView: GPUTextureView,
	) {
		super();

		const dirLightVertexShaderModule = PipelineStates.createShaderModule(
			FULLSCREEN_TRIANGLE_VERTEX_SHADER_SRC,
		);
		const gbufferDirLightingShaderModule = PipelineStates.createShaderModule(
			getGBufferFragShader(0),
		);
		const gbufferPointLightingShaderModule = PipelineStates.createShaderModule(
			getGBufferFragShader(1),
		);

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
				sampler: {},
			},
			{
				binding: 5,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform",
				},
			},
			{
				binding: 6,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "read-only-storage",
				},
			},
			{
				binding: 7,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform",
				},
			},
		];

		this.gbufferTexturesBindGroupLayout = Renderer.device.createBindGroupLayout(
			{
				label: "GBuffer Textures Bind Group",
				entries: gbufferTexturesBindGroupLayoutEntries,
			},
		);

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

		this.lightsMaskBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Light Masking Bind Group",
			entries: lightsMaskBindGroupLayoutEntries,
		});

		const lightRenderPSOLayout = Renderer.device.createPipelineLayout({
			label: "Render Lights PSO Layout",
			bindGroupLayouts: [this.gbufferTexturesBindGroupLayout],
		});

		const lightMaskPSOLayout = Renderer.device.createPipelineLayout({
			label: "Mask Lights PSO Layout",
			bindGroupLayouts: [this.lightsMaskBindGroupLayout],
		});

		const targets: GPUColorTargetState[] = [
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

		const dirLightRenderStencilState: GPUStencilFaceState = {
			compare: "equal",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "keep",
		};
		const dirLightRenderPSODescriptor: GPURenderPipelineDescriptor = {
			label: "Directional Light Render PSO",
			layout: lightRenderPSOLayout,
			vertex: {
				module: dirLightVertexShaderModule,
				entryPoint: FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME,
			},
			fragment: {
				module: gbufferDirLightingShaderModule,
				entryPoint: LIGHT_FRAGMENT_SHADER_ENTRY_NAME,
				targets,
			},
			depthStencil: {
				format: Renderer.depthStencilFormat,
				depthWriteEnabled: false,
			},
		};

		this.dirLightPSO = PipelineStates.createRenderPipeline(
			dirLightRenderPSODescriptor,
		);

		const pointLightRenderVertexShaderModule =
			PipelineStates.createShaderModule(getGBufferPointVertexShader(1, false));

		const lightRenderStencilState: GPUStencilFaceState = {
			compare: "less",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "keep",
		};
		const pointLightRenderPSODescriptor: GPURenderPipelineDescriptor = {
			label: "Point Light Render PSO",
			layout: lightRenderPSOLayout,
			vertex: {
				module: pointLightRenderVertexShaderModule,
				entryPoint: POINT_LIGHT_VERTEX_SHADER_ENTRY_NAME,
				buffers: [VertexDescriptor.defaultLayout],
			},
			fragment: {
				module: gbufferPointLightingShaderModule,
				entryPoint: LIGHT_FRAGMENT_SHADER_ENTRY_NAME,
				targets,
			},
			depthStencil: {
				format: Renderer.depthStencilFormat,
				depthWriteEnabled: false,
				depthCompare: "less-equal",
				stencilReadMask: 0xff,
				stencilWriteMask: 0x0,
				stencilBack: lightRenderStencilState,
				stencilFront: lightRenderStencilState,
			},
			primitive: {
				cullMode: "back",
			},
		};

		this.pointLightRenderPSO = PipelineStates.createRenderPipeline(
			pointLightRenderPSODescriptor,
		);

		const pointLightMaskVertexShaderModule = PipelineStates.createShaderModule(
			getGBufferPointVertexShader(1, true),
		);
		// const lightMaskStencilState: GPUStencilFaceState = {
		// 	compare: "always",
		// 	depthFailOp: "increment-clamp",
		// 	failOp: "keep",
		// 	passOp: "keep",
		// };
		const pointLightMaskPSODescriptor: GPURenderPipelineDescriptor = {
			label: "Point Light Mask PSO",
			layout: lightMaskPSOLayout,
			vertex: {
				module: pointLightMaskVertexShaderModule,
				entryPoint: POINT_LIGHT_VERTEX_SHADER_ENTRY_NAME,
				buffers: [VertexDescriptor.defaultLayout],
			},
			depthStencil: {
				format: Renderer.depthStencilFormat,
				depthWriteEnabled: false,
				depthCompare: "less-equal",
				stencilReadMask: 0x0,
				stencilWriteMask: 0xff,
				stencilBack: {
					compare: "always",
					depthFailOp: "increment-wrap",
					failOp: "keep",
					passOp: "keep",
				},
				stencilFront: {
					compare: "always",
					depthFailOp: "decrement-wrap",
					failOp: "keep",
					passOp: "keep",
				},
			},
			primitive: {
				cullMode: "none",
			},
		};

		this.pointLightMaskPSO = PipelineStates.createRenderPipeline(
			pointLightMaskPSODescriptor,
		);

		this.debugLightsBuffer = Renderer.device.createBuffer({
			label: "Debug Lights GPUBuffer",
			size: 1 * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		});

		new Float32Array(this.debugLightsBuffer.getMappedRange()).set(
			new Float32Array([0]),
		);
		this.debugLightsBuffer.unmap();
	}

	public override setCamera(camera: Camera): void {
		this.camera = camera;
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

		const bayerDitherSampler = Renderer.device.createSampler({
			addressModeU: "repeat",
			addressModeV: "repeat",
			minFilter: "nearest",
			magFilter: "nearest",
		});

		const gbufferTexturesBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: this.normalReflectanceTextureView,
			},
			{
				binding: 1,
				resource: this.colorTextureView,
			},
			{
				binding: 2,
				resource: this.depthTextureView,
			},
			{
				binding: 3,
				resource: TextureController.bayerDitherPatternTexture.createView(),
			},
			{
				binding: 4,
				resource: bayerDitherSampler,
			},
			{
				binding: 5,
				resource: {
					buffer: this.camera.gpuBuffer,
				},
			},
			{
				binding: 6,
				resource: {
					buffer: this.lightsBuffer,
				},
			},
			{
				binding: 7,
				resource: {
					buffer: this.debugLightsBuffer,
				},
			},
		];

		this.gbufferTexturesBindGroup = Renderer.device.createBindGroup({
			layout: this.gbufferTexturesBindGroupLayout,
			entries: gbufferTexturesBindGroupEntries,
		});

		const lightsMaskBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: {
					buffer: this.camera.gpuBuffer,
				},
			},
			{
				binding: 1,
				resource: {
					buffer: this.lightsBuffer,
				},
			},
		];

		this.lightMaskBindGroup = Renderer.device.createBindGroup({
			layout: this.lightsMaskBindGroupLayout,
			entries: lightsMaskBindGroupEntries,
		});
	}

	public setLights(lights: Light[], lightsHaveChanged = false) {
		if (!lights.length) {
			console.error("Empty array of Lights supplied");
			return;
		}

		this.pointLights = lights.filter(
			({ lightType }) => lightType === LightType.Point,
		) as PointLight[];

		this.dirLights = lights.filter(
			({ lightType }) => lightType === LightType.Directional,
		) as DirectionalLight[];

		const lightStructByteSize =
			lights[0].lightsStorageView.arrayBuffer.byteLength;

		if (!this.lightsBuffer) {
			this.lightsBuffer = Renderer.device.createBuffer({
				size: lightStructByteSize * lights.length,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
				label: "Lights Storage Buffer",
			});
			lightsHaveChanged = true;
		}

		if (lightsHaveChanged) {
			let lightIdx = 0;
			for (let i = 0; i < this.dirLights.length; i++) {
				Renderer.device.queue.writeBuffer(
					this.lightsBuffer,
					lightIdx * lightStructByteSize,
					this.dirLights[i].lightsStorageView.arrayBuffer,
				);
				lightIdx++;
			}
			for (let i = 0; i < this.pointLights.length; i++) {
				Renderer.device.queue.writeBuffer(
					this.lightsBuffer,
					lightIdx * lightStructByteSize,
					this.pointLights[i].lightsStorageView.arrayBuffer,
				);
				lightIdx++;
			}
		}
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
			label: "GBuffer Integrate Pass",
			colorAttachments: renderPassColorAttachments,
			depthStencilAttachment: {
				depthReadOnly: true,
				stencilReadOnly: false,
				view: this.depthStencilTextureView,
				// depthLoadOp: "load",
				// depthStoreOp: "store",
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
				view: this.depthStencilTextureView,
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

	public render(commandEncoder: GPUCommandEncoder): void {
		// Mask Point Lights
		const lightMaskPassDescriptor = this.createLightMaskPassDescriptor();
		const lightMaskEncoder = commandEncoder.beginRenderPass(
			lightMaskPassDescriptor,
		);

		lightMaskEncoder.setStencilReference(128);

		lightMaskEncoder.setPipeline(this.pointLightMaskPSO);
		lightMaskEncoder.setBindGroup(0, this.lightMaskBindGroup);
		lightMaskEncoder.setVertexBuffer(
			0,
			GeometryCache.pointLightSphereGeometry.vertexBuffer,
		);
		lightMaskEncoder.setIndexBuffer(
			GeometryCache.pointLightSphereGeometry.indexBuffer,
			Drawable.INDEX_FORMAT,
		);
		lightMaskEncoder.drawIndexed(
			GeometryCache.pointLightSphereGeometry.vertexCount,
			this.pointLights.length,
		);
		lightMaskEncoder.end();

		const renderPassDescriptor = this.createRenderPassDescriptor();
		const renderPassEncoder =
			commandEncoder.beginRenderPass(renderPassDescriptor);

		// Render Point Lights
		renderPassEncoder.setPipeline(this.pointLightRenderPSO);
		// renderPassEncoder.setStencilReference(128);

		renderPassEncoder.setBindGroup(0, this.gbufferTexturesBindGroup);
		renderPassEncoder.setVertexBuffer(
			0,
			GeometryCache.pointLightSphereGeometry.vertexBuffer,
		);
		renderPassEncoder.setIndexBuffer(
			GeometryCache.pointLightSphereGeometry.indexBuffer,
			Drawable.INDEX_FORMAT,
		);
		renderPassEncoder.drawIndexed(
			GeometryCache.pointLightSphereGeometry.vertexCount,
			this.pointLights.length,
		);

		// Directional Lights
		renderPassEncoder.setPipeline(this.dirLightPSO);
		renderPassEncoder.setBindGroup(0, this.gbufferTexturesBindGroup);
		renderPassEncoder.draw(3);

		renderPassEncoder.end();
	}
}
