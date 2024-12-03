import PipelineStates from "../../renderer/core/PipelineStates";
import FullScreenVertexShaderUtils, {
	FullScreenVertexShaderEntryFn,
} from "../../renderer/shader/FullScreenVertexShaderUtils";
import SamplerController from "../../renderer/texture/SamplerController";
import Renderer from "../Renderer";
import {
	DebugFragmentShaderEntryFn,
	getDebugFragmentShader,
} from "./shaders/DebugFragmentShader";

export enum TextureDebugMeshType {
	Normal,
	Metallic,
	Roughness,
	Reflectance,
	Albedo,
	Depth,
	Velocity,
	ShadowDepthCascade0,
	ShadowDepthCascade1,
	BDRF,
}

const TextureTypesToDisplayNames: Map<TextureDebugMeshType, string> = new Map([
	[TextureDebugMeshType.Albedo, "Albedo"],
	[TextureDebugMeshType.Normal, "Normal"],
	[TextureDebugMeshType.Metallic, "Metallic"],
	[TextureDebugMeshType.Roughness, "Roughness"],
	[TextureDebugMeshType.Reflectance, "Reflectance"],
	[TextureDebugMeshType.Depth, "Depth"],
	[TextureDebugMeshType.Velocity, "Velocity"],
	[TextureDebugMeshType.ShadowDepthCascade0, "Cascade #1"],
	[TextureDebugMeshType.ShadowDepthCascade1, "Cascade #2"],
]);

export default class DebugTextureCanvas {
	private $rootEl: HTMLDivElement;
	private $headline: HTMLHeadingElement;

	private $canvas: HTMLCanvasElement;
	private ctx: GPUCanvasContext;

	private renderPSO: GPURenderPipeline;
	private renderPassDescriptor: GPURenderPassDescriptor;

	private samplerTextureBindGroupLayout: GPUBindGroupLayout;
	private samplerTextureBindGroup?: GPUBindGroup;

	private debugTexture: GPUTexture;

	private get isDepthTexture(): boolean {
		return (
			this.type === TextureDebugMeshType.Depth ||
			this.type === TextureDebugMeshType.ShadowDepthCascade0 ||
			this.type === TextureDebugMeshType.ShadowDepthCascade1
		);
	}

	private samplerTextureBindGroupLayoutEntries: GPUBindGroupLayoutEntry[];

	constructor(protected type: TextureDebugMeshType) {
		this.$rootEl = document.createElement("div");
		this.$headline = document.createElement("h4");
		this.$canvas = document.createElement("canvas");

		this.$rootEl.classList.add("debug-canvas-wrapper");
		this.$canvas.classList.add("debug-canvas");

		this.$headline.innerText = TextureTypesToDisplayNames.get(type);

		this.$rootEl.appendChild(this.$headline);
		this.$rootEl.appendChild(this.$canvas);

		this.ctx = this.$canvas.getContext("webgpu");

		this.ctx.configure({
			device: Renderer.device,
			format: Renderer.pixelFormat,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});

		const targets: GPUColorTargetState[] = [
			{
				format: Renderer.pixelFormat,
			},
		];

		this.samplerTextureBindGroupLayoutEntries = [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {
					type: "filtering",
				},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: this.isDepthTexture ? "depth" : "float",
				},
			},
		];

		this.samplerTextureBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "TextureDebugMesh Sampler + Texture GPUBindGroupLayout",
			entries: this.samplerTextureBindGroupLayoutEntries,
		});

		this.renderPSO = PipelineStates.createRenderPipeline({
			label: `Debug Canvas ${type} Render PSO`,
			vertex: {
				module: PipelineStates.createShaderModule(FullScreenVertexShaderUtils),
				entryPoint: FullScreenVertexShaderEntryFn,
			},
			fragment: {
				module: PipelineStates.createShaderModule(
					getDebugFragmentShader(this.type),
				),
				entryPoint: DebugFragmentShaderEntryFn,
				targets,
			},
			layout: Renderer.device.createPipelineLayout({
				label: `Debug Canvas ${type} Render PSO Layout`,
				bindGroupLayouts: [this.samplerTextureBindGroupLayout],
			}),
		});

		this.renderPassDescriptor = {
			label: `Debug Canvas ${type} Render Pass Descriptor`,
			colorAttachments: [
				{
					loadOp: "load",
					storeOp: "store",
					view: null,
				},
			],
		};
	}

	public appendTo(parent: HTMLElement) {
		parent.appendChild(this.$rootEl);
	}

	public setTexture(
		texture: GPUTexture,
		w = texture.width,
		h = texture.height,
	) {
		this.debugTexture = texture;

		this.$canvas.width = w;
		this.$canvas.height = h;

		let baseArrayLayer = 0;
		let dimension: GPUTextureViewDimension = "2d";
		if (this.type === TextureDebugMeshType.ShadowDepthCascade0) {
			baseArrayLayer = 0;
		} else if (this.type === TextureDebugMeshType.ShadowDepthCascade1) {
			baseArrayLayer = 1;
		}

		const samplerTextureBindGroupEntries = [
			{
				binding: 0,
				resource: SamplerController.createSampler({
					magFilter: "linear",
					minFilter: "linear",
				}),
			},
			{
				binding: 1,
				resource: texture.createView({
					aspect: this.isDepthTexture ? "depth-only" : "all",
					baseArrayLayer,
					dimension,
				}),
			},
		];

		this.samplerTextureBindGroup = Renderer.device.createBindGroup({
			layout: this.samplerTextureBindGroupLayout,
			entries: samplerTextureBindGroupEntries,
		});
	}

	public render(commandEncoder: GPUCommandEncoder) {
		if (!this.debugTexture) {
			return;
		}

		this.renderPassDescriptor.colorAttachments[0].view = this.ctx
			.getCurrentTexture()
			.createView();

		const renderPassEncoder = commandEncoder.beginRenderPass(
			this.renderPassDescriptor,
		);
		renderPassEncoder.pushDebugGroup(`Display Debug Texture ${this.type}`);

		renderPassEncoder.setPipeline(this.renderPSO);
		renderPassEncoder.setBindGroup(0, this.samplerTextureBindGroup);
		renderPassEncoder.draw(3);

		renderPassEncoder.popDebugGroup();
		renderPassEncoder.end();
	}
}
