const IBLShaderHelpers = /* wgsl */ `
  // Van Der Corpus sequence
  // @see http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
  fn vdcSequence(inBits: u32) -> f32 {
    var bits = inBits;
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return f32(bits) * 2.3283064365386963e-10; // / 0x100000000
  }

  // Hammersley sequence
  // @see http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
  fn hammersley(i: u32, N: u32) -> vec2f {
    return vec2f(f32(i) / f32(N), vdcSequence(i));
  }

  // Based on Karis 2014
  // GGX NDF via importance sampling
  fn importanceSampleGGX(Xi: vec2f, N: vec3f, roughness: f32) -> vec3f {
    let alpha = roughness * roughness;
    let alpha2 = alpha * alpha;

    let phi = TWO_PI * Xi.x;
    let cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (alpha2 - 1.0) * Xi.y));
    let sinTheta = sqrt(1.0 - cosTheta * cosTheta);

    // from spherical coordinates to cartesian coordinates
    let H = vec3f(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);

    // from tangent-space vector to world-space sample vector
    
    let up = select(WORLD_UP, WORLD_FORWARD, abs(N.z) < 0.999);
    let tangent = normalize(cross(up, N));
    let bitangent = cross(N, tangent);

    return tangent * H.x + bitangent * H.y + N * H.z;
  }

  fn GTR2(NdotH: f32, a: f32) -> f32 {
    let a2 = a * a;
    let t = 1.0 + (a2 - 1.0) * NdotH * NdotH;
    return step(0.0, NdotH) * a2 / (PI * t * t);
  }

  fn distributionGGX(NdotH: f32, roughness: f32) -> f32 {
    return GTR2(NdotH, roughness * roughness);
  }

  fn visibilitySmithGGXCorrelated(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
    let a2 = roughness * roughness;
    let oneMinusA2 = 1.0 - a2;
    let ggxv = NdotL * sqrt(NdotV * NdotV * oneMinusA2 + a2);
    let ggxl = NdotV * sqrt(NdotL * NdotL * oneMinusA2 + a2);
  
    let ggx = ggxv + ggxl;
    if (ggx > 0.0) {
        return 0.5 / ggx;
    }
    return 0.0;
  }
`

export default IBLShaderHelpers
