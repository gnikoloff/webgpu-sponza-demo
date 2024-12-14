import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

export const LINE_DEBUG_VERTEX_SHADER_ENTRY_FN = "vertexMain";
export const LINE_DEBUG_FRAGMENT_SHADER_ENTRY_FN = "fragmentMain";

export const LINE_DEBUG_SHADER_SRC = /* wgsl */ `
  ${SHADER_CHUNKS.CameraUniform}

  @group(${BIND_GROUP_LOCATIONS.CameraPlusOptionalLights}) @binding(0) var<uniform> camera: CameraUniform;

  @group(1) @binding(0) var<storage, read> linePointPositions: array<vec4f>;

  @vertex
  fn ${LINE_DEBUG_VERTEX_SHADER_ENTRY_FN}(
    @builtin(vertex_index) vertexId: u32,
  ) -> @builtin(position) vec4f {
    let position = linePointPositions[vertexId];
    return camera.projectionViewMatrix * position;
  }

  @fragment
  fn ${LINE_DEBUG_FRAGMENT_SHADER_ENTRY_FN}() -> @location(0) vec4f {
    return vec4f(vec3f(1), 1);
  }
`;
