import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import RenderingContext from "../../renderer/core/RenderingContext";
import VRAMUsageTracker from "../../renderer/misc/VRAMUsageTracker";
import Scene from "../../renderer/scene/Scene";
import FullScreenVertexShaderUtils, {
	FullScreenVertexShaderEntryFn,
} from "../../renderer/shader/FullScreenVertexShaderUtils";
import { RenderPassType } from "../../renderer/types";
import SSAOBlurShaderSrc, {
	SSSAOBlurShaderName,
} from "../shaders/SSAOBlurShader";

export default class SSAOBlurRenderPass extends RenderPass {
	private outTextureView: GPUTextureView;

	private renderPSO: GPURenderPipeline;
	private bindGroupLayout: GPUBindGroupLayout;
	private bindGroup!: GPUBindGroup;

	constructor(width: number, height: number) {
		super(RenderPassType.SSAOBlur, width, height);

		const renderTargets: GPUColorTargetState[] = [
			{
				format: "r16float",
			},
		];

		const blurBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: "unfilterable-float",
				},
			},
		];

		this.bindGroupLayout = RenderingContext.device.createBindGroupLayout({
			label: "SSAO Blur Input Bind Group",
			entries: blurBindGroupLayoutEntries,
		});

		this.renderPSO = PipelineStates.createRenderPipeline({
			label: "SSAO Blur RenderPSO",
			layout: RenderingContext.device.createPipelineLayout({
				label: "SSAO Blur RenderPSO Layout",
				bindGroupLayouts: [this.bindGroupLayout],
			}),
			vertex: {
				module: PipelineStates.createShaderModule(FullScreenVertexShaderUtils),
				entryPoint: FullScreenVertexShaderEntryFn,
			},
			fragment: {
				module: PipelineStates.createShaderModule(SSAOBlurShaderSrc),
				entryPoint: SSSAOBlurShaderName,
				targets: renderTargets,
			},
		});

		// width *= SSAORenderPass.SSAO_SCALE_FACTOR;
		// height *= SSAORenderPass.SSAO_SCALE_FACTOR;
		this.outTextures.push(
			RenderingContext.device.createTexture({
				dimension: "2d",
				format: "r16float",
				mipLevelCount: 1,
				sampleCount: 1,
				size: { width, height, depthOrArrayLayers: 1 },
				usage:
					GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
				label: "SSAO Blurred Texture",
			}),
		);

		VRAMUsageTracker.addTextureBytes(this.outTextures[0]);

		this.outTextureView = this.outTextures[0].createView();
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		if (this.renderPassDescriptor) {
			return this.renderPassDescriptor;
		}
		const colorAttachments: GPURenderPassColorAttachment[] = [
			{
				loadOp: "load",
				storeOp: "store",
				view: this.outTextureView,
			},
		];
		this.renderPassDescriptor =
			this.augmentRenderPassDescriptorWithTimestampQuery({
				label: "SSAO Blur Render Pass Descriptor",
				colorAttachments,
			});
		return this.renderPassDescriptor;
	}

	public render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		if (!this.inputTextureViews.length) {
			this.inputTextureViews.push(inputs[0].createView());

			const entries: GPUBindGroupEntry[] = [
				{
					binding: 0,
					resource: this.inputTextureViews[0],
				},
			];
			this.bindGroup = RenderingContext.device.createBindGroup({
				label: "SSAO Blur Bind Group",
				entries,
				layout: this.bindGroupLayout,
			});
		}

		const renderPass = commandEncoder.beginRenderPass(
			this.createRenderPassDescriptor(),
		);
		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPass.pushDebugGroup("Begin SSAO Blur");
		}

		renderPass.setBindGroup(0, this.bindGroup);
		renderPass.setPipeline(this.renderPSO);
		renderPass.draw(3);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPass.popDebugGroup();
		}
		renderPass.end();

		this.postRender(commandEncoder);

		return this.outTextures;
	}
}
