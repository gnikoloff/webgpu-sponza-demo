import PipelineStates from "../../../renderer/core/PipelineStates";
import VertexDescriptor from "../../../renderer/core/VertexDescriptor";
import { LightType } from "../../../renderer/lighting/Light";
import PointLight from "../../../renderer/lighting/PointLight";
import Drawable from "../../../renderer/scene/Drawable";
import Renderer from "../../Renderer";
import GeometryCache from "../../utils/GeometryCache";
import DirectionalShadowPass from "../DirectionalShadowPass";
import LightPass from "./LightPass";
import GetGBufferIntegrateShader, {
	GBufferIntegrateShaderEntryFn,
} from "./shader/GBufferIntegrateShader";
import GetGBufferVertexShader, {
	GBufferVertexEntryFn,
} from "./shader/GBufferVertexShader";

export default class PointLightsRenderPass extends LightPass {
	private renderPSO: GPURenderPipeline;
	private pointLights: PointLight[] = [];

	public setPointLights(lights: PointLight[]) {
		this.pointLights = lights;
	}

	constructor(
		gbufferCommonBindGroupLayout: GPUBindGroupLayout,
		protected gbufferCommonBindGroup: GPUBindGroup,
	) {
		super(gbufferCommonBindGroupLayout);

		const pointLightRenderPSOLayout = Renderer.device.createPipelineLayout({
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
					GetGBufferVertexShader(1, false),
					"Point Light Render Pass Vertex Shader",
				),
				entryPoint: GBufferVertexEntryFn,
				buffers: [VertexDescriptor.defaultLayout],
			},
			fragment: {
				module: PipelineStates.createShaderModule(
					GetGBufferIntegrateShader(
						LightType.Point,
						DirectionalShadowPass.TEXTURE_SIZE,
						1,
					),
				),
				entryPoint: GBufferIntegrateShaderEntryFn,
				targets: PointLightsRenderPass.RENDER_TARGETS,
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

		this.renderPSO = PipelineStates.createRenderPipeline(
			pointLightRenderPSODescriptor,
		);
	}

	public override render(renderPassEncoder: GPURenderPassEncoder) {
		if (!this.pointLights.length) {
			return;
		}
		renderPassEncoder.setPipeline(this.renderPSO);
		renderPassEncoder.setBindGroup(0, this.gbufferCommonBindGroup);
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
	}
}
