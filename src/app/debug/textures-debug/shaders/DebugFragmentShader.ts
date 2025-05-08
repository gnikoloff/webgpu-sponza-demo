import { wgsl } from 'wgsl-preprocessor/wgsl-preprocessor.js'
import NormalEncoderShaderUtils from '../../../../renderer/shader/NormalEncoderShaderUtils'
import { SHADER_CHUNKS } from '../../../../renderer/shader/chunks'
import { TextureDebugMeshType } from '../../../../types'

export const DebugFragmentShaderEntryFn = 'fragmentShaderDebugTexture'

export const getDebugFragmentShader = (
  debugTexType: TextureDebugMeshType
): string => wgsl/* wgsl */ `
  ${SHADER_CHUNKS.VertexOutput}

  ${NormalEncoderShaderUtils}

  @group(0) @binding(0) var colorSampler: sampler;
  @group(0) @binding(1) var depthSampler: sampler;

  #if ${
    debugTexType === TextureDebugMeshType.Depth ||
    debugTexType === TextureDebugMeshType.ShadowDepthCascade0 ||
    debugTexType === TextureDebugMeshType.ShadowDepthCascade1
  }
    @group(0) @binding(2) var myTexture: texture_depth_2d;
  #else
    @group(0) @binding(2) var myTexture: texture_2d<f32>;
  #endif

  @fragment
  fn ${DebugFragmentShaderEntryFn}(in: VertexOutput) -> @location(0) vec4<f32> {
    var uv = in.uv;
    uv.y = 1.0 - uv.y;
    var color: vec4f;
    #if ${debugTexType === TextureDebugMeshType.Normal}
    color = vec4f(decodeNormal(textureSample(myTexture, colorSampler, uv).rg), 1.0);
    // color = vec4f(textureSample(myTexture, colorSampler, uv).rgb, 1.0);
    #elif ${debugTexType === TextureDebugMeshType.Metallic}
    color = vec4f(textureSample(myTexture, colorSampler, uv).bbb, 1.0);
    #elif ${debugTexType === TextureDebugMeshType.Roughness}
    color = vec4f(textureSample(myTexture, colorSampler, uv).aaa, 1.0);
    #elif ${debugTexType === TextureDebugMeshType.Reflectance}
    color = vec4f(textureSample(myTexture, colorSampler, uv).a, 0.0, 0.0, 1.0);
    #elif ${debugTexType === TextureDebugMeshType.Depth}
    let depth = textureSample(myTexture, depthSampler, uv);

    let near: f32 = 0.1; // Example near plane
    let far: f32 = 20.0; // Example far plane

    // Linearize the depth (from clip space depth to linear depth)
    let depth_linear = near * far / (far - depth * (far - near));

    // Normalize the linear depth to [0, 1] (NDC space)
    let depth_ndc = (depth_linear - near) / (far - near);
    color = vec4f(vec3f(depth_ndc), 1);

    #elif ${
      debugTexType === TextureDebugMeshType.ShadowDepthCascade0 ||
      debugTexType === TextureDebugMeshType.ShadowDepthCascade1
    }
    let depth = textureSample(myTexture, depthSampler, uv);

    let near: f32 = 0.1; // Example near plane
    let far: f32 = 1.0; // Example far plane

    // Linearize the depth (from clip space depth to linear depth)
    let depth_linear = near * far / (far - depth * (far - near));

    // Normalize the linear depth to [0, 1] (NDC space)
    let depth_ndc = (depth_linear - near) / (far - near);
    color = vec4f(vec3f(depth_ndc), 1);
    #elif ${debugTexType === TextureDebugMeshType.Velocity}
    color = vec4f(textureSample(myTexture, colorSampler, uv).rg * 100, 0, 1);
    #elif ${debugTexType === TextureDebugMeshType.BDRF}
    color = vec4f(textureSample(myTexture, colorSampler, in.uv).rg, 0, 1);
    #elif ${debugTexType === TextureDebugMeshType.Albedo}
    color = vec4f(textureSample(myTexture, colorSampler, uv).rgb, 1);
    #elif ${debugTexType === TextureDebugMeshType.AO}
    color = vec4f(textureSample(myTexture, colorSampler, uv).rrr, 1);
    #else
    color = textureSample(myTexture, colorSampler, uv);
    #endif
    return color;
  }
`

