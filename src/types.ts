import { Vec3 } from "wgpu-matrix";
import { RenderPassType } from "./renderer/types";

export type SSRMethod = "linear" | "hi-z";

export interface IGUIParams {
	"Play Animation": boolean;
	"Enable TAA": boolean;
	"Debug G-Buffer": boolean;
	"Debug Shadow Map": boolean;
	"Debug Shadow Cascades": boolean;
	"Debug Point Lights Mask": boolean;
	"SSR Enabled": boolean;
	"SSR Method": SSRMethod;
	"SSR Max Iterations": number;
	"Sun Intensity": number;
	"Sun Position X": number;
	"Sun Position Y": number;
	"Sun Position Z": number;
	"Debug Skybox": boolean;
	"Debug Bounding Boxes": boolean;
	"Enable SSAO": boolean;
}

export interface ILightParticle {
	radius?: number;
	position?: Vec3;
	velocity?: Vec3;
	lifeSpeed?: number;
	life?: number;
}

export enum TextureDebugMeshType {
	Normal,
	AO,
	Metallic,
	Roughness,
	Reflectance,
	Albedo,
	Depth,
	Velocity,
	ShadowDepthCascade0,
	ShadowDepthCascade1,
	BDRF,
}

export type LightPassType =
	| RenderPassType.PointLightsStencilMask
	| RenderPassType.PointLightsLighting
	| RenderPassType.DirectionalAmbientLighting
	| RenderPassType.PointLightsNonCulledLighting;
