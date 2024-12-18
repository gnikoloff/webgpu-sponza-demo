import { DebugStatType, LightType, RenderPassType } from './types'

export const SHADER_DIRECTIONAL_LIGHT_TYPE = 0
export const SHADER_POINT_LIGHT_TYPE = 1
export const SHADER_AMBIENT_LIGHT_TYPE = 2

export const LightTypeToShaderType: Map<LightType, number> = new Map([
  [LightType.Directional, SHADER_DIRECTIONAL_LIGHT_TYPE],
  [LightType.Point, SHADER_POINT_LIGHT_TYPE],
  [LightType.Ambient, SHADER_AMBIENT_LIGHT_TYPE],
])

export const AllRenderPassTypes: RenderPassType[] = [
  RenderPassType.Deferred,
  RenderPassType.DirectionalAmbientLighting,
  RenderPassType.SSAO,
  RenderPassType.Transparent,
  RenderPassType.Shadow,
  RenderPassType.TAAResolve,
  RenderPassType.Reflection,
  RenderPassType.Blit,
]

export const AllDebugStatTypes: DebugStatType[] = [
  DebugStatType.CPUTotal,
  DebugStatType.GPUTotal,
  DebugStatType.FPS,
  DebugStatType.VRAM,
  DebugStatType.VisibleMeshes,
  DebugStatType.LightsCount,
  // DebugStatType.DeferredRenderPass,
  // DebugStatType.SSAORenderPass,
  // DebugStatType.DirectionalAmbientLightingRenderPass,
  // DebugStatType.PointLightsStencilMask,
  // DebugStatType.PointLightsLighting,
  // DebugStatType.TransparentRenderPass,
  // DebugStatType.ShadowRenderPass,
  // DebugStatType.TAAResolveRenderPass,
  // DebugStatType.ReflectionRenderPass,
  // DebugStatType.BlitRenderPass,
]

export const RenderPassNames: Map<RenderPassType, string> = new Map([
  [RenderPassType.Deferred, 'G-Buffer Render Pass'],
  [
    RenderPassType.DirectionalAmbientLighting,
    'Directional + Ambient Render Pass',
  ],
  [RenderPassType.PointLightsStencilMask, 'Point Lights Stencil Mask Pass'],
  [RenderPassType.PointLightsLighting, 'Point Lights LightingSystem'],
  [RenderPassType.SSAO, 'SSAO Render Pass'],
  [RenderPassType.SSAOBlur, 'SSAO Blur Render Pass'],
  [RenderPassType.Skybox, 'Skybox Render Pass'],
  [RenderPassType.Transparent, 'Transparent Render Pass'],
  [RenderPassType.Shadow, 'Shadow Render Pass'],
  [RenderPassType.EnvironmentCube, 'Environment Cube Pass'],
  [RenderPassType.TAAResolve, 'TAA Resolve Render Pass'],
  [RenderPassType.CopyDepthForHiZ, 'Copy Depth for Hi-Z Render Pass'],
  [RenderPassType.HiZ, 'Hi-Z Depth Render Pass'],
  [RenderPassType.Reflection, 'SSR Render Pass'],
  [RenderPassType.DebugBounds, 'Debug Bounds Render Pass'],
  [RenderPassType.Blit, 'Blit Render Pass'],
])
