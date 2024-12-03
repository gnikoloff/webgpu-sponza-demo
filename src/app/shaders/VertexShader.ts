import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";
import {
	BIND_GROUP_LOCATIONS,
	PBR_TEXTURES_LOCATIONS,
} from "../../renderer/core/RendererBindings";

export const DefaultVertexShaderEntryFn = "vertexMain";

export const FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME =
	"fullScreeenTriVertex";

export const FULLSCREEN_TRIANGLE_VERTEX_SHADER_SRC = /* wgsl */ `
  ${SHADER_CHUNKS.VertexOutput}

  @vertex
  fn ${FULLSCREEN_TRIANGLE_VERTEX_SHADER_ENTRY_NAME}(
    @builtin(vertex_index) vertexId: u32,
    @builtin(instance_index) instanceId: u32,
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
  ${SHADER_CHUNKS.InstanceInput}

  @group(${BIND_GROUP_LOCATIONS.CameraPlusOptionalLights}) @binding(0) var<uniform> camera: CameraUniform;
  @group(${BIND_GROUP_LOCATIONS.Model}) @binding(0) var<uniform> model: ModelUniform;
  
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${PBR_TEXTURES_LOCATIONS.Albedo}) var albedoTexture: texture_2d<f32>;
  @group(${BIND_GROUP_LOCATIONS.PBRTextures}) @binding(${PBR_TEXTURES_LOCATIONS.Normal}) var normalTexture: texture_2d<f32>;

  #if ${isInstanced}
    @group(${BIND_GROUP_LOCATIONS.InstanceInputs}) @binding(0) var<storage> instanceInputs: array<InstanceInput>;
  #endif

  @vertex
  fn ${DefaultVertexShaderEntryFn}(
    @builtin(instance_index) instanceId: u32,
    in: VertexInput
  ) -> VertexOutput {
    var position = in.position;

    var worldMatrix: mat4x4f;
    var prevWorldMatrix: mat4x4f;

    #if ${isInstanced}
      worldMatrix = instanceInputs[instanceId].worldMatrix * model.worldMatrix;
      prevWorldMatrix = instanceInputs[instanceId].worldMatrix * model.prevFrameWorldMatrix;
    #else
      worldMatrix = model.worldMatrix;
      prevWorldMatrix = model.prevFrameWorldMatrix;
    #endif

    var out: VertexOutput;
    let worldPosition = worldMatrix * in.position;
    out.position = camera.projectionViewMatrix * worldPosition;
    out.worldPosition = worldPosition.xyz;

    // var jitterOffset = camera.jitterOffset;
    // jitterOffset.x = ((jitterOffset.x - 0.5) / f32(camera.viewportWidth)) * 2;
    // jitterOffset.y = ((jitterOffset.y - 0.5) / f32(camera.viewportHeight)) * 2;

    out.position += vec4f(camera.jitterOffset * out.position.w, 0, 0);

    out.currFrameClipPos = out.position;
    out.prevFrameClipPos = camera.prevFrameProjectionViewMatrix * prevWorldMatrix * in.position;
    
    let T = normalize(model.normalMatrix * in.tangent.xyz);
    let N = normalize(model.normalMatrix * in.normal);
    let B = normalize(cross(N, T));

    out.tangent = T;
    out.bitangent = B;
    out.normal = N;
    out.instanceId = instanceId;
    out.uv = in.uv;

    return out;
  }
`;
