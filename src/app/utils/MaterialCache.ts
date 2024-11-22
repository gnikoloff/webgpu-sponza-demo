import PipelineStates from "../../renderer/core/PipelineStates";
import Material from "../../renderer/material/Material";
import {
	DEBUG_FRAGMENT_SHADER_SRC,
	FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN,
} from "../shaders/FragmentShader";
import {
	VERTEX_SHADER_DEFAULT_ENTRY_FN,
	getVertexShader,
} from "../shaders/VertexShader";

let _defaultDeferredMaterial: Material;
let _defaultDeferredInstancedMaterial: Material;

const MaterialCache = {
	get defaultDeferredMaterial(): Material {
		if (_defaultDeferredMaterial) {
			return _defaultDeferredMaterial;
		}
		_defaultDeferredMaterial = new Material({
			debugLabel: "Material",
			vertexShaderSrc: getVertexShader(),
			vertexShaderEntryFn: VERTEX_SHADER_DEFAULT_ENTRY_FN,
			fragmentShaderSrc: DEBUG_FRAGMENT_SHADER_SRC,
			fragmentShaderEntryFn: FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN,
			targets: [
				{
					format: "rgba16float",
				},
				{
					format: "bgra8unorm",
				},
				{
					format: "rg16float",
				},
			],
		});
		return _defaultDeferredMaterial;
	},

	get defaultDeferredInstancedMaterial(): Material {
		if (_defaultDeferredInstancedMaterial) {
			return _defaultDeferredInstancedMaterial;
		}
		_defaultDeferredInstancedMaterial = new Material({
			debugLabel: "Material",
			vertexShaderSrc: getVertexShader({ isInstanced: true }),
			vertexShaderEntryFn: VERTEX_SHADER_DEFAULT_ENTRY_FN,
			fragmentShaderSrc: DEBUG_FRAGMENT_SHADER_SRC,
			fragmentShaderEntryFn: FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN,
			bindGroupLayouts: [
				PipelineStates.defaultCameraBindGroupLayout,
				PipelineStates.defaultModelBindGroupLayout,
				PipelineStates.instanceMatricesBindGroupLayout,
			],
			targets: [
				{
					format: "rgba16float",
				},
				{
					format: "bgra8unorm",
				},
				{
					format: "rg16float",
				},
			],
		});
		return _defaultDeferredInstancedMaterial;
	},
};

export default MaterialCache;
