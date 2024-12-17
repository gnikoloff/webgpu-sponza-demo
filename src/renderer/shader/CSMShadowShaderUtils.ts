const CSMShadowShaderUtils = /* wgsl */ `

  @must_use
  fn ShadowLayerIdxCalculate(
    worldPos: vec3f,
    camera: Camera,
    shadowCascades: array<ShadowCascade, 2>
  ) -> i32 {
  let fragPosViewSpace = camera.viewMatrix * vec4f(worldPos, 1.0);
  let depthValue = abs(fragPosViewSpace.z);

  var layer: i32 = -1;
  let cascadesCount: i32 = 2;
    for (var i: i32 = 0; i < cascadesCount; i++) {
      if (depthValue < shadowCascades[i].distance) {
        layer = i;
        break;
      }
    }

    if (layer == -1) {
      layer = 1;
    }
    return layer;
  }


  fn linstep(min: f32, max: f32, v: f32) -> f32 {
    return clamp((v - min) / (max - min), 0, 1);
  }

  fn ReduceLightBleeding(pMax: f32, amount: f32) -> f32 {
    // Remove the [0, Amount] tail and linearly rescale (Amount, 1].
    return linstep(amount, 1, pMax);
  }

  fn ChebyshevUpperBound(moments: vec2f, compare: f32, lightBleedMin: f32) -> f32 {
    // One-tailed inequality valid if t > Moments.x
    let p = select(0.0, 1.0, (compare <= moments.x));
    // Compute variance.
    var variance = moments.y - (moments.x * moments.x);
    variance = max(variance, 0.00001);
    // variance = max(variance, g_MinVariance);
    // Compute probabilistic upper bound.
    let d = compare - moments.x;
    if (d <= 0.0) {
      return 1;
    }
    var pMax = variance / (variance + d * d);
    pMax = ReduceLightBleeding(pMax, lightBleedMin);
    // return 1 - saturate(1 - max(pMax, p));
    return saturate(max(pMax, p));
  }

  fn ShadowCalculate(
    worldPos: vec3f,
    N: vec3f,
    lightPosition: vec3f,
    camera: Camera,
    shadowTextureWidth: f32,
    shadowTextureHeight: f32,
    shadowCascades: array<ShadowCascade, 2>,
    shadowDepthTexture: texture_depth_2d_array,
    shadowDepthSampler: sampler_comparison
  ) -> f32 {

    let layer = ShadowLayerIdxCalculate(
      worldPos,
      camera,
      shadowCascades
    );
    let fragPosLightSpace = shadowCascades[layer].projViewMatrix * vec4f(worldPos, 1.0);

    // perform perspective divide
    var projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform to [0,1] range
    projCoords.x = projCoords.x * 0.5 + 0.5;
    projCoords.y = projCoords.y * 0.5 + 0.5;
    projCoords.y = 1 -  projCoords.y;
    let uv = projCoords.xy;

    
    var shadow = 0.0;

    let texelSize = 1 / vec2f(shadowTextureWidth, shadowTextureHeight);

    // let biasModifier = 0.5;
    // var bias = max(0.05 * (1.0 - dot(N, lightDir)), 0.005);

    // bias *= select(
    //   1 / (shadowCascades[layer].distance * biasModifier),
    //   1 / (100 * biasModifier),
    //   layer == 2
    // );
    
    // select(1.0, 0.0, projCoords.z >= depth);
    for (var y = -2; y <= 2; y++) {
      for (var x = -2; x <= 2; x++) {
        let uv = projCoords.xy + vec2f(f32(x), f32(y)) * texelSize;
        let pcfDepth = textureSampleCompare(
          shadowDepthTexture,
          shadowDepthSampler,
          uv,
          layer,
          projCoords.z
        );
        shadow += select(1.0, 0.0, projCoords.z > pcfDepth);
      }
    }

    shadow /= 16;

    return shadow;
  }
`;

export default CSMShadowShaderUtils;
