import Camera from "../../renderer/camera/Camera";
import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import RenderingContext from "../../renderer/core/RenderingContext";
import Scene from "../../renderer/scene/Scene";
import { RenderPassType } from "../../renderer/types";
import {
	REFLECTION_PASS_COMPUTE_SHADER_ENTRY_NAME,
	getReflectionComputeShader,
} from "../shaders/ReflectionShader";

export default class ReflectionComputePass extends RenderPass {
	private static readonly COMPUTE_WORKGROUP_SIZE_X = 16;
	private static readonly COMPUTE_WORKGROUP_SIZE_Y = 16;

	private outTexture: GPUTexture;
	private computePSO: GPUComputePipeline;
	private bindGroupLayout: GPUBindGroupLayout;
	private bindGroup!: GPUBindGroup;

	private settingsBuffer: GPUBuffer;

	private _maxIterations = 150;
	public get maxIterations(): number {
		return this._maxIterations;
	}
	public set maxIterations(v: number) {
		this._maxIterations = v;
		this.updateSettingsBuffer();
	}

	private _isHiZ = true;
	public get isHiZ(): boolean {
		return this._isHiZ;
	}
	public set isHiZ(v: boolean) {
		this._isHiZ = v;
		this.updateSettingsBuffer();
	}

	private updateSettingsBuffer() {
		RenderingContext.device.queue.writeBuffer(
			this.settingsBuffer,
			0,
			new Int32Array([this._isHiZ ? 1 : 0, this._maxIterations]),
		);
	}

	constructor() {
		super(RenderPassType.Reflection);

		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				texture: {},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				texture: {},
			},
			{
				binding: 2,
				visibility: GPUShaderStage.COMPUTE,
				texture: {},
			},
			{
				binding: 3,
				visibility: GPUShaderStage.COMPUTE,
				texture: {
					sampleType: "unfilterable-float",
				},
			},
			{
				binding: 4,
				visibility: GPUShaderStage.COMPUTE,
				storageTexture: {
					access: "write-only",
					format: "rgba16float",
					viewDimension: "2d",
				},
			},
			{
				binding: 5,
				visibility: GPUShaderStage.COMPUTE,
				buffer: {
					type: "uniform",
				},
			},
			{
				binding: 6,
				visibility: GPUShaderStage.COMPUTE,
				buffer: {
					type: "uniform",
				},
			},
		];

		this.bindGroupLayout = RenderingContext.device.createBindGroupLayout({
			label: "Reflection Pass ComputePSO Bind Group Layout",
			entries: bindGroupLayoutEntries,
		});
		this.computePSO = PipelineStates.createComputePipeline({
			label: "Reflection Pass Compute PSO",
			layout: RenderingContext.device.createPipelineLayout({
				label: "Reflection PASS ComputePSO Layout",
				bindGroupLayouts: [this.bindGroupLayout],
			}),
			compute: {
				entryPoint: REFLECTION_PASS_COMPUTE_SHADER_ENTRY_NAME,
				module: PipelineStates.createShaderModule(
					getReflectionComputeShader("rgba16float"),
				),
				constants: {
					WORKGROUP_SIZE_X: ReflectionComputePass.COMPUTE_WORKGROUP_SIZE_X,
					WORKGROUP_SIZE_Y: ReflectionComputePass.COMPUTE_WORKGROUP_SIZE_Y,
				},
			},
		});

		this.settingsBuffer = RenderingContext.device.createBuffer({
			label: "SSR Settings Buffer",
			size: 4 * Uint32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		});
		new Int32Array(this.settingsBuffer.getMappedRange()).set(
			new Int32Array([this.isHiZ ? 1 : 0, this.maxIterations]),
		);
		this.settingsBuffer.unmap();
	}

	public override setCamera(camera: Camera): this {
		this.camera = camera;
		return this;
	}

	public override onResize(width: number, height: number): void {
		super.onResize(width, height);
		if (this.outTexture) {
			this.outTexture.destroy();
		}
		this.outTexture = RenderingContext.device.createTexture({
			label: "Reflection Texture",
			size: { width, height, depthOrArrayLayers: 1 },
			format: "rgba16float",
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
		});
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		if (!this.inputTextureViews.length) {
			this.inputTextureViews.push(inputs[0].createView());
			this.inputTextureViews.push(inputs[1].createView());
			this.inputTextureViews.push(inputs[2].createView());
			this.inputTextureViews.push(inputs[3].createView());

			const bindGroupEntries: GPUBindGroupEntry[] = [
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
					resource: this.inputTextureViews[2],
				},
				{
					binding: 3,
					resource: this.inputTextureViews[3],
				},
				{
					binding: 4,
					resource: this.outTexture.createView(),
				},
				{
					binding: 5,
					resource: {
						buffer: this.camera.gpuBuffer,
					},
				},
				{
					binding: 6,
					resource: {
						buffer: this.settingsBuffer,
					},
				},
			];

			this.bindGroup = RenderingContext.device.createBindGroup({
				label: "Compute Reflections Bind Group",
				entries: bindGroupEntries,
				layout: this.bindGroupLayout,
			});
		}

		const computeEncoder = commandEncoder.beginComputePass({
			label: "Reflection Compute Pass Encoder",
		});
		computeEncoder.pushDebugGroup("Begin Reflection Compute Pass");

		computeEncoder.setPipeline(this.computePSO);
		computeEncoder.setBindGroup(0, this.bindGroup);
		const workgroupCountX = Math.ceil(
			this.outTexture.width / ReflectionComputePass.COMPUTE_WORKGROUP_SIZE_X,
		);
		const workgroupCountY = Math.ceil(
			this.outTexture.height / ReflectionComputePass.COMPUTE_WORKGROUP_SIZE_Y,
		);
		computeEncoder.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1);

		computeEncoder.popDebugGroup();
		computeEncoder.end();

		return [this.outTexture];
	}
}
