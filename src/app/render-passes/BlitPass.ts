import Camera from "../../renderer/camera/Camera";
import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import Renderer from "../Renderer";
import {
	BLIT_FRAGMENT_SHADER_ENTRY_NAME,
	BLIT_FRAGMENT_SHADER_SRC,
} from "../shaders/BlitShader";
import {
	FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME,
	FULLSCREEN_TRIANGLE_VERTEX_SHADER_SRC,
} from "../shaders/VertexShader";

export default class BlitPass extends RenderPass {
	private renderPSO: GPURenderPipeline;
	private textureBindGroup: GPUBindGroup;

	constructor(public textureToBlit: GPUTexture) {
		super();
		const vertexShaderModule = PipelineStates.createShaderModule(
			FULLSCREEN_TRIANGLE_VERTEX_SHADER_SRC,
		);
		const fragmentShaderModule = PipelineStates.createShaderModule(
			BLIT_FRAGMENT_SHADER_SRC,
		);

		const targets: GPUColorTargetState[] = [
			{
				format: "bgra8unorm",
			},
		];

		const texturesBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {},
			},
		];

		const texturesBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "GBuffer Textures Bind Group",
			entries: texturesBindGroupLayoutEntries,
		});

		const texturesBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: textureToBlit.createView(),
			},
		];

		const renderPSODescriptor: GPURenderPipelineDescriptor = {
			layout: Renderer.device.createPipelineLayout({
				bindGroupLayouts: [texturesBindGroupLayout],
			}),
			vertex: {
				module: vertexShaderModule,
				entryPoint: FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME,
			},
			fragment: {
				module: fragmentShaderModule,
				entryPoint: BLIT_FRAGMENT_SHADER_ENTRY_NAME,
				targets,
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "back",
			},
		};

		this.renderPSO = PipelineStates.createRenderPipeline(renderPSODescriptor);

		this.textureBindGroup = Renderer.device.createBindGroup({
			layout: texturesBindGroupLayout,
			entries: texturesBindGroupEntries,
		});
	}

	public renderFrame(
		commandEncoder: GPUCommandEncoder,
		outView: GPUTextureView,
	): void {
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: outView,
				loadOp: "load",
				storeOp: "store",
			},
		];
		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: renderPassColorAttachments,
			label: "Blit Pass",
		};
		const renderPassEncoder =
			commandEncoder.beginRenderPass(renderPassDescriptor);

		renderPassEncoder.setPipeline(this.renderPSO);
		renderPassEncoder.setBindGroup(0, this.textureBindGroup);
		renderPassEncoder.draw(6);

		renderPassEncoder.end();
	}
}
