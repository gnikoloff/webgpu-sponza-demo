import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

export const FullscreenTriangleShaderEntryFn = "main";

const FullscreenTriangleShader = /* wgsl */ `
  ${SHADER_CHUNKS.VertexOutput}

  @vertex
  fn ${FullscreenTriangleShaderEntryFn}(
    @builtin(vertex_index) vertexId: u32,
    @builtin(instance_index) instanceId: u32
  ) -> VertexOutput {
    const pos = array(
      vec2(-1.0, -1.0), vec2(3, -1.0), vec2(-1.0, 3),
    );
    var out: VertexOutput;
    out.position = vec4f(pos[vertexId], 0.0, 1.0);
    out.instanceId = instanceId;
    return out;
  }
`;

export default FullscreenTriangleShader;
