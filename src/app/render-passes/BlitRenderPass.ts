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

	constructor(width: number, height: number) {
		super(RenderPassType.Blit, width, height);
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

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		if (this.renderPassDescriptor) {
			return this.renderPassDescriptor;
		}
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: null,
				loadOp: "load",
				storeOp: "store",
			},
		];
		this.renderPassDescriptor =
			this.augmentRenderPassDescriptorWithTimestampQuery({
				colorAttachments: renderPassColorAttachments,
				label: "Blit Pass",
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

		const descriptor = this.createRenderPassDescriptor();
		descriptor.colorAttachments[0].view = RenderingContext.canvasContext
			.getCurrentTexture()
			.createView();
		const renderPassEncoder = commandEncoder.beginRenderPass(descriptor);

		RenderingContext.setActiveRenderPass(this.type, renderPassEncoder);

		RenderingContext.bindRenderPSO(this.renderPSO);
		renderPassEncoder.setBindGroup(0, this.textureBindGroup);
		renderPassEncoder.draw(6);

		renderPassEncoder.end();

		this.postRender(commandEncoder);

		return [];
	}
}
