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
	private static readonly BLOOM_MIX_FACTOR = 0.04;

	private renderPSO: GPURenderPipeline;
	private texturesBindGroupLayout: GPUBindGroupLayout;
	private textureBindGroup: GPUBindGroup;
	private bloomMixFactorBuffer: GPUBuffer;

	public set bloomEnabled(v: boolean) {
		RenderingContext.device.queue.writeBuffer(
			this.bloomMixFactorBuffer,
			0,
			new Float32Array([v ? BlitRenderPass.BLOOM_MIX_FACTOR : 0]),
		);
	}

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
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {},
			},
			{
				binding: 2,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {},
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

		this.bloomMixFactorBuffer = RenderingContext.device.createBuffer({
			label: "Bloom Mix Factor GPU Buffer",
			size: 1 * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		});
		new Float32Array(this.bloomMixFactorBuffer.getMappedRange()).set([
			BlitRenderPass.BLOOM_MIX_FACTOR,
		]);

		this.bloomMixFactorBuffer.unmap();
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
			this.inputTextureViews.push(inputs[1].createView());

			const texturesBindGroupEntries: GPUBindGroupEntry[] = [
				{
					binding: 0,
					resource: this.inputTextureViews[0],
				},
				{
					binding: 1,
					resource: this.inputTextureViews[1],
				},
				{
					binding: 2,
					resource: {
						buffer: this.bloomMixFactorBuffer,
					},
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
