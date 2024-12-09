import PipelineStates from "../../../renderer/core/PipelineStates";
import VertexDescriptor from "../../../renderer/core/VertexDescriptor";
import PointLight from "../../../renderer/lighting/PointLight";
import Drawable from "../../../renderer/scene/Drawable";
import Renderer from "../../Renderer";
import GeometryCache from "../../utils/GeometryCache";
import LightSubPass from "./LightSubPass";
import GetGBufferVertexShader, {
	GBufferVertexEntryFn,
} from "./shader/GBufferVertexShader";

export default class PointLightsMaskSubPass extends LightSubPass {
	private maskPSO: GPURenderPipeline;

	private pointLights: PointLight[] = [];

	public setPointLights(lights: PointLight[]) {
		this.pointLights = lights;
	}

	constructor(
		lightsMaskBindGroupLayout: GPUBindGroupLayout,
		protected lightMaskBindGroup: GPUBindGroup,
	) {
		super(lightsMaskBindGroupLayout);

		const lightMaskPSOLayout = Renderer.device.createPipelineLayout({
			label: "Mask Lights PSO Layout",
			bindGroupLayouts: [lightsMaskBindGroupLayout],
		});

		const pointLightMaskPSODescriptor: GPURenderPipelineDescriptor = {
			label: "Point Light Mask PSO",
			layout: lightMaskPSOLayout,
			vertex: {
				module: PipelineStates.createShaderModule(
					GetGBufferVertexShader(1, true),
					"Point Light Mask Pass Vertex Shader",
				),
				entryPoint: GBufferVertexEntryFn,
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

		this.maskPSO = PipelineStates.createRenderPipeline(
			pointLightMaskPSODescriptor,
		);
	}

	public override render(renderPassEncoder: GPURenderPassEncoder) {
		if (!this.pointLights.length) {
			return;
		}

		renderPassEncoder.setStencilReference(128);

		renderPassEncoder.setPipeline(this.maskPSO);
		renderPassEncoder.setBindGroup(0, this.lightMaskBindGroup);
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
