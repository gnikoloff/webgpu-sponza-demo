import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";
import { LightPassType } from "../../types";
import { RenderPassType } from "../../renderer/types";

export const GBufferVertexEntryFn = "pointLightVertex";

const GetGBufferVertexShader = (
	lightPassType: LightPassType,
): string => wgsl/* wgsl */ `

  ${SHADER_CHUNKS.VertexInput}
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.CameraUniform}
  ${SHADER_CHUNKS.Light}

  #if ${lightPassType === RenderPassType.PointLightsStencilMask}
  @group(0) @binding(0) var<uniform> camera: CameraUniform;
  @group(0) @binding(1) var<storage, read> lightsBuffer: array<Light>;
  #else
  @group(0) @binding(0) var normalTexture: texture_2d<f32>;
  @group(0) @binding(1) var colorTexture: texture_2d<f32>;
  @group(0) @binding(2) var depthTexture: texture_depth_2d;
  @group(0) @binding(3) var aoTexture: texture_2d<f32>;
  @group(0) @binding(4) var<uniform> camera: CameraUniform;
  #endif

  #if ${
		lightPassType === RenderPassType.PointLightsLighting ||
		lightPassType === RenderPassType.DirectionalAmbientLighting
	}
  @group(0) @binding(5) var<storage, read> lightsBuffer: array<Light>;
  @group(0) @binding(6) var<uniform> debugLights: f32;
  #endif

  #if ${lightPassType === RenderPassType.PointLightsNonCulledLighting}

  @group(1) @binding(0) var<uniform> cameraCulledPointLight: Light;

  #endif

  @vertex
  fn ${GBufferVertexEntryFn}(
    @builtin(instance_index) instanceId: u32,
    in: VertexInput
  ) -> VertexOutput {
    #if ${lightPassType === RenderPassType.PointLightsNonCulledLighting}
      let light = cameraCulledPointLight;
      let trueInstanceId = 0u;
    #else
      let trueInstanceId = instanceId;
      let light = lightsBuffer[trueInstanceId];
    #endif

    var position = in.position;
    position *= vec4f(vec3f(light.radius), 1.0);
    position += vec4f(light.position, 0.0);
    let pos = camera.projectionViewMatrix * position;

    var out: VertexOutput;
    out.position = pos;
    out.instanceId = trueInstanceId;
    return out;
  }
`;

export default GetGBufferVertexShader;
