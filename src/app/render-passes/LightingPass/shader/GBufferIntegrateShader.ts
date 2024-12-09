import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import { SHADER_CHUNKS } from "../../../../renderer/shader/chunks";
import GetPBRLightingShaderUtils from "../../../../renderer/shader/PBRLightingShaderUtils";
import CSMShadowShaderUtils from "../../../../renderer/shader/CSMShadowShaderUtils";
import NormalEncoderShaderUtils from "../../../../renderer/shader/NormalEncoderShaderUtils";
import GBufferCommonShaderBindings from "./GBufferCommonShaderBindings";
import { LightType } from "../../../../renderer/types";

export const GBufferIntegrateShaderEntryFn = "integrateMain";

const GetGBufferIntegrateShader = (
	lightType: LightType,
	shadowMapSize = 1024,
	ligthSampleOffset = 0,
): string => wgsl/* wgsl */ `
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.Light}
  ${SHADER_CHUNKS.CameraUniform}
  ${SHADER_CHUNKS.Material}
  ${SHADER_CHUNKS.ShadowCascade}
  ${SHADER_CHUNKS.CommonHelpers}
  ${SHADER_CHUNKS.MathHelpers}

  ${GetPBRLightingShaderUtils({
		isDeferred: true,
		hasIBL: lightType === LightType.Directional,
	})}
  ${CSMShadowShaderUtils}
  ${NormalEncoderShaderUtils}

  struct LightSettings {
    debugLights: f32,
    debugShadowCascadeLayer: f32
  };

  const SHADOW_MAP_SIZE: f32 = ${shadowMapSize};

  ${GBufferCommonShaderBindings}


  @fragment
  fn ${GBufferIntegrateShaderEntryFn}(
    in: VertexOutput
  ) -> @location(0) vec4f {
    let coord = in.position;
    let pixelCoords = vec2i(floor(coord.xy));
    let encodedN = textureLoad(normalTexture, pixelCoords, 0).rg;
    let metallic = textureLoad(normalTexture, pixelCoords, 0).b;
    let roughness = textureLoad(normalTexture, pixelCoords, 0).a;
    let N = decodeNormal(encodedN);

    
    
    let albedo = textureLoad(colorTexture, pixelCoords, 0).xyz;
    let depth = textureLoad(depthTexture, pixelCoords, 0);
    
    let ao = textureLoad(aoTexture, pixelCoords, 0).r;
    // return vec4f(ao, ao, ao, 1);

    // return vec4f(N, 1.0);
    

    var material = Material();
    material.albedo = albedo;
    material.roughness = roughness;
    // return vec4f(vec3f(1 - metallic), 1);
    material.metallic = metallic;
    // material.ambientOcclusion = select(1.0, ao, pixelCoords.x > i32(textureDimensions(normalTexture).x / 2));
    material.ambientOcclusion = ao; //1;
    
    let viewSpacePos = calcViewSpacePos(camera, coord.xy, depth);
    let worldSpacePos = calcWorldPos(camera, coord, depth);
    

    let V = normalize(camera.position - viewSpacePos);

    #if ${lightType === LightType.Directional}
    let shadowLayerIdx = ShadowLayerIdxCalculate(worldSpacePos, camera, shadowCascades);
    let r = select(0.0, 1.0, shadowLayerIdx == 0);
    let g = select(0.0, 1.0, shadowLayerIdx == 1);
    let b = select(0.0, 1.0, shadowLayerIdx == 2);
    if (debugLightsInfo.debugShadowCascadeLayer == 1) {
      material.albedo = vec3f(r, g, b);
    }
    // TODO: Directional light is expected to be at index 0
    // Write a better mechanism for quering it
    let lightPosition = (camera.viewMatrix * vec4f(lightsBuffer[0].position, 1)).xyz;
    // let shadow = 1.0;
    let shadow = ShadowCalculate(
      worldSpacePos,
      N,
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
      N,
      V,
      shadow,
      opacity,
      #if ${lightType == LightType.Directional}
      diffuseIBLTexture,
      specularIBLTexture,
      bdrfLutTexture,
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
    // return mix(color, debugColor, debugLightsInfo.debugLights);
    return color;
    #else
    return color;
    #endif
    // return vec4f(f32(in.instanceId) / 4, 0, 0, 1);
    // return vec4f(V, 1.0);
  }
`;

export default GetGBufferIntegrateShader;
