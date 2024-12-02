export const CopyTextureViewShaderUtilsEntryFn = "main";

const CopyTextureViewShaderUtils = /* wgsl */ `
  @group(0) @binding(0) var inTexture: texture_2d<f32>;
  @group(0) @binding(1) var outTexture: texture_storage_2d<rgba16float, write>;
  @group(0) @binding(2) var<uniform> inOutTextureScaleFactor: u32;

  @compute @workgroup_size(8, 8)
  fn ${CopyTextureViewShaderUtilsEntryFn}(@builtin(global_invocation_id) id: vec3u) {
    let texSize = textureDimensions(inTexture, 0).xy;
    if (any(id.xy > texSize.xy)) {
      return;
    }

    let inColor = textureLoad(inTexture, id.xy * inOutTextureScaleFactor, 0);
    textureStore(outTexture, id.xy, inColor);
  }
`;

export default CopyTextureViewShaderUtils;
