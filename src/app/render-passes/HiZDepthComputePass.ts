import { Vec2, vec2 } from "wgpu-matrix";
import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import RenderingContext from "../../renderer/core/RenderingContext";
import Scene from "../../renderer/scene/Scene";
import { RenderPassType } from "../../renderer/types";
import {
	COMPUTE_HI_Z_DEPTH_COMPUTE_SHADER_SRC,
	HI_Z_DEPTH_COMPUTE_SHADER_ENTRY_FN,
} from "../shaders/HiZDepthShader";

export default class HiZDepthComputePass extends RenderPass {
	private static readonly COMPUTE_WORKGROUP_SIZE_X = 16;
	private static readonly COMPUTE_WORKGROUP_SIZE_Y = 16;

	private computePSO: GPUComputePipeline;
	private bindGroupLayout: GPUBindGroupLayout;
	private bindGroups: GPUBindGroup[] = [];
	private mipTexSizes: Vec2[] = [];
	private mipTexViews: GPUTextureView[] = [];

	constructor() {
		super(RenderPassType.HiZ);

		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				texture: {
					sampleType: "unfilterable-float",
				},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				storageTexture: {
					access: "write-only",
					format: "r32float",
					viewDimension: "2d",
				},
			},
		];
		this.bindGroupLayout = RenderingContext.device.createBindGroupLayout({
			label: "Hi-Z Bind Group Layout",
			entries: bindGroupLayoutEntries,
		});

		this.computePSO = PipelineStates.createComputePipeline({
			label: "Hi-Z Compute PSO",
			layout: RenderingContext.device.createPipelineLayout({
				label: "Hi-Z Compute PSO Layout",
				bindGroupLayouts: [this.bindGroupLayout],
			}),
			compute: {
				entryPoint: HI_Z_DEPTH_COMPUTE_SHADER_ENTRY_FN,
				module: PipelineStates.createShaderModule(
					COMPUTE_HI_Z_DEPTH_COMPUTE_SHADER_SRC,
					"Compute Hi-Z Shader Module",
				),
				constants: {
					WORKGROUP_SIZE_X: HiZDepthComputePass.COMPUTE_WORKGROUP_SIZE_X,
					WORKGROUP_SIZE_Y: HiZDepthComputePass.COMPUTE_WORKGROUP_SIZE_Y,
				},
			},
		});
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		const mipsLevelCount = inputs[0].mipLevelCount;

		const origWidth = inputs[0].width;
		const origHeight = inputs[0].height;

		if (!this.mipTexSizes.length) {
			this.mipTexSizes.push(vec2.create(origWidth, origHeight));
			for (let level = 1; level < mipsLevelCount; level++) {
				const prevSize = this.mipTexSizes[level - 1];

				const currSize = vec2.divScalar(prevSize, 2);
				this.mipTexSizes.push(currSize);
			}
		}

		const textureViewDescriptor: GPUTextureViewDescriptor = {
			baseMipLevel: 0,
			mipLevelCount: 1,
			dimension: "2d",
			format: inputs[0].format,
		};

		if (!this.mipTexViews.length) {
			for (let level = 0; level < mipsLevelCount; level++) {
				textureViewDescriptor.label = `Hi-Z Depth Mip Level ${level}`;
				textureViewDescriptor.baseMipLevel = level;
				this.mipTexViews.push(inputs[0].createView(textureViewDescriptor));
			}
		}

		const bindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: null,
			},
			{
				binding: 1,
				resource: null,
			},
		];

		const computePass = commandEncoder.beginComputePass({
			label: "Hi-Z Depth Mip Compute Pass",
		});
		computePass.setPipeline(this.computePSO);

		for (let nextLevel = 1; nextLevel < mipsLevelCount; nextLevel++) {
			const invocationCountX = this.mipTexSizes[nextLevel][0];
			const invocationCountY = this.mipTexSizes[nextLevel][1];
			const workgroupCountX =
				(invocationCountX + HiZDepthComputePass.COMPUTE_WORKGROUP_SIZE_X - 1) /
				HiZDepthComputePass.COMPUTE_WORKGROUP_SIZE_X;
			const workgroupCountY =
				(invocationCountY + HiZDepthComputePass.COMPUTE_WORKGROUP_SIZE_Y - 1) /
				HiZDepthComputePass.COMPUTE_WORKGROUP_SIZE_Y;

			bindGroupEntries[0].resource = this.mipTexViews[nextLevel - 1];
			bindGroupEntries[1].resource = this.mipTexViews[nextLevel];
			const bindGroup = RenderingContext.device.createBindGroup({
				layout: this.bindGroupLayout,
				entries: bindGroupEntries,
			});

			computePass.setBindGroup(0, bindGroup);
			computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1);
		}

		computePass.end();

		return inputs;
	}
}
