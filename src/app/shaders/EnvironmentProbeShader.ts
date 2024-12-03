import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

export const EnvironmentProbeShaderEntryFn = "main";

export default /* wgsl */ `
  ${SHADER_CHUNKS.VertexInput}
  ${SHADER_CHUNKS.VertexOutput}

  @group(${BIND_GROUP_LOCATIONS.CameraPlusOptionalLights}) @binding(0) var<storage, read> projViewMatrices: array<mat4x4f>;
  @group(${BIND_GROUP_LOCATIONS.CameraPlusOptionalLights}) @binding(1) var<uniform> currentFace: u32;

  @group(1) @binding(0) var inTexture: texture_2d<f32>;

  @vertex
  fn ${EnvironmentProbeShaderEntryFn}(in: VertexInput) -> VertexOutput {
    let T = normalize(model.normalMatrix * in.tangent.xyz);
    let N = normalize(model.normalMatrix * in.normal);
    let B = normalize(cross(N, T));

    let projViewMatrix = projViewMatrices[currentFace];

    var out: VertexOutput;
    out.position = projViewMatrix * model.worldMatrix * in.position;
    out.uv = in.uv;
    out.tangent = T;
    out.bitangent = B;
    out.normal = N;

    return out;
  }
`;
