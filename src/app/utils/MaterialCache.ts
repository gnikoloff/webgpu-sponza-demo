import PipelineStates from "../../renderer/core/PipelineStates";
import Material from "../../renderer/material/Material";
import Renderer from "../Renderer";
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
let _defaultShadowMaterial: Material;

const MaterialCache = {
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
};

export default MaterialCache;
