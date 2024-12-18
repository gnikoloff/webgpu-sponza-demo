import { SHADER_CHUNKS } from './chunks'

export const FullScreenVertexShaderEntryFn = 'fullscreenVertex'

const FullScreenVertexShaderUtils = /* wgsl */ `
  ${SHADER_CHUNKS.VertexOutput}

  const pos = array(
    vec2(-1.0, -1.0), vec2(3, -1.0), vec2(-1.0, 3),
  );
  const uv = array(
    vec2(0.0, 0.0), vec2(2.0, 0.0), vec2(0.0, 2.0)
  );

  @vertex
  fn ${FullScreenVertexShaderEntryFn}(
    @builtin(vertex_index) vertexId: u32,
    @builtin(instance_index) instanceId: u32,
  ) -> VertexOutput {
    var out: VertexOutput;
    out.position = vec4f(pos[vertexId], 0.0, 1.0);
    out.uv = uv[vertexId];
    out.instanceId = instanceId;
    return out;
  }
`

export default FullScreenVertexShaderUtils
