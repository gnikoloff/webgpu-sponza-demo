export type UUIDString = `${string}-${string}-${string}-${string}-${string}`;

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
	EnvironmentCube,
	TAAResolve,
	CopyDepthForHiZ,
	HiZ,
	Reflection,
	DebugBounds,
	Blit,
}

export enum DebugStatType {
	CPUTotal,
	GPUTotal,
	FPS,
	VRAM,
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

export type RenderPassTimingRange = [number, number];

export interface RenderPassTiming {
	avgValue: number;
	timings: RenderPassTimingRange;
}

export enum LightType {
	Directional,
	Point,
	Ambient,
}

export type ShaderAttribLocation = 0 | 1 | 2 | 3;
export type BindGroupLocation = 0 | 1 | 2 | 3 | 4;
export type SamplerLocation = 0;
export type TextureLocation = 1 | 2 | 3 | 4;

export interface IMaterial {
	vertexShaderSrc: string;
	vertexShaderEntryFn: string;
	vertexBuffers?: GPUVertexBufferLayout[];
	fragmentShaderSrc?: string;
	fragmentShaderEntryFn?: string;
	bindGroupLayouts?: GPUBindGroupLayout[];
	constants?: Record<string, number>;
	targets?: GPUColorTargetState[];
	depthStencilState?: GPUDepthStencilState;
	primitive?: GPUPrimitiveState;
	debugLabel?: string;
}

export interface HDRImageResult {
	width: number;
	height: number;
	rgbaHalfFloat: Uint16Array;
}

export type RenderPassTimingResolveBufferState =
	| "free"
	| "need resolve"
	| "wait for result";
