import { wgsl } from 'wgsl-preprocessor/wgsl-preprocessor.js'

import {
  BIND_GROUP_LOCATIONS,
  PBR_TEXTURES_LOCATIONS,
  SAMPLER_LOCATIONS,
} from '../../renderer/core/RendererBindings'
import NormalEncoderShaderUtils from '../../renderer/shader/NormalEncoderShaderUtils'
import { SHADER_CHUNKS } from '../../renderer/shader/chunks'

export const DeferredRenderPBRShaderEntryFn = 'deferredPBRFrag'

/* prettier-ignore */
export const getDefaultDeferredPBRFragmentShader = ({
	hasPBRTextures = false,
  isInstanced = false
} = {}): string => wgsl/* wgsl */ `
  ${SHADER_CHUNKS.Camera}
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.GBufferOutput}
  ${SHADER_CHUNKS.ModelUniform}
  ${SHADER_CHUNKS.InstanceInput}

  @group(${BIND_GROUP_LOCATIONS.CameraPlusOptionalLights}) @binding(0) var<uniform> camera: Camera;
  @group(${BIND_GROUP_LOCATIONS.Model}) @binding(0) var<uniform> model: ModelUniform;
  
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${SAMPLER_LOCATIONS.Default}) var texSampler: sampler;
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${PBR_TEXTURES_LOCATIONS.Albedo}) var albedoTexture: texture_2d<f32>;
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${PBR_TEXTURES_LOCATIONS.Normal}) var normalTexture: texture_2d<f32>;
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${PBR_TEXTURES_LOCATIONS.MetallicRoughness}) var metallicRoughnessTexture: texture_2d<f32>;

  #if ${isInstanced}
  @group(${BIND_GROUP_LOCATIONS.InstanceInputs}) @binding(0) var<storage> instanceInputs: array<InstanceInput>;
  #endif

  ${NormalEncoderShaderUtils}

  @fragment
  fn ${DeferredRenderPBRShaderEntryFn}(in: VertexOutput) -> GBufferOutput  {
    let uv = in.uv;
    
    var viewSpaceN = normalize(in.viewNormal);
    let viewSpaceT = normalize(in.viewTangent);
    let viewSpaceB = normalize(in.viewBitangent);
    let viewSpaceTBN = mat3x3f(viewSpaceT, viewSpaceB, viewSpaceN);

    // var textureNormal = textureSampleLevel(normalTexture, texSampler, uv, 5.0).rgb * 2 - 1;
    let textureNormal = textureSample(normalTexture, texSampler, uv).rgb * 2 - 1;
    
    if (${hasPBRTextures}) {
      viewSpaceN = normalize(viewSpaceTBN * textureNormal);
    }

    var color = model.baseColor;
    if (${hasPBRTextures}) {
      let texColor = textureSample(albedoTexture, texSampler, uv);
      if (texColor.a < 0.2) {
        discard;
      }
      color = texColor.rgb;
    }

    var out: GBufferOutput;

    #if ${isInstanced}
      var metallic = instanceInputs[in.instanceId].metallic;
      var roughness = instanceInputs[in.instanceId].roughness;
    #else
      var metallic = model.metallic;
      var roughness = model.roughness;
    #endif


    if (${hasPBRTextures}) {
      let metallicRoughness = textureSample(metallicRoughnessTexture, texSampler, uv).rgb;
      metallic = metallicRoughness.b;
      roughness = metallicRoughness.g;
    }

    out.normalMetallicRoughness = vec4f(
      encodeNormal(viewSpaceN),
      metallic,
      roughness
    );
    
    out.color = vec4f(color, f32(model.isReflective));
    
    var oldPos = in.prevFrameClipPos;
    var newPos = in.currFrameClipPos;
    
    oldPos /= oldPos.w;
    oldPos.x = (oldPos.x+1)/2.0;
    oldPos.y = (oldPos.y+1)/2.0;
    oldPos.y = 1 - oldPos.y;
    
    newPos /= newPos.w;
    newPos.x = (newPos.x+1)/2.0;
    newPos.y = (newPos.y+1)/2.0;
    newPos.y = 1 - newPos.y;

    out.velocity = vec4f((newPos - oldPos).xy, 0, 1);
  
    return out;
  }
`;
