import { SHADER_CHUNKS } from "./chunks";

export const FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME =
	"fullScreeenTriVertex";

export const FULLSCREEN_TRIANGLE_VERTEX_SHADER_SRC = /* wgsl */ `
  ${SHADER_CHUNKS.VertexOutput}

  @vertex
  fn ${FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME}(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
    const pos = array(
      vec2(-1.0, -1.0), vec2(3, -1.0), vec2(-1.0, 3),
    );
  
    var out: VertexOutput;
    out.position = vec4f(pos[VertexIndex], 0.0, 1.0);
    return out;
  }
`;

export const GBUFFER_FRAGMENT_SHADER_ENTRY_NAME = "gbufferFragmentShader";

export const GBUFFER_FRAGMENT_SHADER_SRC = /* wgsl */ `
  @group(0) @binding(0) var normalTexture: texture_2d<f32>;
  @group(0) @binding(1) var colorTexture: texture_2d<f32>;

  @fragment
  fn ${GBUFFER_FRAGMENT_SHADER_ENTRY_NAME}(@builtin(position) coord : vec4f) -> @location(0) vec4f {
    let pixelCoords = vec2i(floor(coord.xy));
    let normal = textureLoad(normalTexture, pixelCoords, 0).xyz;
    return vec4f(normal, 1.0);
  }
`;
