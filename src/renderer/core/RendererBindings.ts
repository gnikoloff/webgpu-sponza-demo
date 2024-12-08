import {
	BindGroupLocation,
	SamplerLocation,
	ShaderAttribLocation,
	TextureLocation,
} from "../types";

export const SHADER_ATTRIB_LOCATIONS = Object.freeze({
	get Position(): ShaderAttribLocation {
		return 0;
	},
	get Normal(): ShaderAttribLocation {
		return 1;
	},
	get TexCoord(): ShaderAttribLocation {
		return 2;
	},
	get Tangent(): ShaderAttribLocation {
		return 3;
	},
});

export const BIND_GROUP_LOCATIONS = Object.freeze({
	get CameraPlusOptionalLights(): BindGroupLocation {
		return 0;
	},
	get Model(): BindGroupLocation {
		return 1;
	},
	get PBRTextures(): BindGroupLocation {
		return 2;
	},
	get InstanceInputs(): BindGroupLocation {
		return 3;
	},
});

export type RenderTargetLocation = 0 | 1 | 2;

export const RENDER_TARGET_LOCATIONS = Object.freeze({
	get NormalMetallicRoughness(): RenderTargetLocation {
		return 0;
	},
	get ColorReflectance(): RenderTargetLocation {
		return 1;
	},
	get Velocity(): RenderTargetLocation {
		return 2;
	},
});

export const SAMPLER_LOCATIONS = Object.freeze({
	get Default(): SamplerLocation {
		return 0;
	},
});

export const PBR_TEXTURES_LOCATIONS = Object.freeze({
	get Albedo(): TextureLocation {
		return 1;
	},
	get Normal(): TextureLocation {
		return 2;
	},
	get MetallicRoughness(): TextureLocation {
		return 3;
	},
	get AO(): TextureLocation {
		return 4;
	},
});
