import PipelineStates from "../../renderer/core/PipelineStates";
import RenderingContext from "../../renderer/core/RenderingContext";
import VertexDescriptor from "../../renderer/core/VertexDescriptor";
import Drawable from "../../renderer/scene/Drawable";
import Scene from "../../renderer/scene/Scene";
import { RenderPassType } from "../../renderer/types";
import GetGBufferIntegrateShader, {
	GBufferIntegrateShaderEntryFn,
} from "../shaders/GBufferIntegrateShader";
import GetGBufferVertexShader, {
	GBufferVertexEntryFn,
} from "../shaders/GBufferVertexShader";
import GeometryCache from "../utils/GeometryCache";
import LightRenderPass from "./LightRenderPass";

export default class PointLightsRenderPass extends LightRenderPass {
	private renderPSO: GPURenderPipeline;

	constructor(width: number, height: number) {
		super(RenderPassType.PointLightsLighting, width, height);

		const pointLightRenderPSOLayout =
			RenderingContext.device.createPipelineLayout({
				label: "Render Lights PSO Layout",
				bindGroupLayouts: [this.gbufferCommonBindGroupLayout],
			});

		const lightRenderStencilState: GPUStencilFaceState = {
			compare: "less",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "keep",
		};

		const pointLightRenderPSODescriptor: GPURenderPipelineDescriptor = {
			label: "Point Light Render PSO",
			layout: pointLightRenderPSOLayout,
			vertex: {
				module: PipelineStates.createShaderModule(
					GetGBufferVertexShader(RenderPassType.PointLightsLighting),
					"Point Light Render Pass Vertex Shader",
				),
				entryPoint: GBufferVertexEntryFn,
				buffers: VertexDescriptor.defaultLayout,
				constants: {
					// ANIMATED_PARTICLES_OFFSET_START: 5,
				},
			},
			fragment: {
				module: PipelineStates.createShaderModule(
					GetGBufferIntegrateShader(RenderPassType.PointLightsLighting),
					"Point Light Render Pass Fragment Shader",
				),
				entryPoint: GBufferIntegrateShaderEntryFn,
				targets: PointLightsRenderPass.RENDER_TARGETS,
			},
			depthStencil: {
				format: RenderingContext.depthStencilFormat,
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
		this.renderPSO = PipelineStates.createRenderPipeline(
			pointLightRenderPSODescriptor,
		);
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		if (this.renderPassDescriptor) {
			return this.renderPassDescriptor;
		}
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.inputTextureViews[5],
				loadOp: "load",
				storeOp: "store",
			},
		];
		this.renderPassDescriptor =
			this.augmentRenderPassDescriptorWithTimestampQuery({
				label: "Point Lights Render Pass",
				colorAttachments: renderPassColorAttachments,
				depthStencilAttachment: {
					depthReadOnly: true,
					stencilReadOnly: false,
					view: this.inputTextureViews[2],
					// depthLoadOp: "load",
					// depthStoreOp: "store",
					stencilLoadOp: "load",
					stencilStoreOp: "store",
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
			this.inputTextureViews.push(inputs[1].createView());
			this.inputTextureViews.push(
				inputs[2].createView({
					aspect: "all",
				}),
			);
			this.inputTextureViews.push(
				inputs[2].createView({
					aspect: "depth-only",
				}),
			);
			this.inputTextureViews.push(inputs[3].createView());
			this.inputTextureViews.push(inputs[4].createView());

			this.updateGbufferBindGroupEntryAt(0, this.inputTextureViews[0])
				.updateGbufferBindGroupEntryAt(1, this.inputTextureViews[1])
				.updateGbufferBindGroupEntryAt(2, this.inputTextureViews[3])
				.updateGbufferBindGroupEntryAt(3, this.inputTextureViews[4])
				.updateGbufferBindGroupEntryAt(4, {
					buffer: this.camera.gpuBuffer,
				})
				.updateGbufferBindGroupEntryAt(5, {
					buffer: scene.lightingManager.gpuBuffer,
				})
				.recreateGBufferTexturesBindGroup();
		}

		const renderPass = commandEncoder.beginRenderPass(
			this.createRenderPassDescriptor(),
		);

		RenderingContext.setActiveRenderPass(this.type, renderPass);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPass.pushDebugGroup("Begin Point LightingSystem");
		}

		RenderingContext.bindRenderPSO(this.renderPSO);
		renderPass.setBindGroup(0, this.gbufferTexturesBindGroup);
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
			0,
			0,
			1,
		);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPass.popDebugGroup();
		}
		renderPass.end();

		this.postRender(commandEncoder);

		return [inputs[4]];
	}
}
