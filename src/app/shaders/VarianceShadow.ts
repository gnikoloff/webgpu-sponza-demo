export const VARIANCE_SHADOW_SHADER_ENTRY_FN = "main";

export const VARIANCE_SHADOW_SHADER_SRC = /* wgsl */ `

  @group(0) @binding(0) var srcTexture: texture_depth_2d;
  @group(0) @binding(1) var outTexture: texture_storage_2d<rg32float, write>;

  override WORKGROUP_SIZE_X: u32;
  override WORKGROUP_SIZE_Y: u32;

  @compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y)
  fn ${VARIANCE_SHADOW_SHADER_ENTRY_FN}(
    @builtin(global_invocation_id) tid : vec3u,
  ) {
    let texSize = textureDimensions(srcTexture);
    if (any(tid.xy > texSize)) {
      return;
    }

    let src = textureLoad(srcTexture, tid.xy, 0);
    textureStore(outTexture, tid.xy, vec4f(src, src * src, 0, 0));
  }
`;
