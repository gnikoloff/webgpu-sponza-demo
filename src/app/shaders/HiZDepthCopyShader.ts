export const HI_Z_COPY_DEPTH_COMPUTE_SHADER_ENTRY_FN = "copyDepth";

export const HI_Z_COPY_DEPTH_COMPUTE_SHADER_SRC = /* wgsl */ `

  @group(0) @binding(0) var sourceDepth: texture_depth_2d;
  @group(0) @binding(1) var destDepth: texture_storage_2d<r32float, write>;

  override WORKGROUP_SIZE_X: u32;
  override WORKGROUP_SIZE_Y: u32;

  @compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y)
  fn ${HI_Z_COPY_DEPTH_COMPUTE_SHADER_ENTRY_FN}(@builtin(global_invocation_id) pos : vec3u) {
    let texSize = textureDimensions(sourceDepth);
    
    if (any(pos.xy > texSize)) {
      return;
    }

    let src = textureLoad(sourceDepth, pos.xy, 0);
    textureStore(destDepth, pos.xy, vec4f(src));
  }

`;
