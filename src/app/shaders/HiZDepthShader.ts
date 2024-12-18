export const HI_Z_DEPTH_COMPUTE_SHADER_ENTRY_FN = 'computeHiZMips'

export const COMPUTE_HI_Z_DEPTH_COMPUTE_SHADER_SRC = /* wgsl */ `
  @group(0) @binding(0) var prevMipLevel: texture_2d<f32>;
  @group(0) @binding(1) var nextMipLevel: texture_storage_2d<r32float, write>;

  override WORKGROUP_SIZE_X: u32;
  override WORKGROUP_SIZE_Y: u32;  

  @compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y)
  fn ${HI_Z_DEPTH_COMPUTE_SHADER_ENTRY_FN}(@builtin(global_invocation_id) pos : vec3u) {
    let texSize = textureDimensions(prevMipLevel);
    if (any(pos.xy > texSize)) {
      return;
    }

    let depthDim = vec2f(textureDimensions(prevMipLevel).xy);
    let outDepthDim = vec2f(textureDimensions(nextMipLevel).xy);

    let ratio = depthDim / outDepthDim;

    let vReadCoord = vec2u(pos.x << 1, pos.y << 1);
    let vWriteCoord = pos.xy;

    let depthSamples = vec4f(
      textureLoad(prevMipLevel, vReadCoord, 0).r,
      textureLoad(prevMipLevel, vReadCoord + vec2u(1, 0), 0).r,
      textureLoad(prevMipLevel, vReadCoord + vec2u(0, 1), 0).r,
      textureLoad(prevMipLevel, vReadCoord + vec2u(1, 1), 0).r
    );

    var minDepth = min(
      depthSamples.x,
      min(
        depthSamples.y,
        min(depthSamples.z, depthSamples.w)
      )
    );

    let needExtraSampleX = ratio.x > 2.01;
    let needExtraSampleY = ratio.y > 2.01;

    minDepth = select(
      minDepth,
      min(
        minDepth,
        min(
          textureLoad(prevMipLevel, vReadCoord + vec2u(2, 0), 0).r,
          textureLoad(prevMipLevel, vReadCoord + vec2u(2, 1), 0).r
        )
      ),
      needExtraSampleX
    );
    minDepth = select(
      minDepth,
      min(
        minDepth,
        min(
          textureLoad(prevMipLevel, vReadCoord + vec2u(0, 2), 0).r,
          textureLoad(prevMipLevel, vReadCoord + vec2u(1, 2), 0).r
        )
      ),
      needExtraSampleY
    );
    minDepth = select(
      minDepth,
      min(
        minDepth,
        textureLoad(prevMipLevel, vReadCoord + vec2u(2, 2), 0).r
      ),
      needExtraSampleX && needExtraSampleY
    );
    
    textureStore(nextMipLevel, pos.xy, vec4f(minDepth));

  }
`
