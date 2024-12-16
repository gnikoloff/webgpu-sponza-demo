import { vec3 } from "wgpu-matrix";
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
import CameraFaceCulledPointLight from "../../renderer/lighting/CameraFaceCulledPointLight";

export default class PointLightsNonCulledRenderPass extends LightRenderPass {
	private static readonly FRONT_FACE_RENDER_PSO_LABEL =
		"Render Non-Instanced Non-Culled Point Lights Front Face PSO Descriptor";
	private static readonly BACK_FACE_RENDER_PSO_LABEL =
		"Render Non-Instanced Non-Culled Point Lights Back Face PSO Descriptor";

	private frontFaceCullRenderPSO: GPURenderPipeline;
	private backFaceCullRenderPSO: GPURenderPipeline;

	constructor(width: number, height: number) {
		super(RenderPassType.PointLightsNonCulledLighting, width, height);

		const renderPSOLayout = RenderingContext.device.createPipelineLayout({
			label: "Render Non-Instanced Non-Culled Point Lights PSO Layout",
			bindGroupLayouts: [
				this.gbufferCommonBindGroupLayout,
				CameraFaceCulledPointLight.bindGroupLayout,
			],
		});
		const renderPSODescriptor: GPURenderPipelineDescriptor = {
			label: PointLightsNonCulledRenderPass.FRONT_FACE_RENDER_PSO_LABEL,
			layout: renderPSOLayout,
			vertex: {
				module: PipelineStates.createShaderModule(
					GetGBufferVertexShader(RenderPassType.PointLightsNonCulledLighting),
					"Non-Instanced Non-Culled Point Lights Vertex Shader",
				),
				entryPoint: GBufferVertexEntryFn,
				buffers: VertexDescriptor.defaultLayout,
			},
			fragment: {
				module: PipelineStates.createShaderModule(
					GetGBufferIntegrateShader(
						RenderPassType.PointLightsNonCulledLighting,
					),
				),
				entryPoint: GBufferIntegrateShaderEntryFn,
				targets: PointLightsNonCulledRenderPass.RENDER_TARGETS,
			},
			depthStencil: {
				format: RenderingContext.depthStencilFormat,
				depthWriteEnabled: false,
			},
			primitive: {
				cullMode: "back",
			},
		};
		this.frontFaceCullRenderPSO =
			PipelineStates.createRenderPipeline(renderPSODescriptor);

		renderPSODescriptor.label =
			PointLightsNonCulledRenderPass.BACK_FACE_RENDER_PSO_LABEL;
		renderPSODescriptor.primitive.cullMode = "front";

		this.backFaceCullRenderPSO =
			PipelineStates.createRenderPipeline(renderPSODescriptor);
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
				label: "Non-Instanced Non-Culled Point Lights Render Pass",
				colorAttachments: renderPassColorAttachments,
				depthStencilAttachment: {
					depthReadOnly: true,
					stencilReadOnly: true,
					view: this.inputTextureViews[2],
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
				.recreateGBufferTexturesBindGroup();
		}

		const renderPass = commandEncoder.beginRenderPass(
			this.createRenderPassDescriptor(),
		);

		const indexBuffer = GeometryCache.pointLightSphereGeometry.indexBuffer;
		const vertexBuffer =
			GeometryCache.pointLightSphereGeometry.vertexBuffers[0];
		const indexCount = GeometryCache.pointLightSphereGeometry.indexCount;

		renderPass.setIndexBuffer(indexBuffer, Drawable.INDEX_FORMAT);
		renderPass.setVertexBuffer(0, vertexBuffer);
		renderPass.setBindGroup(0, this.gbufferTexturesBindGroup);

		let isPrevFrontFaceCullPSOBound = false;
		let isPrevBackFaceCullPSOBound = false;
		for (const pLight of scene.lightingManager.cameraFaceCulledPointLights) {
			const dist = vec3.dist(pLight.position, this.camera.position);

			if (dist > pLight.radius + 0.1) {
				if (!isPrevFrontFaceCullPSOBound) {
					renderPass.setPipeline(this.frontFaceCullRenderPSO);
				}
				isPrevFrontFaceCullPSOBound = true;
				isPrevFrontFaceCullPSOBound = false;
			} else {
				if (!isPrevBackFaceCullPSOBound) {
					renderPass.setPipeline(this.backFaceCullRenderPSO);
				}
				isPrevFrontFaceCullPSOBound = false;
				isPrevFrontFaceCullPSOBound = true;
			}
			renderPass.setBindGroup(1, pLight.bindGroup);

			renderPass.drawIndexed(indexCount);
		}
		renderPass.end();

		this.postRender(commandEncoder);

		return [inputs[4]];
	}
}
