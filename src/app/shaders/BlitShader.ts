import { wgsl } from 'wgsl-preprocessor/wgsl-preprocessor.js'
import NormalEncoderShaderUtils from '../../renderer/shader/NormalEncoderShaderUtils'
import { BlitRenderMode } from '../constants'

export const BLIT_FRAGMENT_SHADER_ENTRY_NAME = 'blit'

export const getBlitFragmentShaderSrc = (mode: BlitRenderMode) => {
  return wgsl/* wgsl */ `
    ${NormalEncoderShaderUtils}

    @group(0) @binding(0) var inTexture: ${mode === BlitRenderMode.Depth ? 'texture_depth_2d' : 'texture_2d<f32>'};

    @fragment
    fn ${BLIT_FRAGMENT_SHADER_ENTRY_NAME}(@builtin(position) coord : vec4f) -> @location(0) vec4f {
      var color: vec4f;
      #if ${mode === BlitRenderMode.Final}
        color = textureLoad(inTexture, vec2i(floor(coord.xy)), 0);
      #elif ${mode === BlitRenderMode.Albedo}
        color = vec4f(textureLoad(inTexture, vec2i(floor(coord.xy)), 0).rgb, 1.0);
      #elif ${mode === BlitRenderMode.ViewSpaceNormal}
        let normal = textureLoad(inTexture, vec2i(floor(coord.xy)), 0).rg;
        color = vec4f(decodeNormal(normal), 1.0);
      #elif ${mode === BlitRenderMode.Metallic}
        color = vec4f(textureLoad(inTexture, vec2i(floor(coord.xy)), 0).bbb, 1.0);
      #elif ${mode === BlitRenderMode.Roughness}
        color = vec4f(textureLoad(inTexture, vec2i(floor(coord.xy)), 0).aaa, 1.0);
      #elif ${mode === BlitRenderMode.SSAO}
        color = vec4f(textureLoad(inTexture, vec2i(floor(coord.xy)), 0).rrr, 1.0);
      #elif ${mode === BlitRenderMode.Depth}
        let depth = textureLoad(inTexture, vec2i(floor(coord.xy)), 0);
        let near: f32 = 0.1; // Example near plane
        let far: f32 = 20.0; // Example far plane

        // Linearize the depth (from clip space depth to linear depth)
        let depth_linear = near * far / (far - depth * (far - near));
        let depth_ndc = (depth_linear - near) / (far - near);
        color = vec4f(vec3f(depth_ndc), 1.0);
      #elif ${mode === BlitRenderMode.Reflectance}
        color = vec4f(textureLoad(inTexture, vec2i(floor(coord.xy)), 0).a, 0.0, 0.0, 1.0);
      #endif
      return color;
    }
  `
}
