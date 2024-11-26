const CSM_SHADOW_SHADER_CHUNK_SRC = /* wgsl */ `

  @must_use
  fn ShadowLayerIdxCalculate(
    worldPos: vec3f,
    camera: ptr<uniform, CameraUniform>,
    shadowCascades: array<ShadowCascade, 3>
  ) -> i32 {
  let fragPosViewSpace = (*camera).viewMatrix * vec4f(worldPos, 1.0);
  let depthValue = abs(fragPosViewSpace.z);

  var layer: i32 = -1;
  let cascadesCount: i32 = 2;
  // for (var i: i32 = 0; i < settings.cascadesCount; ++i) {
    for (var i: i32 = 0; i < cascadesCount; i++) {
      if (depthValue < shadowCascades[i].distance) {
        layer = i;
        break;
      }
    }

    if (layer == -1) {
      // layer = settings.cascadesCount;
      layer = cascadesCount;
    }
    return layer;
  }

  fn ShadowCalculate(
    worldPos: vec3f,
    N: vec3f,
    lightPosition: vec3f,
    camera: ptr<uniform, CameraUniform>,
    shadowTextureWidth: f32,
    shadowTextureHeight: f32,
    shadowCascades: array<ShadowCascade, 3>,
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

    // calculate bias (based on depth map resolution and slope)
    //  float bias = max(0.05 * (dot(normal, lightDir)), 0.05);
    let biasModifier = 2.0;
    //
    var bias = max(0.05 * (1.0 - dot(N, lightDir)), 0.05);
    bias *= 1 / (shadowCascades[layer].distance * biasModifier);

    // PCF
    var shadow: f32 = 0;
    let texSize = vec2f(shadowTextureWidth, shadowTextureHeight);
    let texelSize = 1.0 / texSize;
    for (var x = -1; x <= 1; x++) {
      for (var y = -1; y <= 1; y++) {
        let uv = projCoords.xy + vec2f(f32(x), f32(y)) * texelSize;
        let pcfDepth = textureSample(shadowDepthTexture, shadowDepthSampler, uv, layer);
        // shadow += (currentDepth - bias) < pcfDepth ? 1 : 0.5;
        shadow += select(1.0, 0.0, (currentDepth - bias > pcfDepth));
      }
    }
    shadow /= 9;

    if (projCoords.z > 1.0) {
      return 0;
    }

    return shadow;
  }
`;

export default CSM_SHADOW_SHADER_CHUNK_SRC;
