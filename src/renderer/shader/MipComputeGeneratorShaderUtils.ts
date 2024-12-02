export const MipComputeGeneratorShaderEntryFn = "computeMipMap";

export const GetMipComputeGeneratorShaderUtils = (
	textureFormat: GPUTextureFormat = "rgba8unorm",
): string => /* wgsl */ `
  @group(0) @binding(0) var prevMipLevel: texture_2d<f32>;
  @group(0) @binding(1) var nextMipLevel: texture_storage_2d<${textureFormat}, write>;

  @compute @workgroup_size(8, 8)
  fn ${MipComputeGeneratorShaderEntryFn}(@builtin(global_invocation_id) id: vec3u) {
    let offset = vec2<u32>(0, 1);
    let color = (
        textureLoad(prevMipLevel, 2 * id.xy + offset.xx, 0) +
        textureLoad(prevMipLevel, 2 * id.xy + offset.xy, 0) +
        textureLoad(prevMipLevel, 2 * id.xy + offset.yx, 0) +
        textureLoad(prevMipLevel, 2 * id.xy + offset.yy, 0)
    ) * 0.25;
    textureStore(nextMipLevel, id.xy, color);
  }
`;
