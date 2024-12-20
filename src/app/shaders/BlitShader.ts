export const BLIT_FRAGMENT_SHADER_ENTRY_NAME = 'blit'

export const BLIT_FRAGMENT_SHADER_SRC = /* wgsl */ `
  @group(0) @binding(0) var bloomTexture: texture_2d<f32>;
  @group(0) @binding(1) var sceneTexture: texture_2d<f32>;
  @group(0) @binding(2) var<uniform> bloomMixFactor: f32;
  @group(0) @binding(3) var<uniform> time: f32;
  @group(0) @binding(4) var<uniform> revealFactor: f32;

  
  fn ACESFilm(x: vec3f) -> vec3f {
    let v = x;
    let a = 2.51f;
    let b = 0.03f;
    let c = 2.43f;
    let d = 0.59f;
    let e = 0.14f;
    return saturate((v * (a * x + b)) / (x * (c * x + d) + e));
  }

  fn rand (co: vec2f) -> f32 {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }
  
  fn transition(p: vec2f, progress: f32, fromColor: vec3f, toColor: vec3f) -> vec3f {
    let size = vec2(10.0);
    let smoothness = 0.5;
    let r = rand(floor(size * p));
    let m = smoothstep(0.0, -smoothness, r - (progress * (1.0 + smoothness)));
    return mix(fromColor, toColor, m);
  }

  @fragment
  fn ${BLIT_FRAGMENT_SHADER_ENTRY_NAME}(@builtin(position) coord : vec4f) -> @location(0) vec4f {
    var bloomColor = textureLoad(bloomTexture, vec2i(floor(coord.xy)), 0).xyz;
    var color = textureLoad(sceneTexture, vec2i(floor(coord.xy)), 0).xyz;

    let texSize = vec2f(textureDimensions(sceneTexture));
    // bloomColor = select(color, bloomColor, bloomColor.r > 0.);

    color = mix(color, bloomColor, bloomMixFactor);
    // color = mix(color, bloomColor, 1);

    color = ACESFilm(color.rgb);
    color = pow(color, vec3f(1.0 / 2.2));

    let uv = coord.xy / texSize;
    let aspect = texSize.x / texSize.y;
    let timeFactor = 1.0;
    let noise = vec3f(rand(vec2f(uv.x + time * timeFactor, uv.y * aspect + time * timeFactor))) * 0.1;
    color = transition(uv, revealFactor, noise, color);
    return vec4f(vec3(color), 1.0);
  }
`
