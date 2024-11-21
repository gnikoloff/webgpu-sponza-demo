import Renderer from "../../app/Renderer";

let _cameraBindGroupLayout: GPUBindGroupLayout;
let _modelBindGroupLayout: GPUBindGroupLayout;
let _instanceMatricesBindGroupLayout: GPUBindGroupLayout;

const PipelineStates = {
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

	get instanceMatricesBindGroupLayout(): GPUBindGroupLayout {
		if (_instanceMatricesBindGroupLayout) {
			return _instanceMatricesBindGroupLayout;
		}
		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX,
				buffer: {
					type: "read-only-storage",
				},
			},
		];
		_instanceMatricesBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Instance Models GPUBindGroupLayout",
			entries: bindGroupLayoutEntries,
		});
		return _instanceMatricesBindGroupLayout;
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

	createComputePipeline: (
		descriptor: GPUComputePipelineDescriptor,
	): GPUComputePipeline => {
		const pipeline = Renderer.device.createComputePipeline(descriptor);
		return pipeline;
	},
};
export default PipelineStates;
