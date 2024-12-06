import { GLTFMaterialPostprocessed } from "@loaders.gl/gltf";
import PipelineStates from "../../renderer/core/PipelineStates";
import Material from "../../renderer/material/Material";
import Renderer from "../Renderer";
import {
	DeferredRenderPBRShaderEntryFn,
	getDefaultDeferredPBRFragmentShader,
} from "../shaders/DeferredFragmentShaderSrc";
import {
	ForwardRenderPBRShaderEntryFn,
	getDefaultForwardPBRFragmentShader,
} from "../shaders/ForwardFragmentShaderSrc";
import {
	DefaultVertexShaderEntryFn,
	getVertexShader,
} from "../shaders/VertexShader";
import VertexDescriptor from "../../renderer/core/VertexDescriptor";

let _defaultDeferredPBRMaterial: Material;
let _defaultTexturedDeferredMaterial: Material;
let _defaultDeferredInstancedMaterial: Material;
let _defaultShadowMaterial: Material;
let _defaultInstancedShadowMaterial: Material;
let defaultTransparentPBRMaterial: Material;

export const GBUFFER_OUTPUT_TARGETS: GPUColorTargetState[] = [
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
	get defaultTransparentPBRMaterial(): Material {
		if (defaultTransparentPBRMaterial) {
			return defaultTransparentPBRMaterial;
		}
		defaultTransparentPBRMaterial = new Material({
			debugLabel: `Forward Pass Default PBR Material`,
			vertexShaderSrc: getVertexShader(),
			vertexShaderEntryFn: DefaultVertexShaderEntryFn,
			vertexBuffers: VertexDescriptor.defaultGLTFLayout,
			fragmentShaderSrc: getDefaultForwardPBRFragmentShader({
				hasPBRTextures: true,
			}),
			fragmentShaderEntryFn: ForwardRenderPBRShaderEntryFn,
			targets: [
				{
					format: "rgba16float",
					blend: {
						color: {
							srcFactor: "src-alpha",
							dstFactor: "one-minus-src-alpha",
							operation: "add",
						},
						alpha: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha",
							operation: "add",
						},
					},
				},
			],
			bindGroupLayouts: [
				PipelineStates.defaultCameraPlusLightsBindGroupLayout,
				PipelineStates.defaultModelBindGroupLayout,
				PipelineStates.defaultModelMaterialBindGroupLayout,
			],
			depthStencilState: {
				format: Renderer.depthStencilFormat,
				depthWriteEnabled: true,
				depthCompare: "less",
			},
			primitive: {
				cullMode: "none",
			},
		});
		return defaultTransparentPBRMaterial;
	},

	get defaultDeferredPBRMaterial(): Material {
		if (_defaultDeferredPBRMaterial) {
			return _defaultDeferredPBRMaterial;
		}
		const stencilDescriptor: GPUStencilFaceState = {
			compare: "always",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "replace",
		};
		_defaultDeferredPBRMaterial = new Material({
			debugLabel: "Deferred Pass Default PBR Material",
			vertexShaderSrc: getVertexShader(),
			vertexShaderEntryFn: DefaultVertexShaderEntryFn,
			vertexBuffers: VertexDescriptor.defaultGLTFLayout,
			fragmentShaderSrc: getDefaultDeferredPBRFragmentShader(),
			fragmentShaderEntryFn: DeferredRenderPBRShaderEntryFn,
			constants: {
				// HAS_ALBEDO_TEXTURE: 0,
				// HAS_NORMAL_TEXTURE: 0,
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
		return _defaultDeferredPBRMaterial;
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
			debugLabel: "Default Textured Deferred PBR",
			vertexShaderSrc: getVertexShader(),
			vertexShaderEntryFn: DefaultVertexShaderEntryFn,
			vertexBuffers: VertexDescriptor.defaultGLTFLayout,
			fragmentShaderSrc: getDefaultDeferredPBRFragmentShader({
				hasPBRTextures: true,
			}),
			fragmentShaderEntryFn: DeferredRenderPBRShaderEntryFn,
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
			vertexShaderEntryFn: DefaultVertexShaderEntryFn,
			fragmentShaderSrc: getDefaultDeferredPBRFragmentShader(),
			fragmentShaderEntryFn: DeferredRenderPBRShaderEntryFn,
			bindGroupLayouts: [
				PipelineStates.defaultCameraBindGroupLayout,
				PipelineStates.defaultModelBindGroupLayout,
				PipelineStates.instancesBindGroupLayout,
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
			vertexShaderEntryFn: DefaultVertexShaderEntryFn,
			// primitive: {
			// 	cullMode: "back",
			// },
		});

		return _defaultShadowMaterial;
	},

	get defaultInstancedShadowMaterial(): Material {
		if (_defaultInstancedShadowMaterial) {
			return _defaultInstancedShadowMaterial;
		}
		_defaultInstancedShadowMaterial = new Material({
			debugLabel: "Default Shadow Material",
			vertexShaderSrc: getVertexShader({ isInstanced: true }),
			vertexShaderEntryFn: DefaultVertexShaderEntryFn,
			bindGroupLayouts: [
				PipelineStates.defaultCameraBindGroupLayout,
				PipelineStates.defaultModelBindGroupLayout,
				PipelineStates.defaultModelMaterialBindGroupLayout,
				PipelineStates.instancesBindGroupLayout,
			],
			// primitive: {
			// 	cullMode: "back",
			// },
		});

		return _defaultInstancedShadowMaterial;
	},
});

export default MaterialCache;
