import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import CSMShadowShaderUtils from "../../renderer/shader/CSMShadowShaderUtils";
import NormalEncoderShaderUtils from "../../renderer/shader/NormalEncoderShaderUtils";
import GetPBRLightingShaderUtils from "../../renderer/shader/PBRLightingShaderUtils";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";
import { RenderPassType } from "../../renderer/types";
import { LightPassType } from "../../types";
import DirectionalShadowRenderPass from "../render-passes/DirectionalShadowRenderPass";
import getGBufferCommonShaderBindings from "./GBufferCommonShaderBindings";

export const GBufferIntegrateShaderEntryFn = "integrateMain";

const GetGBufferIntegrateShader = (
	lightPassType: LightPassType,
): string => wgsl/* wgsl */ `
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.Light}
  ${SHADER_CHUNKS.Camera}
  ${SHADER_CHUNKS.Material}
  ${SHADER_CHUNKS.ShadowCascade}
  ${SHADER_CHUNKS.CommonHelpers}
  ${SHADER_CHUNKS.MathHelpers}

  ${GetPBRLightingShaderUtils(lightPassType)}
  ${CSMShadowShaderUtils}
  ${NormalEncoderShaderUtils}

  struct LightSettings {
    debugLights: f32,
    debugShadowCascadeLayer: f32
  };

  #if ${lightPassType === RenderPassType.DirectionalAmbientLighting}
  const SHADOW_MAP_SIZE: f32 = ${DirectionalShadowRenderPass.TEXTURE_SIZE};
  #endif

  ${getGBufferCommonShaderBindings(lightPassType)}

  @fragment
  fn ${GBufferIntegrateShaderEntryFn}(
    in: VertexOutput
  ) -> @location(0) vec4f {
    let coord = in.position;
    let pixelCoords = vec2i(floor(coord.xy));
    let encodedN = textureLoad(normalTexture, pixelCoords, 0).rg;
    let metallic = textureLoad(normalTexture, pixelCoords, 0).b;
    let roughness = textureLoad(normalTexture, pixelCoords, 0).a;
    let viewSpaceNormal = decodeNormal(encodedN);
    
    let albedo = textureLoad(colorTexture, pixelCoords, 0).xyz;
    let depth = textureLoad(depthTexture, pixelCoords, 0);
    
    let aoPixelCoords = vec2i(floor(coord.xy));
    let ao = textureLoad(aoTexture, aoPixelCoords, 0).r;
    // return vec4f(ao, ao, ao, 1);

    // return vec4f(viewSpaceNormal, 1.0);
    

    var material = Material();
    material.albedo = albedo;
    material.roughness = roughness;
    // return vec4f(vec3f(1 - metallic), 1);
    material.metallic = metallic;
    // material.ambientOcclusion = select(1.0, ao, pixelCoords.x > i32(textureDimensions(normalTexture).x / 2));

    #if ${lightPassType === RenderPassType.DirectionalAmbientLighting}
    material.ambientOcclusion = mix(1.0, ao, ssaoMixFactor);
    #endif
    
    let viewSpacePos = calcViewSpacePos(camera, coord.xy, depth);
    
    let V = normalize(-viewSpacePos);

    #if ${lightPassType === RenderPassType.DirectionalAmbientLighting}
    let worldSpacePos = calcWorldPos(camera, coord.xy, depth);
    let shadowLayerIdx = ShadowLayerIdxCalculate(worldSpacePos, camera, shadowCascades);
    let r = select(0.0, 1.0, shadowLayerIdx == 0);
    let g = select(0.0, 1.0, shadowLayerIdx == 1);
    let b = select(0.0, 1.0, shadowLayerIdx == 2);
    if (debugLightsInfo.debugShadowCascadeLayer == 1) {
      material.albedo = vec3f(r, g, b);
    }
    // TODO: Directional light is expected to be at index 0
    // Write a better mechanism for quering it
    let lightPosition = (camera.viewMatrix * (vec4f(lightsBuffer[0].position, 0))).xyz;
    // let shadow = 1.0;
    let shadow = ShadowCalculate(
      worldSpacePos,
      viewSpaceNormal,
      lightPosition,
      camera,
      SHADOW_MAP_SIZE,
      SHADOW_MAP_SIZE,
      shadowCascades,
      shadowDepthTexture,
      shadowMapSampler
    );
    #else
    let shadow = 1.0;
    #endif

    let opacity = 1.0;

    var color = PBRLighting(
      material,
      in.instanceId,
      viewSpacePos,
      viewSpaceNormal,
      V,
      shadow,
      opacity,
      #if ${lightPassType === RenderPassType.PointLightsNonCulledLighting}
      cameraCulledPointLight.position,
      cameraCulledPointLight.radius,
      cameraCulledPointLight.color,
      cameraCulledPointLight.intensity,
      #elif ${lightPassType == RenderPassType.DirectionalAmbientLighting}
      diffuseIBLTexture,
      specularIBLTexture,
      bdrfLutTexture,
      envTexSampler
      #endif
    );

    #if ${lightPassType === RenderPassType.PointLightsLighting}
    let debugColor = vec4f(1.0, 0.0, 0.0, 1.0);
    return mix(color, debugColor, debugLightsInfo.debugLights);
    #else
    return color;
    #endif
  }
`;

export default GetGBufferIntegrateShader;
