import IBLShaderHelpers from "./IBLShaderHelpers";
import { SHADER_CHUNKS } from "./chunks";

export const SpecularIBLShaderUtilsEntryFn = "main";

const SpecularIBLShaderUtils = /* wgsl */ `
  ${SHADER_CHUNKS.CommonHelpers}
  ${SHADER_CHUNKS.MathHelpers}

  @group(0) @binding(0) var inTexture: texture_cube<f32>;
  @group(0) @binding(1) var outTexture: texture_storage_2d<rgba16float, write>;
  @group(0) @binding(2) var cubeSampler: sampler;
  @group(0) @binding(3) var<uniform> face: u32;
  @group(0) @binding(4) var<uniform> roughness: f32;

  const SAMPLE_COUNT: u32 = 1024;

  ${IBLShaderHelpers}

  @compute @workgroup_size(8, 8)
  fn ${SpecularIBLShaderUtilsEntryFn}(@builtin(global_invocation_id) id: vec3u) {
    let texSize = textureDimensions(outTexture).xy;
    if (any(id.xy >= texSize)) {
      return;
    }

    let size = vec2f(texSize.xy);
    let uv = vec2f(id.xy) / size;
    
    var ruv = 2.0 * uv - 1.0;
    ruv.y = ruv.y * -1;

    let rotation = CUBE_ROTATIONS[face];
    let N = normalize(vec3f(ruv, 1.0) * rotateAxisAngle(rotation.xyz, rotation.w));

    let R = N;
    let V = R;

    var prefilteredColor = vec3f(0.0);
    var totalWeight = 0.0;

    for (var i = 0u; i < SAMPLE_COUNT; i++) {
      // generates a sample vector that's biased towards the preferred alignment direction (importance sampling).
      let Xi = hammersley(i, SAMPLE_COUNT);
      let H = importanceSampleGGX(Xi, N, roughness);
      let L = normalize(2.0 * dot(V, H) * H - V);

      let NdotL = max(dot(N, L), 0.0);

      if (NdotL > 0.0) {
        // sample from the environment's mip level based on roughness/pdf

        let NdotH = max(dot(N, H), 0.0);
        let HdotV = max(dot(H, V), 0.0);
        let D = distributionGGX(NdotH, roughness);
        let pdf = max((D * NdotH / (4.0 * HdotV)) + 0.0001, 0.0001);

        let resolution = f32(textureDimensions(inTexture).x); // resolution of source cubemap (per face)
        let saTexel = 4.0 * PI / (6.0 * resolution * resolution);
        let saSample = 1.0 / (f32(SAMPLE_COUNT) * pdf + 0.0001);

        let mipLevel = select(0.5 * log2(saSample / saTexel), 0.0, roughness == 0.0);

        prefilteredColor += textureSampleLevel(inTexture, cubeSampler, L, mipLevel).rgb * NdotL;
        totalWeight += NdotL;
      }
    }

    prefilteredColor = prefilteredColor / totalWeight;
    textureStore(outTexture, id.xy, vec4f(prefilteredColor, 1.0));
  }
`;

export default SpecularIBLShaderUtils;
