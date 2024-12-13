import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import { RenderPassType } from "../../renderer/types";
import { LightPassType } from "../../types";

const getGBufferCommonShaderBindings = (
	renderPassType: LightPassType,
) => wgsl/* wgsl */ `
  @group(0) @binding(0) var normalTexture: texture_2d<f32>;
  @group(0) @binding(1) var colorTexture: texture_2d<f32>;
  @group(0) @binding(2) var depthTexture: texture_depth_2d;
  @group(0) @binding(3) var aoTexture: texture_2d<f32>;
  @group(0) @binding(4) var<uniform> camera: CameraUniform;
  
  #if ${
		renderPassType === RenderPassType.PointLightsLighting ||
		renderPassType === RenderPassType.PointLightsStencilMask ||
		renderPassType === RenderPassType.DirectionalAmbientLighting
	}
  @group(0) @binding(5) var<storage, read> lightsBuffer: array<Light>;
  @group(0) @binding(6) var<uniform> debugLightsInfo: LightSettings;
  #endif

  #if ${renderPassType === RenderPassType.PointLightsNonCulledLighting}
  @group(1) @binding(0) var<uniform> cameraCulledPointLight: Light;
  #endif

  #if ${renderPassType === RenderPassType.DirectionalAmbientLighting}
  @group(1) @binding(0) var<storage, read> shadowCascades: array<ShadowCascade, 3>;
  @group(1) @binding(1) var shadowMapSampler: sampler;
  @group(1) @binding(2) var shadowDepthTexture: texture_depth_2d_array;
  @group(1) @binding(3) var diffuseIBLTexture: texture_cube<f32>;
  @group(1) @binding(4) var specularIBLTexture: texture_cube<f32>;
  @group(1) @binding(5) var bdrfLutTexture: texture_2d<f32>;
  @group(1) @binding(6) var envTexSampler: sampler;
  #endif
`;

export default getGBufferCommonShaderBindings;
