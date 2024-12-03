import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

import { SHADER_CHUNKS } from "../../renderer/shader/chunks";
import NormalEncoderShaderUtils from "../../renderer/shader/NormalEncoderShaderUtils";
import {
	BIND_GROUP_LOCATIONS,
	PBR_TEXTURES_LOCATIONS,
	SAMPLER_LOCATIONS,
} from "../../renderer/core/RendererBindings";

export const FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN =
	"fragmentMainTexCoords";

/* prettier-ignore */
export const getDefaultPBRFragmentShader = ({
	hasPBRTexture = false,
  isInstanced = false
} = {}): string => wgsl/* wgsl */ `
  ${SHADER_CHUNKS.CameraUniform}
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.GBufferOutput}
  ${SHADER_CHUNKS.ModelUniform}
  ${SHADER_CHUNKS.InstanceInput}

  @group(${BIND_GROUP_LOCATIONS.Camera}) @binding(0) var<uniform> camera: CameraUniform;
  @group(${BIND_GROUP_LOCATIONS.Model}) @binding(0) var<uniform> model: ModelUniform;
  
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${SAMPLER_LOCATIONS.Default}) var texSampler: sampler;
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${PBR_TEXTURES_LOCATIONS.Albedo}) var albedoTexture: texture_2d<f32>;
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${PBR_TEXTURES_LOCATIONS.Normal}) var normalTexture: texture_2d<f32>;
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${PBR_TEXTURES_LOCATIONS.MetallicRoughness}) var metallicRoughnessTexture: texture_2d<f32>;

  #if ${isInstanced}
  @group(${BIND_GROUP_LOCATIONS.InstanceMatrices}) @binding(0) var<storage> instanceInputs: array<InstanceInput>;
  #endif

  ${NormalEncoderShaderUtils}

  // TODO: Push constants do not work correctly currently.
  // Prefer Push constants for shader permutation

  // override HAS_ALBEDO_TEXTURE: u32;
  // override HAS_NORMAL_TEXTURE: u32;
  

  @fragment
  fn ${FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN}(in: VertexOutput) -> GBufferOutput  {
    // return vec4<f32>(in.uv, 0.0, 1.0);
    var uv = in.uv;
    // uv.y = 1.0 - uv.y;
    

    var N = normalize(in.normal);
    let T = normalize(in.tangent);
    let B = normalize(in.bitangent);
    let TBN = mat3x3f(T, B, N);

    // var textureNormal = textureSampleLevel(normalTexture, texSampler, uv, 5.0).rgb * 2 - 1;
    let textureNormal = textureSample(normalTexture, texSampler, uv).rgb * 2 - 1;
    
    if (${hasPBRTexture}) {
      N = normalize(TBN * textureNormal);
    }

    var out: GBufferOutput;

    #if ${isInstanced}
      var metallic = instanceInputs[in.instanceId].metallic;
      var roughness = instanceInputs[in.instanceId].roughness;
    #else
      var metallic = model.metallic;
      var roughness = model.roughness;
    #endif


    if (${hasPBRTexture}) {
      metallic = textureSample(metallicRoughnessTexture, texSampler, uv).b;
      roughness = textureSample(metallicRoughnessTexture, texSampler, uv).g;
    }

    out.normalMetallicRoughness = vec4f(
      encodeNormal(N),
      metallic,
      roughness
    );
    
    let modelTexColor = textureSample(albedoTexture, texSampler, uv).rgb;
    var color = model.baseColor;

    if (${hasPBRTexture}) {
      color = modelTexColor;
    }
    
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
