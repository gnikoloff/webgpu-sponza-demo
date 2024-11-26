import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

import PBR_LIGHTING_UTILS_SHADER_CHUNK_SRC from "../../renderer/shader/PBRLighting";
import CSM_SHADOW_SHADER_CHUNK_SRC from "../../renderer/shader/CSMShadow";
import NORMAL_ENCODER_SHADER_CHUNK from "../../renderer/shader/NormalEncoder";

export const LIGHT_FRAGMENT_SHADER_ENTRY_NAME = "pointLightFragShader";
export const POINT_LIGHT_VERTEX_SHADER_ENTRY_NAME = "pointLightVertex";
export const DEBUG_FRAGMENT_SHADER_ENTRY_NAME = "debugGBuffer";

export const getGBufferPointVertexShader = (
	lightSampleOffset = 0,
	isPointLightMask = false,
) => wgsl/* wgsl */ `
  ${SHADER_CHUNKS.VertexInput}
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.CameraUniform}
  ${SHADER_CHUNKS.Light}

  #if ${isPointLightMask}
  @group(0) @binding(0) var<uniform> camera: CameraUniform;
  @group(0) @binding(1) var<storage, read> lightsBuffer: array<Light>;
  #else
  @group(0) @binding(0) var normalTexture: texture_2d<f32>;
  @group(0) @binding(1) var colorTexture: texture_2d<f32>;
  @group(0) @binding(2) var depthTexture: texture_depth_2d;
  @group(0) @binding(3) var bayerDitherTexture: texture_2d<f32>;
  @group(0) @binding(4) var bayerDitherSampler: sampler;
  @group(0) @binding(5) var<uniform> camera: CameraUniform;
  @group(0) @binding(6) var<storage, read> lightsBuffer: array<Light>;
  @group(0) @binding(7) var<uniform> debugLights: f32;
  #endif

  @vertex
  fn ${POINT_LIGHT_VERTEX_SHADER_ENTRY_NAME}(
    @builtin(instance_index) instanceId: u32,
    in: VertexInput
  ) -> VertexOutput {
    let trueInstanceId = instanceId + ${lightSampleOffset};
    let light = lightsBuffer[trueInstanceId];
    // let pos = camera.projectionViewMatrix * lightTransforms[] * in.position;
    var position = in.position;
    position *= vec4f(vec3f(light.radius), 1.0);
    position += vec4f(light.position, 0.0);
    let pos = camera.projectionViewMatrix * position;
  
    var out: VertexOutput;
    out.position = pos;
    out.instanceId = trueInstanceId;
    return out;
  }
`;

export const getGBufferFragShader = (
	isDirLight: boolean,
	shadowMapSize = 1024,
	ligthSampleOffset = 0,
) => wgsl/* wgsl */ `
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.Light}
  ${SHADER_CHUNKS.CameraUniform}
  ${SHADER_CHUNKS.Material}
  ${SHADER_CHUNKS.ShadowCascade}

  ${PBR_LIGHTING_UTILS_SHADER_CHUNK_SRC}
  ${CSM_SHADOW_SHADER_CHUNK_SRC}
  ${NORMAL_ENCODER_SHADER_CHUNK}

  struct LightSettings {
    debugLights: f32,
    debugShadowCascadeLayer: f32
  };

  const PI: f32 = ${Math.PI};
  const SHADOW_MAP_SIZE: f32 = ${shadowMapSize};

  @group(0) @binding(0) var normalTexture: texture_2d<f32>;
  @group(0) @binding(1) var colorTexture: texture_2d<f32>;
  @group(0) @binding(2) var depthTexture: texture_depth_2d;
  @group(0) @binding(3) var bayerDitherTexture: texture_2d<f32>;
  @group(0) @binding(4) var bayerDitherSampler: sampler;
  @group(0) @binding(5) var<uniform> camera: CameraUniform;
  @group(0) @binding(6) var<storage, read> lightsBuffer: array<Light>;
  @group(0) @binding(7) var<uniform> debugLightsInfo: LightSettings;

  #if ${isDirLight}

  @group(1) @binding(0) var<storage, read> shadowCascades: array<ShadowCascade, 3>;
  @group(1) @binding(1) var shadowMapSampler: sampler;
  @group(1) @binding(2) var shadowDepthTexture: texture_depth_2d_array;

  #endif

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
    let N = decodeNormal(encodedN);
    let albedo = textureLoad(colorTexture, pixelCoords, 0).xyz;
    let depth = textureLoad(depthTexture, pixelCoords, 0);

    var material = Material();
    material.albedo = albedo;
    material.roughness = roughness;
    material.metallic = metallic;
    material.ambientOcclusion = 1.0;

    let worldPos = calcWorldPos(coord, depth);

    let V = normalize(camera.position - worldPos);

    #if ${isDirLight}
    let shadowLayerIdx = ShadowLayerIdxCalculate(worldPos, &camera, shadowCascades);
    let r = select(0.0, 1.0, shadowLayerIdx == 0);
    let g = select(0.0, 1.0, shadowLayerIdx == 1);
    let b = select(0.0, 1.0, shadowLayerIdx == 2);
    if (debugLightsInfo.debugShadowCascadeLayer == 1) {
      material.albedo = vec3f(r, g, b);
    }
    #endif

    // return vec4f(N, 1.0);

    #if ${isDirLight}
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
      shadow
    );

    let bayerDitherOffset = textureSample(bayerDitherTexture, bayerDitherSampler, vec2f(coord.xy) / 8).r / 32.0 - (1.0 / 128.0);

    color += vec4f(bayerDitherOffset);

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
