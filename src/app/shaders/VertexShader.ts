import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import {
	BIND_GROUP_LOCATIONS,
	PBR_TEXTURES_LOCATIONS,
} from "../../renderer/core/RendererBindings";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

export const DefaultVertexShaderEntryFn = "vertexMain";

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
    
    let viewSpaceNormMatrix = mat3x3f(
      camera.viewMatrix[0].xyz,
      camera.viewMatrix[1].xyz,
      camera.viewMatrix[2].xyz
    ) * model.normalMatrix;

    let viewTangent = normalize(viewSpaceNormMatrix * in.tangent.xyz);
    let viewNormal = normalize(viewSpaceNormMatrix * in.normal);
    let viewBitangent = normalize(cross(viewNormal, viewTangent)) * in.tangent.w;

    out.viewTangent = viewTangent;
    out.viewBitangent = viewBitangent;
    out.viewNormal = viewNormal;
    out.instanceId = instanceId;
    out.uv = in.uv;

    return out;
  }
`;
