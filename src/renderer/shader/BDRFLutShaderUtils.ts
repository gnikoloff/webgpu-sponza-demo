import IBLShaderHelpers from './IBLShaderHelpers'
import { SHADER_CHUNKS } from './chunks'

export const BDRFLutShaderEntryFn = 'main'

const BDRFLutShaderUtils = /* wgsl */ `
  ${SHADER_CHUNKS.CommonHelpers}

  @group(0) @binding(0) var outTexture: texture_storage_2d<rgba16float, write>;

  const SAMPLE_COUNT = 1024u;

  ${IBLShaderHelpers}

  // https://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
  // Karis 2014
  
  fn integrate(NdotV: f32, roughness: f32) -> vec2f {
    var V = vec3f(0.0);
    V.x = sqrt(1.0 - NdotV * NdotV); // sin
    V.y = 0.0;
    V.z = NdotV; // cos

    // N points straight upwards for this integration
    let N = vec3f(0.0, 0.0, 1.0);

    var A = 0.0;
    var B = 0.0;

    for (var i = 0u; i < SAMPLE_COUNT; i++) {
      let Xi = hammersley(i, SAMPLE_COUNT);
      let H = importanceSampleGGX(Xi, N, roughness);
      let L = 2.0 * dot(V, H) * H - V;

      let NdotL = saturate(L.z);
      let NdotH = saturate(H.z);
      let VdotH = saturate(dot(V, H));
      
      if (NdotL > 0.0) {
        let V_pdf = visibilitySmithGGXCorrelated(NdotV, NdotL, roughness) * VdotH * NdotL / NdotH;
        let Fc = pow(1.0 - VdotH, 5.0);
        A += (1.0 - Fc) * V_pdf;
        B += Fc * V_pdf;
      }
    }

    return 4.0 * vec2f(A, B) / f32(SAMPLE_COUNT);
  }

  @compute @workgroup_size(8, 8)
  fn ${BDRFLutShaderEntryFn}(@builtin(global_invocation_id) id: vec3u) {
    let texSize = textureDimensions(outTexture).xy;
    if (any(id.xy >= texSize)) {
      return;
    }

    let size = vec2f(texSize.xy) - 1.0;
    let uv = vec2f(id.xy) / size;

    let result = vec4f(integrate(uv.x, uv.y), 0, 0);
    textureStore(outTexture, id.xy, result);
  }
`

export default BDRFLutShaderUtils
