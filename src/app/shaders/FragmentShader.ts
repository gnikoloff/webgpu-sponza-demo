import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import { BIND_GROUP_LOCATIONS } from "../constants";
import { TextureDebugMeshType } from "../meshes/debug/TextureDebugMesh";
import { SHADER_CHUNKS } from "./chunks";

export const FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN =
	"fragmentMainTexCoords";

export const DEBUG_FRAGMENT_SHADER_SRC = wgsl/* wgsl */ `
${SHADER_CHUNKS.CameraUniform}
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.GBufferOutput}
  ${SHADER_CHUNKS.ModelUniform}

  @group(${BIND_GROUP_LOCATIONS.Camera}) @binding(0) var<uniform> camera: CameraUniform;
  @group(${BIND_GROUP_LOCATIONS.Model}) @binding(0) var<uniform> model: ModelUniform;

  @fragment
  fn ${FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN}(in: VertexOutput) -> GBufferOutput  {
    // return vec4<f32>(in.uv, 0.0, 1.0);
    var uv = in.uv;
    var out: GBufferOutput;
    out.normalReflectance = vec4f(normalize(in.normal), f32(model.isReflective));
    out.color = vec4f(model.baseColor, 1.0);
    return out;
  }
`;

export const FRAGMENT_SHADER_DEBUG_TEXTURE_ENTRY_FN =
	"fragmentShaderDebugTexture";

export const getDebugFragmentShader = (
	debugTexType: TextureDebugMeshType,
): string => wgsl/* wgsl */ `
  ${SHADER_CHUNKS.VertexOutput}

  @group(2) @binding(0) var mySampler: sampler;

  #if ${debugTexType === TextureDebugMeshType.Depth}
    @group(2) @binding(1) var myTexture: texture_depth_2d;
  #else
    @group(2) @binding(1) var myTexture: texture_2d<f32>;
  #endif

  @fragment
  fn ${FRAGMENT_SHADER_DEBUG_TEXTURE_ENTRY_FN}(in: VertexOutput) -> @location(0) vec4<f32> {
    var uv = in.uv;
    uv.y = 1.0 - uv.y;
    var color: vec4f;
    #if ${debugTexType === TextureDebugMeshType.Normal}
    color = vec4f(textureSample(myTexture, mySampler, uv).rgb, 1.0);
    #elif ${debugTexType === TextureDebugMeshType.Reflectance}
    color = vec4f(textureSample(myTexture, mySampler, uv).a, 0.0, 0.0, 1.0);
    #elif ${debugTexType === TextureDebugMeshType.Albedo}
    color = textureSample(myTexture, mySampler, uv);
    #else
    var depth = textureSample(myTexture, mySampler, uv);

    let near: f32 = 0.1; // Example near plane
    let far: f32 = 10.0; // Example far plane

    // Linearize the depth (from clip space depth to linear depth)
    let depth_linear = near * far / (far - depth * (far - near));

    // Normalize the linear depth to [0, 1] (NDC space)
    let depth_ndc = (depth_linear - near) / (far - near);


    color = vec4f(vec3f(depth_ndc), 1);
    #endif
    return color;
  }
`;
