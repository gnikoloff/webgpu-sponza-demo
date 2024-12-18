export type UUIDString = `${string}-${string}-${string}-${string}-${string}`

export type easeTweenFunc = (k: number) => number

export type placeholderFunc = () => void

export type updateTweenFunc = (
  timeElapsedEase: number,
  timeElapsed: number
) => void

export type EaseType =
  | 'linear'
  | 'quad_In'
  | 'quad_Out'
  | 'quad_InOut'
  | 'cubic_In'
  | 'cubic_Out'
  | 'cubic_InOut'
  | 'quart_In'
  | 'quart_Out'
  | 'quart_InOut'
  | 'quint_In'
  | 'quint_Out'
  | 'quint_InOut'
  | 'sine_In'
  | 'sine_Out'
  | 'sine_InOut'
  | 'exp_In'
  | 'exp_Out'
  | 'exp_InOut'
  | 'circ_In'
  | 'circ_Out'
  | 'circ_InOut'
  | 'elastic_In'
  | 'elastic_Out'
  | 'elastic_InOut'
  | 'back_In'
  | 'back_Out'
  | 'back_InOut'
  | 'bounce_In'
  | 'bounce_Out'
  | 'bounce_InOut'

export interface TweenProps {
  durationMS: number
  delayMS?: number
  easeName?: EaseType
  onUpdate: updateTweenFunc
  onComplete?: placeholderFunc
}

export enum RenderPassType {
  Deferred,
  DirectionalAmbientLighting,
  PointLightsNonCulledLighting,
  PointLightsStencilMask,
  PointLightsLighting,
  SSAO,
  SSAOBlur,
  Skybox,
  Transparent,
  Shadow,
  MomentsShadow,
  BlurMomentsShadow,
  EnvironmentCube,
  TAAResolve,
  CopyDepthForHiZ,
  HiZ,
  Reflection,
  BloomDownsample,
  BloomUpsample,
  DebugBounds,
  Blit,
}

export enum DebugStatType {
  CPUTotal,
  GPUTotal,
  FPS,
  VRAM,
  VisibleMeshes,
  LightsCount,
  DeferredRenderPass,
  DirectionalAmbientLightingRenderPass,
  PointLightsStencilMask,
  PointLightsLighting,
  SSAORenderPass,
  TransparentRenderPass,
  ShadowRenderPass,
  TAAResolveRenderPass,
  ReflectionRenderPass,
  BlitRenderPass,
}

export type RenderPassTimingRange = [number, number]

export interface RenderPassTiming {
  avgValue: number
  timings: RenderPassTimingRange
}

export enum LightType {
  Directional,
  Point,
  Ambient,
}

export type ShaderAttribLocation = 0 | 1 | 2 | 3
export type BindGroupLocation = 0 | 1 | 2 | 3 | 4
export type SamplerLocation = 0
export type TextureLocation = 1 | 2 | 3 | 4

export interface IMaterial {
  vertexShaderSrc: string
  vertexShaderEntryFn: string
  vertexBuffers?: GPUVertexBufferLayout[]
  fragmentShaderSrc?: string
  fragmentShaderEntryFn?: string
  bindGroupLayouts?: GPUBindGroupLayout[]
  constants?: Record<string, number>
  targets?: GPUColorTargetState[]
  depthStencilState?: GPUDepthStencilState
  primitive?: GPUPrimitiveState
  debugLabel?: string
}

export interface HDRImageResult {
  width: number
  height: number
  rgbaHalfFloat: Uint16Array
}

export type RenderPassTimingResolveBufferState =
  | 'free'
  | 'need resolve'
  | 'wait for result'
