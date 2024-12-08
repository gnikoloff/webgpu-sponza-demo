import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

export const SkyboxShaderVertexEntryFn = "vertexMain";
export const SkyboxShaderFragmentEntryFn = "fragmentMain";

const SkyboxShader = /* wgsl */ `
  ${SHADER_CHUNKS.VertexInput}
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.GBufferOutput}
  ${SHADER_CHUNKS.CameraUniform}
  ${SHADER_CHUNKS.ModelUniform}

  @group(${BIND_GROUP_LOCATIONS.CameraPlusOptionalLights}) @binding(0) var<uniform> camera: CameraUniform;
  @group(1) @binding(0) var inTexture: texture_cube<f32>;
  @group(1) @binding(1) var inSampler: sampler;

  @vertex
  fn ${SkyboxShaderVertexEntryFn}(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    var viewMatrix = camera.viewMatrix;
    viewMatrix[3] = vec4f(0, 0, 0, 1);
    let projViewMatrix = camera.projectionMatrix * viewMatrix;
    let position = in.position;
    out.position = (projViewMatrix * position).xyww;
    // ugly - hijack to compute uvs for frag shader
    out.viewNormal = 0.5 * (in.position.xyz + vec3(1.0, 1.0, 1.0));
    out.uv = in.uv;
    return out;
  }

  @fragment
  fn ${SkyboxShaderFragmentEntryFn}(in: VertexOutput) -> @location(0) vec4f {
    var cubemapVec = in.viewNormal - vec3(0.5);
    let color = textureSampleLevel(inTexture, inSampler, cubemapVec, 3); //7.8);
    return vec4f(color.rgb, 1.0);
    // return vec4f(cubemapVec, 1);
  }
`;

export default SkyboxShader;
