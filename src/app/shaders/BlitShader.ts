export const BLIT_FRAGMENT_SHADER_ENTRY_NAME = "blit";

export const BLIT_FRAGMENT_SHADER_SRC = /* wgsl */ `
  @group(0) @binding(0) var sceneTexture: texture_2d<f32>;

  @fragment
  fn ${BLIT_FRAGMENT_SHADER_ENTRY_NAME}(@builtin(position) coord : vec4f) -> @location(0) vec4f {
    let color = textureLoad(sceneTexture, vec2i(floor(coord.xy)), 0).xyz;
    return vec4f(color, 1.0);
  }
`;
