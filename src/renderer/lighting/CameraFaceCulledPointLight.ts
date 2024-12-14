import RenderingContext from "../core/RenderingContext";
import Light from "./Light";
import PointLight from "./PointLight";
import { SHADER_POINT_LIGHT_TYPE } from "../constants";
import { vec3 } from "wgpu-matrix";
import VRAMUsageTracker from "../misc/VRAMUsageTracker";

export default class CameraFaceCulledPointLight extends PointLight {
	private static _bindGroupLayout: GPUBindGroupLayout;
	public static get bindGroupLayout(): GPUBindGroupLayout {
		if (this._bindGroupLayout) {
			return this._bindGroupLayout;
		}
		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {},
			},
		];
		this._bindGroupLayout = RenderingContext.device.createBindGroupLayout({
			label: "Camera Face Culled Point Light Bind Group Layout",
			entries: bindGroupLayoutEntries,
		});
		return this._bindGroupLayout;
	}

	private gpuBuffer: GPUBuffer;
	public bindGroup: GPUBindGroup;

	public updateGPUBuffer() {
		RenderingContext.device.queue.writeBuffer(
			this.gpuBuffer,
			0,
			this.lightsStorageView.arrayBuffer,
		);
	}

	constructor() {
		super();

		this.gpuBuffer = RenderingContext.device.createBuffer({
			label: `Camera Face Culled Point Light GPU Buffer`,
			size: Light.STRUCT_BYTE_SIZE,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		VRAMUsageTracker.addBufferBytes(this.gpuBuffer);

		this.lightsStorageView.set({
			type: SHADER_POINT_LIGHT_TYPE,
			intensity: 1,
			radius: 1,
			color: vec3.create(1, 1, 1),
			position: vec3.create(0, 1, 0),
		});

		// TODO: this is better handled via mapping the gpuBuffer at initialisation
		this.updateGPUBuffer();

		const bindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: {
					buffer: this.gpuBuffer,
				},
			},
		];
		this.bindGroup = RenderingContext.device.createBindGroup({
			label: "Camera Face Culled Point Light Bind Group",
			entries: bindGroupEntries,
			layout: CameraFaceCulledPointLight.bindGroupLayout,
		});
	}
}
