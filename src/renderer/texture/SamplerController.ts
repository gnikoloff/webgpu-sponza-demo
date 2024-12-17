import { GLTFSamplerPostprocessed } from "@loaders.gl/gltf/dist/lib/types/gltf-postprocessed-schema";
import BaseUtilObject from "../core/BaseUtilObject";
import RenderingContext from "../core/RenderingContext";

let _defaultNearestSampler: GPUSampler;
let _defaultSampler: GPUSampler;

const _cachedSamplers: Map<string, GPUSampler> = new Map();

const GL = WebGLRenderingContext;

export default class SamplerController extends BaseUtilObject {
	public static get defaultNearestSampler(): GPUSampler {
		if (_defaultNearestSampler) {
			return _defaultNearestSampler;
		}
		_defaultNearestSampler = this.createSampler({
			minFilter: "nearest",
			magFilter: "nearest",
		});
		return _defaultNearestSampler;
	}

	public static get defaultSampler(): GPUSampler {
		if (_defaultSampler) {
			return _defaultSampler;
		}
		_defaultSampler = this.createSampler({
			minFilter: "linear",
			magFilter: "linear",
			mipmapFilter: "linear",
			maxAnisotropy: 4,
		});
		return _defaultSampler;
	}

	public static createSampler(samplerInfo: GPUSamplerDescriptor): GPUSampler {
		const samplerInfoNoLabel = structuredClone(samplerInfo);
		if (samplerInfoNoLabel.label) {
			delete samplerInfoNoLabel.label;
		}
		const key = JSON.stringify(samplerInfoNoLabel);
		let sampler: GPUSampler;
		if ((sampler = _cachedSamplers.get(key))) {
			return sampler;
		}
		sampler = RenderingContext.device.createSampler(samplerInfo);
		_cachedSamplers.set(key, sampler);
		return sampler;
	}

	public static getSamplerFromGltfSamplerDef(
		samplerInfo: GLTFSamplerPostprocessed,
	) {
		function wrapToAddressMode(wrap: number): GPUAddressMode {
			switch (wrap) {
				case GL.CLAMP_TO_EDGE:
					return "clamp-to-edge";
				case GL.MIRRORED_REPEAT:
					return "mirror-repeat";
				default:
					return "repeat";
			}
		}

		const descriptor: GPUSamplerDescriptor = {
			addressModeU: wrapToAddressMode(samplerInfo.wrapS),
			addressModeV: wrapToAddressMode(samplerInfo.wrapT),
		};

		if (!samplerInfo.magFilter || samplerInfo.magFilter == GL.LINEAR) {
			descriptor.magFilter = "linear";
		}

		switch (samplerInfo.minFilter) {
			case GL.LINEAR:
			case GL.LINEAR_MIPMAP_NEAREST:
				descriptor.minFilter = "linear";
				break;
			case GL.NEAREST_MIPMAP_LINEAR:
				descriptor.mipmapFilter = "linear";
				break;
			case GL.LINEAR_MIPMAP_LINEAR:
			default:
				descriptor.minFilter = "linear";
				descriptor.mipmapFilter = "linear";
				break;
		}
		descriptor.maxAnisotropy = 16;

		return this.createSampler(descriptor);
	}
}
