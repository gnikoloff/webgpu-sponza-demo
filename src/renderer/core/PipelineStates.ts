import Renderer from "../../app/Renderer";
import { PBR_TEXTURES_LOCATIONS, SAMPLER_LOCATIONS } from "./RendererBindings";

let _cameraBindGroupLayout: GPUBindGroupLayout;
let _cameraPlusLightsBindGroupLayout: GPUBindGroupLayout;
let _modelBindGroupLayout: GPUBindGroupLayout;
let _defaultModelMaterialBindGroupLayout: GPUBindGroupLayout;
let _instanceBindGroupLayout: GPUBindGroupLayout;

const cachedShaderModules: Map<string, GPUShaderModule> = new Map([]);
const cachedRenderPSOs: Map<string, GPURenderPipeline> = new Map([]);

const PipelineStates = {
	get defaultCameraPlusLightsBindGroupLayout(): GPUBindGroupLayout {
		if (_cameraPlusLightsBindGroupLayout) {
			return _cameraPlusLightsBindGroupLayout;
		}

		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "read-only-storage",
				},
			},
		];

		_cameraPlusLightsBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Camera + Lights GPUBindGroupLayout",
			entries: bindGroupLayoutEntries,
		});

		return _cameraPlusLightsBindGroupLayout;
	},

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

	get defaultModelMaterialBindGroupLayout(): GPUBindGroupLayout {
		if (_defaultModelMaterialBindGroupLayout) {
			return _defaultModelMaterialBindGroupLayout;
		}
		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: SAMPLER_LOCATIONS.Default,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {},
			},
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
		_defaultModelMaterialBindGroupLayout =
			Renderer.device.createBindGroupLayout({
				label: "Model Textures GPUBindGroupLayout",
				entries: bindGroupLayoutEntries,
			});
		return _defaultModelMaterialBindGroupLayout;
	},

	get instancesBindGroupLayout(): GPUBindGroupLayout {
		if (_instanceBindGroupLayout) {
			return _instanceBindGroupLayout;
		}
		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "read-only-storage",
				},
			},
		];
		_instanceBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Instance Models GPUBindGroupLayout",
			entries: bindGroupLayoutEntries,
		});
		return _instanceBindGroupLayout;
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
