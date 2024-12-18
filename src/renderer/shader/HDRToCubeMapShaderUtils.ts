import { SHADER_CHUNKS } from './chunks'

export const HDRToCubeMapShaderUtilsEntryVertexFn = 'vertexMain'
export const HDRToCubeMapShaderUtilsEntryFragmentFn = 'fragmentMain'

const HDRToCubeMapShaderUtils = /* wgsl */ `
  ${SHADER_CHUNKS.VertexInput}
  ${SHADER_CHUNKS.VertexOutput}

  @group(0) @binding(0) var<uniform> projViewMatrix: mat4x4f;
  @group(0) @binding(1) var inTexture: texture_2d<f32>;
  @group(0) @binding(2) var inSampler: sampler;

  const invAtan = vec2(0.1591, 0.3183);
  fn SampleSphericalMap(v: vec3f) -> vec2f {
    var uv = vec2f(atan(v.z / v.x), asin(v.y));
    uv *= invAtan;
    uv += 0.5;
    return uv;
  }


  @vertex
  fn ${HDRToCubeMapShaderUtilsEntryVertexFn}(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.position = projViewMatrix * in.position;
    // hijack
    out.viewNormal = in.position.xyz;
    return out;
  }

  @fragment
  fn ${HDRToCubeMapShaderUtilsEntryFragmentFn}(in: VertexOutput) -> @location(0) vec4f {
    let uv = SampleSphericalMap(normalize(in.normal.rgb)); // make sure to normalize localPos
    let color = textureSample(inTexture, inSampler, uv).rgb;
    return vec4f(color, 1);
  }
`

export default HDRToCubeMapShaderUtils
