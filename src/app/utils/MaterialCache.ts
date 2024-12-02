import PipelineStates from "../../renderer/core/PipelineStates";
import Material from "../../renderer/material/Material";
import Renderer from "../Renderer";
import EnvironmentProbeShader, {
	EnvironmentProbeShaderEntryFn,
} from "../shaders/EnvironmentProbeShader";
import {
	FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN,
	getDefaultPBRFragmentShader,
} from "../shaders/FragmentShader";
import SkyboxShader, {
	SkyboxShaderFragmentEntryFn,
	SkyboxShaderVertexEntryFn,
} from "../shaders/SkyboxShader";
import {
	VERTEX_SHADER_DEFAULT_ENTRY_FN,
	getVertexShader,
} from "../shaders/VertexShader";

let _defaultDeferredMaterial: Material;
let _defaultTexturedDeferredMaterial: Material;
let _defaultDeferredInstancedMaterial: Material;
let _defaultShadowMaterial: Material;
let _defaultEnvironmentProbeMaterial: Material;

const GBUFFER_OUTPUT_TARGETS: GPUColorTargetState[] = [
	{
		format: "rgba16float",
	},
	{
		format: "bgra8unorm",
	},
	{
		format: "rg16float",
	},
];

const MaterialCache = Object.freeze({
	get environmentProbeMaterial(): Material {
		if (_defaultEnvironmentProbeMaterial) {
			return _defaultEnvironmentProbeMaterial;
		}
		// _defaultEnvironmentProbeMaterial = new Material({
		//   debugLabel: "Environment Probe Pass Default Material",
		//   vertexShaderSrc: EnvironmentProbeShader,
		//   vertexShaderEntryFn: EnvironmentProbeShaderEntryFn,
		//   fragmentShaderEntryFn
		// });

		return _defaultEnvironmentProbeMaterial;
	},

	get defaultDeferredMaterial(): Material {
		if (_defaultDeferredMaterial) {
			return _defaultDeferredMaterial;
		}
		const stencilDescriptor: GPUStencilFaceState = {
			compare: "always",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "replace",
		};
		_defaultDeferredMaterial = new Material({
			debugLabel: "Deferred Pass Default Material",
			vertexShaderSrc: getVertexShader(),
			vertexShaderEntryFn: VERTEX_SHADER_DEFAULT_ENTRY_FN,
			fragmentShaderSrc: getDefaultPBRFragmentShader(),
			fragmentShaderEntryFn: FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN,
			constants: {
				// HAS_ALBEDO_TEXTURE: 0,
				// HAS_NORMAL_TEXTURE: 0,
			},
			targets: GBUFFER_OUTPUT_TARGETS,
			primitive: {
				cullMode: "none",
			},
			depthStencilState: {
				format: Renderer.depthStencilFormat,
				depthWriteEnabled: true,
				depthCompare: "less",
				stencilReadMask: 0x0,
				stencilWriteMask: 0xff,
				stencilBack: stencilDescriptor,
				stencilFront: stencilDescriptor,
			},
		});
		return _defaultDeferredMaterial;
	},

	get defaultTexturedDeferredMaterial(): Material {
		if (_defaultTexturedDeferredMaterial) {
			return _defaultTexturedDeferredMaterial;
		}
		const stencilDescriptor: GPUStencilFaceState = {
			compare: "always",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "replace",
		};
		_defaultTexturedDeferredMaterial = new Material({
			debugLabel: "Material",
			vertexShaderSrc: getVertexShader(),
			vertexShaderEntryFn: VERTEX_SHADER_DEFAULT_ENTRY_FN,
			fragmentShaderSrc: getDefaultPBRFragmentShader(true),
			fragmentShaderEntryFn: FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN,
			constants: {
				// HAS_ALBEDO_TEXTURE: 1,
				// HAS_NORMAL_TEXTURE: 1,
			},
			targets: GBUFFER_OUTPUT_TARGETS,
			depthStencilState: {
				format: Renderer.depthStencilFormat,
				depthWriteEnabled: true,
				depthCompare: "less",
				stencilReadMask: 0x0,
				stencilWriteMask: 0xff,
				stencilBack: stencilDescriptor,
				stencilFront: stencilDescriptor,
			},
		});
		return _defaultTexturedDeferredMaterial;
	},

	get defaultDeferredInstancedMaterial(): Material {
		if (_defaultDeferredInstancedMaterial) {
			return _defaultDeferredInstancedMaterial;
		}
		_defaultDeferredInstancedMaterial = new Material({
			debugLabel: "Material",
			vertexShaderSrc: getVertexShader({ isInstanced: true }),
			vertexShaderEntryFn: VERTEX_SHADER_DEFAULT_ENTRY_FN,
			fragmentShaderSrc: getDefaultPBRFragmentShader(),
			fragmentShaderEntryFn: FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN,
			bindGroupLayouts: [
				PipelineStates.defaultCameraBindGroupLayout,
				PipelineStates.defaultModelBindGroupLayout,
				PipelineStates.instanceMatricesBindGroupLayout,
			],
			targets: GBUFFER_OUTPUT_TARGETS,
		});
		return _defaultDeferredInstancedMaterial;
	},

	get defaultShadowMaterial(): Material {
		if (_defaultShadowMaterial) {
			return _defaultShadowMaterial;
		}
		_defaultShadowMaterial = new Material({
			debugLabel: "Default Shadow Material",
			vertexShaderSrc: getVertexShader(),
			vertexShaderEntryFn: VERTEX_SHADER_DEFAULT_ENTRY_FN,
			// primitive: {
			// 	cullMode: "back",
			// },
		});

		return _defaultShadowMaterial;
	},
});

export default MaterialCache;
