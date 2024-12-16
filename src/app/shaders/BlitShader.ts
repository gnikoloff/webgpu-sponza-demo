export const BLIT_FRAGMENT_SHADER_ENTRY_NAME = "blit";

export const BLIT_FRAGMENT_SHADER_SRC = /* wgsl */ `
  @group(0) @binding(0) var bloomTexture: texture_2d<f32>;
  @group(0) @binding(1) var sceneTexture: texture_2d<f32>;
  @group(0) @binding(2) var<uniform> bloomMixFactor: f32;

  @must_use
  fn ACESFilm(x: vec3f) -> vec3f {
    let a = 2.51f;
    let b = 0.03f;
    let c = 2.43f;
    let d = 0.59f;
    let e = 0.14f;
    return saturate((x*(a*x+b))/(x*(c*x+d)+e));
  }

  @fragment
  fn ${BLIT_FRAGMENT_SHADER_ENTRY_NAME}(@builtin(position) coord : vec4f) -> @location(0) vec4f {
    var bloomColor = textureLoad(bloomTexture, vec2i(floor(coord.xy)), 0).xyz;
    var color = textureLoad(sceneTexture, vec2i(floor(coord.xy)), 0).xyz;

    // bloomColor = select(color, bloomColor, bloomColor.r > 0.);

    color = mix(color, bloomColor, bloomMixFactor);
    // color = mix(color, bloomColor, 1);

    color = ACESFilm(color.rgb);
    color = pow(color, vec3f(1.0 / 2.2));
    return vec4f(vec3(color), 1.0);
  }
`;
