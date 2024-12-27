import { Vec3, vec3 } from 'wgpu-matrix'
import envNxImgUrl from '../assets/textures/nx.hdr?url'
import envNyImgUrl from '../assets/textures/ny.hdr?url'
import envNzImgUrl from '../assets/textures/nz.hdr?url'
import envPxImgUrl from '../assets/textures/px.hdr?url'
import envPyImgUrl from '../assets/textures/py.hdr?url'
import envPzImgUrl from '../assets/textures/pz.hdr?url'
import { RENDER_TARGET_LOCATIONS } from '../renderer/core/RendererBindings'
import { EaseType } from '../renderer/types'

export enum BlitRenderMode {
  Final,
  Albedo,
  ViewSpaceNormal,
  Metallic,
  Roughness,
  SSAO,
  Depth,
  Reflectance,
}

export const MAIN_CAMERA_NEAR = 0.1
export const MAIN_CAMERA_FAR = 100
export const ORTHO_CAMERA_NEAR = 0.1
export const ORTHO_CAMERA_FAR = 1

export const GROUND_SIZE = 80

export const RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE =
  'normal+metallic+roughness texture'
export const RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE =
  'albedo+reflectance texture'
export const RENDER_PASS_VELOCITY_TEXTURE = 'velocity texture'
export const RENDER_PASS_DEPTH_STENCIL_TEXTURE = 'depth texture'
export const RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE =
  'directional light depth texture'
export const RENDER_PASS_DIRECTIONAL_LIGHT_VARIANCE_DEPTH_TEXTURE =
  'directional light variance texture'
export const RENDER_PASS_DIRECTIONAL_LIGHT_VARIANCE_BLURRED_DEPTH_TEXTURE =
  'directional light blurred variance texture'
export const RENDER_PASS_SSAO_TEXTURE = 'ssao texture'
export const RENDER_PASS_SSAO_BLUR_TEXTURE = 'ssao blur texture'
export const RENDER_PASS_LIGHTING_RESULT_TEXTURE = 'lighting texture'
export const RENDER_PASS_TAA_RESOLVE_TEXTURE = 'taa resolve texture'
export const RENDER_PASS_HI_Z_DEPTH_TEXTURE = 'hi-z depth texture'
export const RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE =
  'computed reflections texture'
export const RENDER_PASS_BLOOM_TEXTURE = 'bloom downscale texture'
export const RENDER_PASS_COMBINE_TEXTURE = 'combine texture'

export const GBUFFER_OUTPUT_TARGETS: GPUColorTargetState[] = new Array(3)

GBUFFER_OUTPUT_TARGETS[RENDER_TARGET_LOCATIONS.NormalMetallicRoughness] = {
  format: 'rgba16float',
}

GBUFFER_OUTPUT_TARGETS[RENDER_TARGET_LOCATIONS.ColorReflectance] = {
  format: 'bgra8unorm',
}

GBUFFER_OUTPUT_TARGETS[RENDER_TARGET_LOCATIONS.Velocity] = {
  format: 'rg16float',
}

export const ENVIRONMENT_CUBE_TEXTURE_FACE_URLS: string[] = [
  envNxImgUrl,
  envNyImgUrl,
  envNzImgUrl,
  envPxImgUrl,
  envPyImgUrl,
  envPzImgUrl,
]

export const SECOND_FLOOR_PARTICLES_CATMULL_CURVE_POINT_POSITIONS: Vec3[] = [
  vec3.create(5.5, 7.5, 3.25),
  vec3.create(4, 6.5, 0.5),
  vec3.create(2.5, 6.5, 3.25),
  vec3.create(1, 7.5, 0.5),
  vec3.create(-0.5, 7.5, 3.25),
  vec3.create(-2, 6.5, 0.5),
  vec3.create(-3.5, 6.5, 3.25),
  vec3.create(-5, 7.5, 0.5),
  vec3.create(-6.5, 7.5, 3.25),
  vec3.create(-7.75, 6.5, 0.5),
  vec3.create(-10.5, 7.5, -0.125),
  vec3.create(-7.75, 7.5, -1),
  vec3.create(-6.5, 6.5, -4),
  vec3.create(-5, 6.5, -1),
  vec3.create(-3.5, 7.5, -4),
  vec3.create(-2, 7.5, -1),
  vec3.create(-0.5, 6.5, -4),
  vec3.create(1, 6.5, -1),
  vec3.create(2.5, 7.5, -4),
  vec3.create(4, 7.5, -1),
  vec3.create(5.5, 6.5, -4),
  vec3.create(6.5, 6.5, -1),
  vec3.create(9, 6.5, -1),
  vec3.create(9.5, 7.5, -0.125),
  vec3.create(9, 6.5, 0.7),
  vec3.create(6, 6.5, 1),
  vec3.create(6, 7.5, 3.25),
]

// Loading animation
export const SUN_LOAD_START_INTENSITY = 0
export const SUN_LOAD_END_INTENSITY = 1
export const SUN_LOAD_START_POSITION = vec3.create(3, 20, 3)
export const SUN_LOAD_END_POSITION = vec3.create(0.1, 20, 0.1)
export const SUN_LOAD_ANIM_DURATION_MS = 1500
export const SUN_LOAD_ANIM_DELAY_MS = 100
export const SUN_LOAD_ANIM_EASE: EaseType = 'exp_Out'
export const BLIT_PASS_REVEAL_ANIM_DURATION_MS = 800
export const MAIN_CAMERA_START_LOAD_START_POSITION = vec3.create(
  9.7,
  3.4,
  -0.35
)
export const MAIN_CAMERA_START_LOAD_END_POSITION = vec3.create(9.3, 3.4, -0.35)
export const MAIN_CAMERA_LOAD_ANIM_DURATION_MS = 1800
export const MAIN_CAMERA_LOAD_ANIM_EASE: EaseType = 'quad_Out'
export const FIREWORK_PARTICLES_LOAD_ANIM_DELAY_MS = 1000
export const FIREWORK_PARTICLES_LOAD_ANIM_DURATION_MS = 500
export const FIREWORK_PARTICLES_LOAD_ANIM_EASE: EaseType = 'quad_Out'

export const TIME_TO_MEASURE_PERFORMANCE_IN_SECONDS = 1.5
