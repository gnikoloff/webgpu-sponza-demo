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
    projCoords.x = projCoords.x * 0.5 + 0.5;
    projCoords.y = projCoords.y * 0.5 + 0.5;
    projCoords.y = 1 -  projCoords.y;
    let uv = projCoords.xy;

    var shadow = 0.0;

    let texelSize = 1 / vec2f(shadowTextureWidth, shadowTextureHeight);

    for (var y = -2; y <= 2; y++) {
      for (var x = -2; x <= 2; x++) {
        let uv = projCoords.xy + vec2f(f32(x), f32(y)) * texelSize;
        let pcfDepth = textureSampleCompareLevel(
          shadowDepthTexture,
          shadowDepthSampler,
          uv,
          layer,
          projCoords.z
        );
        shadow += pcfDepth;
      }
    }

    shadow /= 16;

    return shadow;
  }
`

export default CSMShadowShaderUtils
