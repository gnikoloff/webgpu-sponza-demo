import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

export const SSSAOBlurShaderName = "fragBlurSSAO";

const SSAOBlurShaderSrc = /* wgsl */ `
  ${SHADER_CHUNKS.CameraUniform}
  ${SHADER_CHUNKS.VertexOutput}

  @group(0) @binding(0) var ssaoTexture: texture_2d<f32>;

  @fragment
  fn ${SSSAOBlurShaderName}(in: VertexOutput) -> @location(0) vec4f {
    let coord = in.position;
    let pixelCoords = vec2i(floor(coord.xy));
    var result = 0.0;
    for (var y = -2; y < 2; y++) {
      for (var x = -2; x < 2; x++) {
        let offset = pixelCoords + vec2i(x, y);
        result += textureLoad(ssaoTexture, offset, 0).r;
      }
    }
    return vec4f(result / 16.0, 0, 0, 1);
  }
`;

export default SSAOBlurShaderSrc;
