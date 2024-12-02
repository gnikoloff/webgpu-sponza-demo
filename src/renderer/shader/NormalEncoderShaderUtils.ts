// https://knarkowicz.wordpress.com/2014/04/16/octahedron-normal-vector-encoding/

const NormalEncoderShaderUtils = /* wgsl */ `
  fn octWrap(v: vec2f) -> vec2f {
    return (1.0 - abs(v.yx)) * select(-1.0, 1.0, all(v.xy > vec2f(0)));
  }
  
  fn encodeNormal(n: vec3f) -> vec2f {
    let p = sqrt(n.z * 8 + 8);
    return vec2f(n.xy / p + 0.5);
  }
 
  fn decodeNormal(enc: vec2f) -> vec3f {
    let fenc = enc * 4 - 2;
    let f = dot(fenc, fenc);
    let g = sqrt(1 - f / 4);
    let n = vec3f(fenc * g, 1 - f / 2);
    return n;
}
`;

export default NormalEncoderShaderUtils;
