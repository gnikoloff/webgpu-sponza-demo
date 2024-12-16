import { RENDER_TARGET_LOCATIONS } from "../renderer/core/RendererBindings";

export const MAIN_CAMERA_NEAR = 0.1;
export const MAIN_CAMERA_FAR = 100;
export const ORTHO_CAMERA_NEAR = 0.1;
export const ORTHO_CAMERA_FAR = 1;

export const GROUND_SIZE = 80;

export const RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE =
	"normal+metallic+roughness texture";
export const RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE =
	"albedo+reflectance texture";
export const RENDER_PASS_VELOCITY_TEXTURE = "velocity texture";
export const RENDER_PASS_DEPTH_STENCIL_TEXTURE = "depth texture";
export const RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE =
	"directional light depth texture";
export const RENDER_PASS_SSAO_TEXTURE = "ssao texture";
export const RENDER_PASS_SSAO_BLUR_TEXTURE = "ssao blur texture";
export const RENDER_PASS_LIGHTING_RESULT_TEXTURE = "lighting texture";
export const RENDER_PASS_TAA_RESOLVE_TEXTURE = "taa resolve texture";
export const RENDER_PASS_HI_Z_DEPTH_TEXTURE = "hi-z depth texture";
export const RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE =
	"computed reflections texture";
export const RENDER_PASS_BLOOM_TEXTURE = "bloom downscale texture";

export const GBUFFER_OUTPUT_TARGETS: GPUColorTargetState[] = new Array(3);

GBUFFER_OUTPUT_TARGETS[RENDER_TARGET_LOCATIONS.NormalMetallicRoughness] = {
	format: "rgba16float",
};

GBUFFER_OUTPUT_TARGETS[RENDER_TARGET_LOCATIONS.ColorReflectance] = {
	format: "bgra8unorm",
};

GBUFFER_OUTPUT_TARGETS[RENDER_TARGET_LOCATIONS.Velocity] = {
	format: "rg16float",
};
