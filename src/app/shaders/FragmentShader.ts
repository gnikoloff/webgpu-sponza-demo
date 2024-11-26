import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import { BIND_GROUP_LOCATIONS } from "../constants";
import { TextureDebugMeshType } from "../debug/TextureDebugMesh";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";
import NORMAL_ENCODER_SHADER_CHUNK from "../../renderer/shader/NormalEncoder";

export const FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN =
	"fragmentMainTexCoords";

export const DEBUG_FRAGMENT_SHADER_SRC = wgsl/* wgsl */ `
${SHADER_CHUNKS.CameraUniform}
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.GBufferOutput}
  ${SHADER_CHUNKS.ModelUniform}

  @group(${BIND_GROUP_LOCATIONS.Camera}) @binding(0) var<uniform> camera: CameraUniform;
  @group(${BIND_GROUP_LOCATIONS.Model}) @binding(0) var<uniform> model: ModelUniform;

  ${NORMAL_ENCODER_SHADER_CHUNK}

  @fragment
  fn ${FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN}(in: VertexOutput) -> GBufferOutput  {
    // return vec4<f32>(in.uv, 0.0, 1.0);
    var uv = in.uv;
    var out: GBufferOutput;
    let encodedNormal = encodeNormal(normalize(in.normal));
    let metallic = model.metallic;
    let roughness = model.roughness;
    out.normalMetallicRoughness = vec4f(encodedNormal, metallic, roughness);
    out.color = vec4f(model.baseColor, f32(model.isReflective));

    var oldPos = in.prevFrameClipPos;
    var newPos = in.currFrameClipPos;
    
    oldPos /= oldPos.w;
    oldPos.x = (oldPos.x+1)/2.0;
    oldPos.y = (oldPos.y+1)/2.0;
    oldPos.y = 1 - oldPos.y;
    
    newPos /= newPos.w;
    newPos.x = (newPos.x+1)/2.0;
    newPos.y = (newPos.y+1)/2.0;
    newPos.y = 1 - newPos.y;

    out.velocity = vec4f((newPos - oldPos).xy, 0, 1);
  

    return out;
  }
`;

export const FRAGMENT_SHADER_DEBUG_TEXTURE_ENTRY_FN =
	"fragmentShaderDebugTexture";

export const getDebugFragmentShader = (
	debugTexType: TextureDebugMeshType,
): string => wgsl/* wgsl */ `
  ${SHADER_CHUNKS.VertexOutput}

  ${NORMAL_ENCODER_SHADER_CHUNK}

  @group(2) @binding(0) var mySampler: sampler;

  #if ${
		debugTexType === TextureDebugMeshType.Depth ||
		debugTexType === TextureDebugMeshType.ShadowDepthCascade0 ||
		debugTexType === TextureDebugMeshType.ShadowDepthCascade1
	}
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
    color = vec4f(decodeNormal(textureSample(myTexture, mySampler, uv).rg), 1.0);
    #elif ${debugTexType === TextureDebugMeshType.MetallicRoughness}
    color = vec4f(textureSample(myTexture, mySampler, uv).rg, 0.0, 1.0);
    #elif ${debugTexType === TextureDebugMeshType.Reflectance}
    color = vec4f(textureSample(myTexture, mySampler, uv).a, 0.0, 0.0, 1.0);
    #elif ${debugTexType === TextureDebugMeshType.Depth}
    let depth = textureSample(myTexture, mySampler, uv);

    let near: f32 = 0.1; // Example near plane
    let far: f32 = 10.0; // Example far plane

    // Linearize the depth (from clip space depth to linear depth)
    let depth_linear = near * far / (far - depth * (far - near));

    // Normalize the linear depth to [0, 1] (NDC space)
    let depth_ndc = (depth_linear - near) / (far - near);
    color = vec4f(vec3f(depth_ndc), 1);

    #elif ${
			debugTexType === TextureDebugMeshType.ShadowDepthCascade0 ||
			debugTexType === TextureDebugMeshType.ShadowDepthCascade1
		}
    let depth = textureSample(myTexture, mySampler, uv);

    let near: f32 = 0.1; // Example near plane
    let far: f32 = 100.0; // Example far plane

    // Linearize the depth (from clip space depth to linear depth)
    let depth_linear = near * far / (far - depth * (far - near));

    // Normalize the linear depth to [0, 1] (NDC space)
    let depth_ndc = (depth_linear - near) / (far - near);
    color = vec4f(vec3f(depth_ndc), 1);

    #elif ${debugTexType === TextureDebugMeshType.Velocity}
    color = vec4f(textureSample(myTexture, mySampler, uv).rg * 100, 0, 1);
    #else
    color = textureSample(myTexture, mySampler, uv);
    #endif
    return color;
  }
`;
