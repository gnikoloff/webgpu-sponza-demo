import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import { BIND_GROUP_LOCATIONS } from "../constants";
import { SHADER_CHUNKS } from "./chunks";

export const VERTEX_SHADER_DEFAULT_ENTRY_FN = "vertexMain";

export interface IVertexShader {
	isInstanced: boolean;
}

export const getVertexShader = (
	{ isInstanced }: IVertexShader = {
		isInstanced: false,
	},
): string => wgsl/* wgsl */ `
  ${SHADER_CHUNKS.VertexInput}
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.ModelUniform}
  ${SHADER_CHUNKS.CameraUniform}

  @group(${BIND_GROUP_LOCATIONS.Camera}) @binding(0) var<uniform> camera: CameraUniform;
  @group(${BIND_GROUP_LOCATIONS.Model}) @binding(0) var<uniform> model: ModelUniform;

  #if ${isInstanced}
  @group(${BIND_GROUP_LOCATIONS.InstanceMatrices}) @binding(0) var<storage> instanceMatrices: array<mat4x4f>;
  #endif

  @vertex
  fn ${VERTEX_SHADER_DEFAULT_ENTRY_FN}(
    @builtin(instance_index) instanceId: u32,
    in: VertexInput
  ) -> VertexOutput {
    var position = in.position;

    var worldMatrix: mat4x4f;

    #if ${isInstanced}
      worldMatrix = instanceMatrices[instanceId] * model.worldMatrix;
    #else
      worldMatrix = model.worldMatrix;
    #endif

    var out: VertexOutput;
    out.position = camera.projectionMatrix * camera.viewMatrix * worldMatrix * in.position;
    out.uv = in.uv;
    out.normal = model.normalMatrix * in.normal;
    return out;
  }
`;
