import Camera from "../../renderer/camera/Camera";
import PipelineStates from "../../renderer/core/PipelineStates";
import RenderingContext from "../../renderer/core/RenderingContext";
import VertexDescriptor from "../../renderer/core/VertexDescriptor";
import Drawable from "../../renderer/scene/Drawable";
import { RenderPassType } from "../../renderer/types";
import GeometryCache from "../utils/GeometryCache";
import LightRenderPass from "./LightRenderPass";
import GetGBufferVertexShader, {
	GBufferVertexEntryFn,
} from "../shaders/GBufferVertexShader";
import Scene from "../../renderer/scene/Scene";

export default class PointLightsMaskPass extends LightRenderPass {
	private renderPSO: GPURenderPipeline;
	private lightsMaskBindGroupLayout: GPUBindGroupLayout;

	private lightsMaskBindGroupEntries: GPUBindGroupEntry[];
	private lightsMaskBindGroup: GPUBindGroup;

	public override setCamera(camera: Camera): this {
		this.camera = camera;
		this.lightsMaskBindGroupEntries[0].resource = {
			buffer: camera.gpuBuffer,
		};
		return this;
	}

	public setLightsBuffer(v: GPUBuffer): this {
		this.lightsMaskBindGroupEntries[1].resource = {
			buffer: v,
		};
		return this;
	}

	public updateLightsMaskBindGroup(): this {
		this.lightsMaskBindGroup = RenderingContext.device.createBindGroup({
			layout: this.lightsMaskBindGroupLayout,
			entries: this.lightsMaskBindGroupEntries,
		});
		return this;
	}

	constructor() {
		super(RenderPassType.PointLightsStencilMask, true);

		this.lightsMaskBindGroupEntries = [
			{
				binding: 0,
				resource: null,
			},
			{
				binding: 1,
				resource: null,
			},
		];

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

		const renderPSOLayout = RenderingContext.device.createPipelineLayout({
			label: "Point Lights Mask Render PSO Layout",
			bindGroupLayouts: [this.lightsMaskBindGroupLayout],
		});

		const renderPSODescriptor: GPURenderPipelineDescriptor = {
			label: "Point Light Mask PSO",
			layout: renderPSOLayout,
			vertex: {
				module: PipelineStates.createShaderModule(
					GetGBufferVertexShader(RenderPassType.PointLightsStencilMask),
					"Point Light Mask Pass Vertex Shader",
				),
				entryPoint: GBufferVertexEntryFn,
				buffers: VertexDescriptor.defaultLayout,
				constants: {
					// ANIMATED_PARTICLES_OFFSET_START: 5,
				},
			},
			depthStencil: {
				format: RenderingContext.depthStencilFormat,
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

		this.renderPSO = PipelineStates.createRenderPipeline(renderPSODescriptor);
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		if (this.renderPassDescriptor) {
			return this.renderPassDescriptor;
		}
		this.renderPassDescriptor =
			this.augmentRenderPassDescriptorWithTimestampQuery({
				label: "Point Lights Mask Stencil Pass",
				colorAttachments: [],
				depthStencilAttachment: {
					view: this.inputTextureViews[0],
					depthLoadOp: "load",
					depthStoreOp: "store",
					stencilLoadOp: "clear",
					stencilStoreOp: "store",
					stencilClearValue: 0,
				},
			});
		return this.renderPassDescriptor;
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		if (!this.inputTextureViews.length) {
			this.inputTextureViews.push(inputs[0].createView());
		}
		const renderPass = commandEncoder.beginRenderPass(
			this.createRenderPassDescriptor(),
		);

		RenderingContext.setActiveRenderPass(this.type, renderPass);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPass.pushDebugGroup("Point Lights Stencil Mask");
		}

		RenderingContext.bindRenderPSO(this.renderPSO);
		renderPass.setStencilReference(128);
		renderPass.setBindGroup(0, this.lightsMaskBindGroup);
		renderPass.setVertexBuffer(
			0,
			GeometryCache.pointLightSphereGeometry.vertexBuffers[0],
		);
		renderPass.setIndexBuffer(
			GeometryCache.pointLightSphereGeometry.indexBuffer,
			Drawable.INDEX_FORMAT,
		);
		renderPass.drawIndexed(
			GeometryCache.pointLightSphereGeometry.indexCount,
			scene.lightingManager.pointLightsCount,
		);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPass.popDebugGroup();
		}
		renderPass.end();

		this.resolveTiming(commandEncoder);

		return [inputs[0]];
	}
}
