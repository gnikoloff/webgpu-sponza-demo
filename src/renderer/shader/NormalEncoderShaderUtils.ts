// https://knarkowicz.wordpress.com/2014/04/16/octahedron-normal-vector-encoding/

const NormalEncoderShaderUtils = /* wgsl */ `
  fn encodeNormal(n: vec3f) -> vec2f {
    // return n.xy* 0.5 + 0.5;
    let p = sqrt(n.z * 8 + 8);
    return n.xy / p + 0.5;
  }
 
  fn decodeNormal(enc: vec2f) -> vec3f {
    
    let fenc = enc * 4 - 2;
    let f = dot(fenc, fenc);
    let g = sqrt(1 - f / 4);
    
    return vec3f(
      fenc * g,
      1 - f / 2
    );
  }
`

export default NormalEncoderShaderUtils
