export const BLUR_MOMENTS_AXIS_GAUSSIAN_SHADER_ENTRY_FN = "main";

export const BLUR_MOMENTS_AXIS_GAUSSIAN_SHADER_SRC = /* wgsl */ `
  const GAUSSIAN_KERNEL = array<f32, 5>(
    0.0625,  // 1/16
    0.25,    // 1/4
    0.375,   // 3/8
    0.25,    // 1/4
    0.0625   // 1/16
  );
  const KERNEL_RADIUS = 2;


  @group(0) @binding(0) var srcTexture: texture_2d<f32>;
  @group(0) @binding(1) var outTexture: texture_storage_2d<rg32float, write>;
  @group(0) @binding(2) var srcSampler: sampler;
  @group(0) @binding(3) var<uniform> direction: u32;

  override WORKGROUP_SIZE_X: u32;
  override WORKGROUP_SIZE_Y: u32;

  @compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y)
  fn ${BLUR_MOMENTS_AXIS_GAUSSIAN_SHADER_ENTRY_FN}(
    @builtin(global_invocation_id) tid : vec3u,
  ) {
    let texSize = textureDimensions(srcTexture);
    if (any(tid.xy > texSize)) {
      return;
    }

    var blurredColor: vec4f;

    if (direction == 0u) {
      blurredColor = horizontalBlur(tid, texSize);
    } else {
      blurredColor = verticalBlur(tid, texSize);
    }
    textureStore(outTexture, tid.xy, blurredColor);
  }

  fn horizontalBlur(tid: vec3u, texSize: vec2u) -> vec4f {
    var blurredColor = vec4f(0.0, 0.0, 0.0, 0.0);
    
    for (var i = -KERNEL_RADIUS; i <= KERNEL_RADIUS; i++) {
      // Clamp texture coordinates to prevent out-of-bounds sampling
      let sampleX = clamp(
        i32(tid.x) + i, 
        0, 
        i32(texSize.x - 1)
      );
      
      let sampleCoords = vec2f(f32(sampleX), f32(tid.y)) / vec2f(texSize);
      let sampleColor = textureSampleLevel(srcTexture, srcSampler, sampleCoords, 0);
      
      // Apply Gaussian kernel weight
      let weight = GAUSSIAN_KERNEL[i + KERNEL_RADIUS];
      blurredColor += sampleColor * weight;
    }
    
    return blurredColor;
  }

  fn verticalBlur(tid: vec3u, texSize: vec2u) -> vec4f {
    var blurredColor = vec4f(0.0, 0.0, 0.0, 0.0);
      
    for (var i = -KERNEL_RADIUS; i <= KERNEL_RADIUS; i++) {
      // Clamp texture coordinates to prevent out-of-bounds sampling
      let sampleY = clamp(
        i32(tid.y) + i, 
        0, 
        i32(texSize.y - 1)
      );
      
      let sampleCoords = vec2f(f32(tid.x), f32(sampleY)) / vec2f(texSize);
      let sampleColor = textureSampleLevel(srcTexture, srcSampler, sampleCoords, 0);
      
      // Apply Gaussian kernel weight
      let weight = GAUSSIAN_KERNEL[i + KERNEL_RADIUS];
      blurredColor += sampleColor * weight;
    }
    
    return blurredColor;
  }
`;
