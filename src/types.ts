import { Vec3 } from "wgpu-matrix";
import { RenderPassType } from "./renderer/types";

export type SSRMethod = "linear" | "hi-z";

export interface IGUIParams {
	"Play Animation": boolean;
	"Performance Stats": boolean;
	"Enable TAA": boolean;
	"Debug G-Buffer": boolean;
	"Debug Shadow Map": boolean;
	"Debug Shadow Cascades": boolean;
	"Shadow Map Size": number;
	"Debug Point Lights Mask": boolean;
	"Render 2nd Floor Points": boolean;
	"Enable SSR": boolean;
	"SSR Method": SSRMethod;
	"SSR Max Iterations": number;
	"Debug No Info Rays": boolean;
	"Sun Intensity": number;
	"Sun Position X": number;
	"Sun Position Y": number;
	"Sun Position Z": number;
	"Debug Skybox": boolean;
	"Enable Bloom": boolean;
	"Bloom Filter Radius": number;
	// "Debug Bounding Boxes": boolean;
	// "Debug Point Lines Curve": boolean;
	"Enable SSAO": boolean;
	"SSAO Radius": number;
	"SSAO Strength": number;
	"SSAO Kernel Size": number;
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
