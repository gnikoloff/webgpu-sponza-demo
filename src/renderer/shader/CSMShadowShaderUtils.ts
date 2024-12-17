const CSMShadowShaderUtils = /* wgsl */ `

  @must_use
  fn ShadowLayerIdxCalculate(
    worldPos: vec3f,
    camera: CameraUniform,
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
    camera: CameraUniform,
    shadowTextureWidth: f32,
    shadowTextureHeight: f32,
    shadowCascades: array<ShadowCascade, 2>,
    shadowDepthTexture: texture_depth_2d_array,
    shadowDepthSampler: sampler
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

    projCoords.y = 1 - projCoords.y;
    // projCoords.xy = saturate(projCoords.xy);
    // get depth of current fragment from light's perspective
    let currentDepth = projCoords.z;

    let lightDir = normalize(lightPosition);
    // float3 lightDir = normalize(shadowSettings.lightPosition);

    // let biasModifier = 0.5;
    
    // var bias = max(0.05 * (1.0 - dot(N, lightDir)), 0.005);

    // bias *= select(
    //   1 / (shadowCascades[layer].distance * biasModifier),
    //   1 / (100 * biasModifier),
    //   layer == 1
    // );

    // PCF
    var shadow: f32 = 0;
    let texSize = vec2f(shadowTextureWidth, shadowTextureHeight);
    let texelSize = 1.0 / texSize;

    let uv = projCoords.xy;
    let pcfDepth = textureSample(shadowDepthTexture, shadowDepthSampler, uv, layer);
    shadow += select(1.0, 0.0, (currentDepth >= pcfDepth));

    // for (var x = -2; x <= 2; x++) {
    //   for (var y = -2; y <= 2; y++) {
    //     let uv = projCoords.xy + vec2f(f32(x), f32(y)) * texelSize;
    //     let pcfDepth = textureSample(shadowDepthTexture, shadowDepthSampler, uv, layer);
    //     shadow += select(1.0, 0.0, (currentDepth > pcfDepth));
    //   }
    // }
    // shadow /= 16;

    return select(shadow, 0, projCoords.z > 1.0);
  }
`;

export default CSMShadowShaderUtils;
