import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

import GetPBRLightingShaderUtils from "../../renderer/shader/PBRLightingShaderUtils";
import CSMShadowShaderUtils from "../../renderer/shader/CSMShadowShaderUtils";
import NormalEncoderShaderUtils from "../../renderer/shader/NormalEncoderShaderUtils";
import { LightType } from "../../renderer/lighting/Light";
import GBufferCommonShaderBindings from "../render-passes/LightingPass/shader/GBufferCommonShaderBindings";

export const LIGHT_FRAGMENT_SHADER_ENTRY_NAME = "pointLightFragShader";
export const POINT_LIGHT_VERTEX_SHADER_ENTRY_NAME = "pointLightVertex";
export const DEBUG_FRAGMENT_SHADER_ENTRY_NAME = "debugGBuffer";

export const getGBufferFragShader = (
	lightType: LightType,
	shadowMapSize = 1024,
	ligthSampleOffset = 0,
) => wgsl/* wgsl */ `
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.Light}
  ${SHADER_CHUNKS.CameraUniform}
  ${SHADER_CHUNKS.Material}
  ${SHADER_CHUNKS.ShadowCascade}
  ${SHADER_CHUNKS.CommonHelpers}

  ${GetPBRLightingShaderUtils(lightType)}
  ${CSMShadowShaderUtils}
  ${NormalEncoderShaderUtils}

  struct LightSettings {
    debugLights: f32,
    debugShadowCascadeLayer: f32
  };

  const SHADOW_MAP_SIZE: f32 = ${shadowMapSize};

  ${GBufferCommonShaderBindings}

  @must_use
  fn calcWorldPos(coord: vec4f, depth: f32) -> vec3f {
    let ndcX = coord.x / f32(camera.viewportWidth) * 2.0 - 1.0;
    let ndcY = (1.0 - coord.y / f32(camera.viewportHeight)) * 2.0 - 1.0;
    let clipPos = vec4f(ndcX, ndcY, depth, 1.0);

    let worldSpacePos = camera.inverseProjectionViewMatrix * clipPos;
    return worldSpacePos.xyz / worldSpacePos.w;
  }

  @fragment
  fn ${LIGHT_FRAGMENT_SHADER_ENTRY_NAME}(
    in: VertexOutput
  ) -> @location(0) vec4f {
    let coord = in.position;
    let pixelCoords = vec2i(floor(coord.xy));
    let encodedN = textureLoad(normalTexture, pixelCoords, 0).rg;
    let metallic = textureLoad(normalTexture, pixelCoords, 0).b;
    let roughness = textureLoad(normalTexture, pixelCoords, 0).a;
    let N = normalize(decodeNormal(encodedN));
    
    let albedo = textureLoad(colorTexture, pixelCoords, 0).xyz;
    let depth = textureLoad(depthTexture, pixelCoords, 0);

    var material = Material();
    material.albedo = albedo;
    material.roughness = roughness;
    // return vec4f(vec3f(1 - metallic), 1);
    material.metallic = metallic;
    material.ambientOcclusion = 1.0;

    let worldPos = calcWorldPos(coord, depth);

    let V = normalize(camera.position - worldPos);

    #if ${lightType === LightType.Directional}
    let shadowLayerIdx = ShadowLayerIdxCalculate(worldPos, &camera, shadowCascades);
    let r = select(0.0, 1.0, shadowLayerIdx == 0);
    let g = select(0.0, 1.0, shadowLayerIdx == 1);
    let b = select(0.0, 1.0, shadowLayerIdx == 2);
    if (debugLightsInfo.debugShadowCascadeLayer == 1) {
      material.albedo = vec3f(r, g, b);
    }
    // TODO: Directional light is expected to be at index 0
    // Write a better mechanism for quering it
    let lightPosition = lightsBuffer[0].position;
    let shadow = ShadowCalculate(
      worldPos,
      N,
      lightPosition,
      &camera,
      SHADOW_MAP_SIZE,
      SHADOW_MAP_SIZE,
      shadowCascades,
      shadowDepthTexture,
      shadowMapSampler
    );
    #else
    let shadow = 1.0;
    #endif

    var color = PBRLighting(
      &material,
      in.instanceId,
      worldPos,
      N,
      V,
      shadow,
      #if ${lightType == LightType.Directional}
      diffuseIBLTexture,
      envTexSampler
      #endif
    );

    // let bayerDitherOffset = textureSample(bayerDitherTexture, bayerDitherSampler, vec2f(coord.xy) / 8).r / 32.0 - (1.0 / 128.0);

    // color += vec4f(bayerDitherOffset);

    // color = color / (color + vec4f(vec3f(1.0), 0.0));
    // // gamma correct
    // color = pow(color, vec4f(vec3f(1.0/2.2), 1.0)); 

    #if ${ligthSampleOffset !== 0}
    let debugColor = vec4f(1.0, 0.0, 0.0, 1.0);
    return mix(color, debugColor, debugLightsInfo.debugLights);
    #else
    return color;
    #endif
    // return vec4f(f32(in.instanceId) / 4, 0, 0, 1);
    // return vec4f(V, 1.0);
  }

  @fragment
  fn ${DEBUG_FRAGMENT_SHADER_ENTRY_NAME}(
    in: VertexOutput
  ) -> @location(0) vec4f {
    let coord = in.position;
    let pixelCoords = vec2i(floor(coord.xy));
    let albedo = textureLoad(colorTexture, pixelCoords, 0).xyz;
    return vec4f(albedo, 1.0);
  }
`;
