import Renderer from "../../app/Renderer";
import { PBR_TEXTURES_LOCATIONS, SAMPLER_LOCATIONS } from "./RendererBindings";

let _cameraBindGroupLayout: GPUBindGroupLayout;
let _modelBindGroupLayout: GPUBindGroupLayout;
let _modelTexturesBindGroupLayout: GPUBindGroupLayout;
let _modelSamplersBindGroupLayout: GPUBindGroupLayout;
let _instanceMatricesBindGroupLayout: GPUBindGroupLayout;

const cachedShaderModules: Map<string, GPUShaderModule> = new Map([]);
const cachedRenderPSOs: Map<string, GPURenderPipeline> = new Map([]);

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

	get defaultSamplersBindGroupLayout(): GPUBindGroupLayout {
		if (_modelSamplersBindGroupLayout) {
			return _modelSamplersBindGroupLayout;
		}
		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: SAMPLER_LOCATIONS.Default,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {},
			},
		];
		_modelSamplersBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Model Samplers GPUBindGroupLayout",
			entries: bindGroupLayoutEntries,
		});
		return _modelSamplersBindGroupLayout;
	},

	get defaultModelMaterialBindGroupLayout(): GPUBindGroupLayout {
		if (_modelTexturesBindGroupLayout) {
			return _modelTexturesBindGroupLayout;
		}
		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: PBR_TEXTURES_LOCATIONS.Albedo,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: "float",
				},
			},
			{
				binding: PBR_TEXTURES_LOCATIONS.Normal,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: "float",
				},
			},
			{
				binding: PBR_TEXTURES_LOCATIONS.MetallicRoughness,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: "float",
				},
			},
		];
		_modelTexturesBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Model Textures GPUBindGroupLayout",
			entries: bindGroupLayoutEntries,
		});
		return _modelTexturesBindGroupLayout;
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

	createShaderModule: (
		shaderModuleSrc: string,
		debugLabel = `Shader Module #${cachedShaderModules.size}`,
	): GPUShaderModule => {
		let shaderModule: GPUShaderModule;
		if ((shaderModule = cachedShaderModules.get(shaderModuleSrc))) {
			return shaderModule;
		}
		shaderModule = Renderer.device.createShaderModule({
			label: debugLabel,
			code: shaderModuleSrc,
		});
		cachedShaderModules.set(shaderModuleSrc, shaderModule);
		return shaderModule;
	},

	createRenderPipeline: (
		descriptor: GPURenderPipelineDescriptor,
	): GPURenderPipeline => {
		// const key = JSON.stringify(descriptor);
		let renderPSO: GPURenderPipeline;
		// if ((renderPSO = cachedRenderPSOs.get(key))) {
		// 	return renderPSO;
		// }
		renderPSO = Renderer.device.createRenderPipeline(descriptor);

		// cachedRenderPSOs.set(key, renderPSO);

		return renderPSO;
	},

	createComputePipeline: (
		descriptor: GPUComputePipelineDescriptor,
	): GPUComputePipeline => {
		const pipeline = Renderer.device.createComputePipeline(descriptor);
		return pipeline;
	},
};
export default PipelineStates;
