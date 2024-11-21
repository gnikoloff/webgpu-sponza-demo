import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import Renderer from "../Renderer";
import {
	REFLECTION_PASS_FRAGMENT_SHADER_ENTRY_NAME,
	getReflectionComputeShader,
} from "../shaders/ReflectionShader";

export default class ReflectionComputePass extends RenderPass {
	private static readonly COMPUTE_WORKGROUP_SIZE_X = 16;
	private static readonly COMPUTE_WORKGROUP_SIZE_Y = 16;

	private computePSO: GPUComputePipeline;
	private settingsGpuBuffer: GPUBuffer;
	private computePSOBindGroupLayout: GPUBindGroupLayout;

	constructor(public texture: GPUTexture) {
		super();
		this.settingsGpuBuffer = Renderer.device.createBuffer({
			label: "Reflection Pass Settings GPUBuffer",
			size: 4 * Uint32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				texture: {},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				storageTexture: {
					access: "write-only",
					format: Renderer.pixelFormat,
					viewDimension: "2d",
				},
			},
			{
				binding: 2,
				visibility: GPUShaderStage.COMPUTE,
				buffer: {
					type: "read-only-storage",
				},
			},
		];
		this.computePSOBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Reflection Pass ComputePSO Bind Group Layout",
			entries: bindGroupLayoutEntries,
		});
		this.computePSO = PipelineStates.createComputePipeline({
			label: "Reflection Pass Compute PSO",
			layout: Renderer.device.createPipelineLayout({
				label: "Reflection PASS ComputePSO Layout",
				bindGroupLayouts: [this.computePSOBindGroupLayout],
			}),
			compute: {
				entryPoint: REFLECTION_PASS_FRAGMENT_SHADER_ENTRY_NAME,
				module: PipelineStates.createShaderModule(
					getReflectionComputeShader(Renderer.pixelFormat),
				),
				constants: {
					WORKGROUP_SIZE_X: ReflectionComputePass.COMPUTE_WORKGROUP_SIZE_X,
					WORKGROUP_SIZE_Y: ReflectionComputePass.COMPUTE_WORKGROUP_SIZE_X,
				},
			},
		});
	}

	public resize(w: number, h: number) {
		Renderer.device.queue.writeBuffer(
			this.settingsGpuBuffer,
			0,
			new Uint32Array([w, h]),
		);
	}

	public computeReflections(
		commandEncoder: GPUCommandEncoder,
		outTextureView: GPUTextureView,
	) {
		const bindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: this.texture.createView(),
			},
			{
				binding: 1,
				resource: outTextureView,
			},
			{
				binding: 2,
				resource: {
					label: "Settings GPU Buffer Bind Group Entry",
					buffer: this.settingsGpuBuffer,
				},
			},
		];
		const texturesBindGroup = Renderer.device.createBindGroup({
			label: "Textures Bind Group",
			layout: this.computePSOBindGroupLayout,
			entries: bindGroupEntries,
		});

		const computeEncoder = commandEncoder.beginComputePass();
		computeEncoder.setPipeline(this.computePSO);
		computeEncoder.setBindGroup(0, texturesBindGroup);
		computeEncoder.dispatchWorkgroups(
			Math.ceil(
				this.texture.width / ReflectionComputePass.COMPUTE_WORKGROUP_SIZE_X,
			),
			Math.ceil(
				this.texture.width / ReflectionComputePass.COMPUTE_WORKGROUP_SIZE_Y,
			),
			1,
		);
		computeEncoder.end();
	}
}
