// https://knarkowicz.wordpress.com/2014/04/16/octahedron-normal-vector-encoding/

const NORMAL_ENCODER_SHADER_CHUNK = /* wgsl */ `
  fn octWrap(v: vec2f) -> vec2f {
    return (1.0 - abs(v.yx)) * select(-1.0, 1.0, all(v.xy > vec2f(0)));
  }
  
  fn encodeNormal(n: vec3f) -> vec2f {
    let p = sqrt(n.z * 8 + 8);
    return vec2f(n.xy / p + 0.5);
    // let outN = n / (abs(n.x) + abs(n.y) + abs(n.z));
    // return select(octWrap(outN.xy), outN.xy, outN.z >= 0.0) * 0.5 + 0.5;
  }
 
  fn decodeNormal(enc: vec2f) -> vec3f {
    let fenc = enc * 4 - 2;
    let f = dot(fenc, fenc);
    let g = sqrt(1 - f / 4);
    let n = vec3f(fenc * g, 1 - f / 2);
    return n;

    // var outF = f;
    // outF = outF * 2.0 - 1.0;
 
    // // https://twitter.com/Stubbesaurus/status/937994790553227264
    // let n = vec3f(outF.x, outF.y, 1.0 - abs(outF.x) - abs(outF.y));
    // let t = saturate(-n.z);

    // return normalize(vec3f(
    //   n.x + select(t, -t, n.x >= 0.0),
    //   n.y + select(t, -t, n.y >= 0.0),
    //   n.z
    // ));
}
`;

export default NORMAL_ENCODER_SHADER_CHUNK;
