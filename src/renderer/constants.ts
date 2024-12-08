import { RenderPassType } from "./types";

export const RenderPassNames: Map<RenderPassType, string> = new Map([
	[RenderPassType.Deferred, "G-Buffer Render Pass"],
	[RenderPassType.DeferredLighting, "Lighting Pass"],
	[RenderPassType.SSAO, "SSAO Render Pass"],
	[RenderPassType.Transparent, "Transparent Pass"],
	[RenderPassType.Shadow, "Shadow Pass"],
	[RenderPassType.EnvironmentCube, "Environment Cube Pass"],
	[RenderPassType.TAAResolve, "TAA Resolve Pass"],
	[RenderPassType.Reflection, "SSR Pass"],
	[RenderPassType.DebugBounds, "Debug Bounds Pass"],
]);
