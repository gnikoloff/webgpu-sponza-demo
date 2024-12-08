import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import {
	BIND_GROUP_LOCATIONS,
	PBR_TEXTURES_LOCATIONS,
	SAMPLER_LOCATIONS,
} from "../../renderer/core/RendererBindings";
import GetPBRLightingShaderUtils from "../../renderer/shader/PBRLightingShaderUtils";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

export const ForwardRenderPBRShaderEntryFn = "forwardPBRFrag";

/* prettier-ignore */
export const getDefaultForwardPBRFragmentShader = ({
	hasPBRTextures = false,
  isInstanced = false
} = {}) => wgsl/* wgsl */ `
  ${SHADER_CHUNKS.CameraUniform}
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.GBufferOutput}
  ${SHADER_CHUNKS.ModelUniform}
  ${SHADER_CHUNKS.Material}
  ${SHADER_CHUNKS.InstanceInput}
  ${SHADER_CHUNKS.CommonHelpers}
  ${SHADER_CHUNKS.Light}

  @group(${BIND_GROUP_LOCATIONS.CameraPlusOptionalLights}) @binding(0) var<uniform> camera: CameraUniform;
  @group(${BIND_GROUP_LOCATIONS.CameraPlusOptionalLights}) @binding(1) var<storage, read> lightsBuffer: array<Light>;

  @group(${BIND_GROUP_LOCATIONS.Model}) @binding(0) var<uniform> model: ModelUniform;

  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${SAMPLER_LOCATIONS.Default}) var texSampler: sampler;
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${PBR_TEXTURES_LOCATIONS.Albedo}) var albedoTexture: texture_2d<f32>;
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${PBR_TEXTURES_LOCATIONS.Normal}) var normalTexture: texture_2d<f32>;
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${PBR_TEXTURES_LOCATIONS.MetallicRoughness}) var metallicRoughnessTexture: texture_2d<f32>;

  #if ${isInstanced}
  @group(${BIND_GROUP_LOCATIONS.InstanceInputs}) @binding(0) var<storage> instanceInputs: array<InstanceInput>;
  #endif

  ${GetPBRLightingShaderUtils({
		isDeferred: false,
		hasIBL: false,
	})}

  @fragment
  fn ${ForwardRenderPBRShaderEntryFn}(in: VertexOutput) -> @location(0) vec4f {
    let uv = in.uv;

    var N = normalize(in.viewNormal);
    let T = normalize(in.viewTangent);
    let B = normalize(in.viewBitangent);
    let TBN = mat3x3f(T, B, N);
    let textureNormal = textureSample(normalTexture, texSampler, uv).rgb * 2 - 1;
    if (${hasPBRTextures}) {
      N = normalize(TBN * textureNormal);
    }

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

    let modelTexColor = textureSample(albedoTexture, texSampler, uv).rgb;
    var color = vec4f(model.baseColor, 1);
    if (${hasPBRTextures}) {
      color = textureSample(albedoTexture, texSampler, uv);
    }

    // if (color.a < 0.01) {
    //   discard;
    // }

    var material = Material();
    material.albedo = color.rgb;
    material.roughness = roughness;
    // return vec4f(vec3f(1 - metallic), 1);
    material.metallic = metallic;
    material.ambientOcclusion = 1.0;

    let V = normalize(camera.position - in.worldPosition);

    return PBRLighting(
      &material,
      0,
      in.worldPosition,
      N,
      V,
      1,
      color.a
    );
  }
`;
