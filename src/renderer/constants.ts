import { DebugTimingType, RenderPassType } from "./types";

export const AllRenderPassTypes: RenderPassType[] = [
	RenderPassType.Deferred,
	RenderPassType.DirectionalAmbientLighting,
	RenderPassType.SSAO,
	RenderPassType.Transparent,
	RenderPassType.Shadow,
	RenderPassType.TAAResolve,
	RenderPassType.Reflection,
	RenderPassType.Blit,
];

export const AllDebugTimingTypes: DebugTimingType[] = [
	DebugTimingType.CPUTotal,
	DebugTimingType.GPUTotal,
	DebugTimingType.FPS,
	DebugTimingType.DeferredRenderPass,
	DebugTimingType.DirectionalAmbientLightingRenderPass,
	DebugTimingType.PointLightsStencilMask,
	DebugTimingType.PointLightsLighting,
	DebugTimingType.SSAORenderPass,
	DebugTimingType.TransparentRenderPass,
	DebugTimingType.ShadowRenderPass,
	DebugTimingType.TAAResolveRenderPass,
	DebugTimingType.ReflectionRenderPass,
	DebugTimingType.BlitRenderPass,
];

export const RenderPassNames: Map<RenderPassType, string> = new Map([
	[RenderPassType.Deferred, "G-Buffer Render Pass"],
	[
		RenderPassType.DirectionalAmbientLighting,
		"Directional + Ambient Render Pass",
	],
	[RenderPassType.PointLightsStencilMask, "Point Lights Stencil Mask Pass"],
	[RenderPassType.SSAO, "SSAO Render Pass"],
	[RenderPassType.Transparent, "Transparent Render Pass"],
	[RenderPassType.Shadow, "Shadow Render Pass"],
	[RenderPassType.EnvironmentCube, "Environment Cube Pass"],
	[RenderPassType.TAAResolve, "TAA Resolve Render Pass"],
	[RenderPassType.Reflection, "SSR Render Pass"],
	[RenderPassType.DebugBounds, "Debug Bounds Render Pass"],
	[RenderPassType.Blit, "Blit Render Pass"],
]);
