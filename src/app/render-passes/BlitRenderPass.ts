import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import RenderingContext from "../../renderer/core/RenderingContext";
import Scene from "../../renderer/scene/Scene";
import { RenderPassType } from "../../renderer/types";
import {
	BLIT_FRAGMENT_SHADER_ENTRY_NAME,
	BLIT_FRAGMENT_SHADER_SRC,
} from "../shaders/BlitShader";
import {
	FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME,
	FULLSCREEN_TRIANGLE_VERTEX_SHADER_SRC,
} from "../shaders/VertexShader";

export default class BlitRenderPass extends RenderPass {
	private renderPSO: GPURenderPipeline;
	private texturesBindGroupLayout: GPUBindGroupLayout;

	private textureBindGroup: GPUBindGroup;

	constructor() {
		super(RenderPassType.Blit);
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

		this.texturesBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "GBuffer Textures Bind Group",
				entries: texturesBindGroupLayoutEntries,
			});

		const renderPSODescriptor: GPURenderPipelineDescriptor = {
			layout: RenderingContext.device.createPipelineLayout({
				bindGroupLayouts: [this.texturesBindGroupLayout],
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
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		if (!this.inputTextureViews.length) {
			this.inputTextureViews.push(inputs[0].createView());

			const texturesBindGroupEntries: GPUBindGroupEntry[] = [
				{
					binding: 0,
					resource: this.inputTextureViews[0],
				},
			];
			this.textureBindGroup = RenderingContext.device.createBindGroup({
				layout: this.texturesBindGroupLayout,
				entries: texturesBindGroupEntries,
			});
		}

		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: RenderingContext.canvasContext.getCurrentTexture().createView(),
				loadOp: "load",
				storeOp: "store",
			},
		];
		const renderPassDescriptor: GPURenderPassDescriptor =
			this.augmentRenderPassDescriptorWithTimestampQuery({
				colorAttachments: renderPassColorAttachments,
				label: "Blit Pass",
			});
		const renderPassEncoder =
			commandEncoder.beginRenderPass(renderPassDescriptor);

		RenderingContext.setActiveRenderPass(this.type, renderPassEncoder);

		RenderingContext.bindRenderPSO(this.renderPSO);
		renderPassEncoder.setBindGroup(0, this.textureBindGroup);
		renderPassEncoder.draw(6);

		renderPassEncoder.end();

		this.resolveTiming(commandEncoder);

		return [];
	}
}
