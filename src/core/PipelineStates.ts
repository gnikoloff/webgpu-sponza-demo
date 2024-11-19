import { Renderer } from "../Renderer";
import { BIND_GROUP_LOCATIONS } from "../constants";

let _cameraBindGroupLayout: GPUBindGroupLayout;
let _modelBindGroupLayout: GPUBindGroupLayout;

export const PipelineStates = {
	get defaultCameraBindGroupLayout(): GPUBindGroupLayout {
		if (_cameraBindGroupLayout) {
			return _cameraBindGroupLayout;
		}

		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {},
			},
		];

		_cameraBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Camera GPUBindGroupLayout",
			entries: bindGroupLayoutEntries,
		});

		return _cameraBindGroupLayout;
	},

	get defaultModelBindGroupLayout(): GPUBindGroupLayout {
		if (_modelBindGroupLayout) {
			return _modelBindGroupLayout;
		}

		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {},
			},
		];
		_modelBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Model GPUBindGroupLayout",
			entries: bindGroupLayoutEntries,
		});
		return _modelBindGroupLayout;
	},

	createShaderModule: (shaderModuleSrc: string): GPUShaderModule => {
		const shaderModule = Renderer.device.createShaderModule({
			code: shaderModuleSrc,
		});
		return shaderModule;
	},

	createRenderPipeline: (
		descriptor: GPURenderPipelineDescriptor,
	): GPURenderPipeline => {
		const pipeline = Renderer.device.createRenderPipeline(descriptor);
		return pipeline;
	},
};
