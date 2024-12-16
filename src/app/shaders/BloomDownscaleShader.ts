export const BloomDownscaleShaderEntryFn = "main";

export const BloomDownscaleShaderSrc = /* wgsl */ `
  @group(0) @binding(0) var srcTexture: texture_2d<f32>;
  @group(0) @binding(1) var outTexture: texture_storage_2d<rgba16float, write>;
  @group(0) @binding(2) var srcSampler: sampler;

  override WORKGROUP_SIZE_X: u32;
  override WORKGROUP_SIZE_Y: u32;

  @compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y)
  fn ${BloomDownscaleShaderEntryFn}(
    @builtin(global_invocation_id) tid : vec3u,
  ) {
    let outTexSize = textureDimensions(outTexture);

    if (any(tid.xy >= outTexSize)) {
      return;
    }

    let srcTexSize = vec2f(textureDimensions(srcTexture));
    
    let texelSize = vec2f(1.0) / srcTexSize;
    let x = texelSize.x;
    let y = texelSize.y;

    let texCoords = vec2f(f32(tid.x) / f32(outTexSize.x), f32(tid.y) / f32(outTexSize.y));

    // Take 13 samples around current texel:
    // a - b - c
    // - j - k -
    // d - e - f
    // - l - m -
    // g - h - i
    // === ('e' is the current texel) ===
    let a = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x - 2 * x, texCoords.y + 2 * y), 0).rgb;
    let b = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x,         texCoords.y + 2 * y), 0).rgb;
    let c = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x + 2 * x, texCoords.y + 2 * y), 0).rgb;

    let d = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x - 2 * x, texCoords.y), 0).rgb;
    let e = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x,         texCoords.y), 0).rgb;
    let f = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x + 2 * x, texCoords.y), 0).rgb;

    let g = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x - 2 * x, texCoords.y - 2 * y), 0).rgb;
    let h = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x,         texCoords.y - 2 * y), 0).rgb;
    let i = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x + 2 * x, texCoords.y - 2 * y), 0).rgb;

    let j = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x - x, texCoords.y + y), 0).rgb;
    let k = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x + x, texCoords.y + y), 0).rgb;
    let l = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x - x, texCoords.y - y), 0).rgb;
    let m = textureSampleLevel(srcTexture, srcSampler, vec2(texCoords.x + x, texCoords.y - y), 0).rgb;

    // Apply weighted distribution:
    // 0.5 + 0.125 + 0.125 + 0.125 + 0.125 = 1
    // a,b,d,e * 0.125
    // b,c,e,f * 0.125
    // d,e,g,h * 0.125
    // e,f,h,i * 0.125
    // j,k,l,m * 0.5
    // This shows 5 square areas that are being sampled. But some of them overlap,
    // so to have an energy preserving downsample we need to make some adjustments.
    // The weights are the distributed, so that the sum of j,k,l,m (e.g.)
    // contribute 0.5 to the final color output. The code below is written
    // to effectively yield this sum. We get:
    // 0.125*5 + 0.03125*4 + 0.0625*4 = 1
    var downsample = e * 0.125;
    downsample += (a + c + g + i) * 0.03125;
    downsample += (b + d + f + h) * 0.0625;
    downsample += (j + k + l + m) * 0.125;
    
    textureStore(outTexture, tid.xy, vec4f(downsample, 1.0));
    // textureStore(outTexture, tid.xy, vec4f(texCoords, 0.0, 1.0));
  }
`;