// import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
// import NormalEncoderShaderUtils from "../../../renderer/shader/NormalEncoderShaderUtils";
// import { SHADER_CHUNKS } from "../../../renderer/shader/chunks";
// import { TextureDebugMeshType } from "../TextureDebugMesh";

// export const DebugFragmentShaderEntryFn = "fragmentShaderDebugTexture";

// export const getDebugFragmentShader = (
// 	debugTexType: TextureDebugMeshType,
// ): string => wgsl/* wgsl */ `
//   ${SHADER_CHUNKS.VertexOutput}

//   ${NormalEncoderShaderUtils}

//   @group(2) @binding(0) var colorSampler: sampler;

//   #if ${
// 		debugTexType === TextureDebugMeshType.Depth ||
// 		debugTexType === TextureDebugMeshType.ShadowDepthCascade0 ||
// 		debugTexType === TextureDebugMeshType.ShadowDepthCascade1
// 	}
//     @group(2) @binding(1) var myTexture: texture_depth_2d;
//   #else
//     @group(2) @binding(1) var myTexture: texture_2d<f32>;
//   #endif

//   @fragment
//   fn ${DebugFragmentShaderEntryFn}(in: VertexOutput) -> @location(0) vec4<f32> {
// var uv = in.uv;
// uv.y = 1.0 - uv.y;
// var color: vec4f;
// #if ${debugTexType === TextureDebugMeshType.Normal}
// color = vec4f(decodeNormal(textureSample(myTexture, colorSampler, uv).rg), 1.0);
// #elif ${debugTexType === TextureDebugMeshType.MetallicRoughness}
// color = vec4f(textureSample(myTexture, colorSampler, uv).rg, 0.0, 1.0);
// #elif ${debugTexType === TextureDebugMeshType.Reflectance}
// color = vec4f(textureSample(myTexture, colorSampler, uv).a, 0.0, 0.0, 1.0);
// #elif ${debugTexType === TextureDebugMeshType.Depth}
// let depth = textureSample(myTexture, colorSampler, uv);

// let near: f32 = 0.1; // Example near plane
// let far: f32 = 10.0; // Example far plane

// // Linearize the depth (from clip space depth to linear depth)
// let depth_linear = near * far / (far - depth * (far - near));

// // Normalize the linear depth to [0, 1] (NDC space)
// let depth_ndc = (depth_linear - near) / (far - near);
// color = vec4f(vec3f(depth_ndc), 1);

// #elif ${
// 	debugTexType === TextureDebugMeshType.ShadowDepthCascade0 ||
// 	debugTexType === TextureDebugMeshType.ShadowDepthCascade1
// }
// let depth = textureSample(myTexture, colorSampler, uv);

// let near: f32 = 0.1; // Example near plane
// let far: f32 = 100.0; // Example far plane

// // Linearize the depth (from clip space depth to linear depth)
// let depth_linear = near * far / (far - depth * (far - near));

// // Normalize the linear depth to [0, 1] (NDC space)
// let depth_ndc = (depth_linear - near) / (far - near);
// color = vec4f(vec3f(depth_ndc), 1);

// #elif ${debugTexType === TextureDebugMeshType.Velocity}
// color = vec4f(textureSample(myTexture, colorSampler, uv).rg * 100, 0, 1);
// #elif ${debugTexType === TextureDebugMeshType.BDRF}
// color = vec4f(textureSample(myTexture, colorSampler, in.uv).rg, 0, 1);
// #else
// // color = textureSample(myTexture, colorSampler, uv);
// color = vec4f(1, 0, 0, 1);
// #endif
// return color;
//   }
// `;
