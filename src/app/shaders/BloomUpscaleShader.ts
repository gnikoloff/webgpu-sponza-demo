import { SHADER_CHUNKS } from '../../renderer/shader/chunks'

export const BloomUpscaleShaderEntryFn = 'main'

export const BloomUpscaleShaderSrc = /* wgsl */ `
  ${SHADER_CHUNKS.VertexOutput}

  @group(0) @binding(0) var srcTexture: texture_2d<f32>;
  @group(0) @binding(1) var srcSampler: sampler;
  @group(0) @binding(2) var<uniform> filterRadius: f32;

  @fragment
  fn ${BloomUpscaleShaderEntryFn}(
    in: VertexOutput
  ) -> @location(0) vec4f {
    let srcSize = vec2f(textureDimensions(srcTexture));
    let aspect = srcSize.x / srcSize.y;

    let x = filterRadius;
    let y = filterRadius * aspect;

    let texCoord = vec2f(in.uv.x, 1 - in.uv.y);

    let a = textureSample(srcTexture, srcSampler, vec2f(texCoord.x - x, texCoord.y + y)).rgb;
    let b = textureSample(srcTexture, srcSampler, vec2f(texCoord.x,     texCoord.y + y)).rgb;
    let c = textureSample(srcTexture, srcSampler, vec2f(texCoord.x + x, texCoord.y + y)).rgb;

    let d = textureSample(srcTexture, srcSampler, vec2f(texCoord.x - x, texCoord.y)).rgb;
    let e = textureSample(srcTexture, srcSampler, vec2f(texCoord.x,     texCoord.y)).rgb;
    let f = textureSample(srcTexture, srcSampler, vec2f(texCoord.x + x, texCoord.y)).rgb;

    let g = textureSample(srcTexture, srcSampler, vec2(texCoord.x - x, texCoord.y - y)).rgb;
    let h = textureSample(srcTexture, srcSampler, vec2(texCoord.x,     texCoord.y - y)).rgb;
    let i = textureSample(srcTexture, srcSampler, vec2(texCoord.x + x, texCoord.y - y)).rgb;

    var upsample = e * 4.0;
    upsample += (b + d + f + h) * 2.0;
    upsample += (a + c + g + i);
    upsample *= 1.0 / 16.0;

    return vec4f(upsample, 1.0);
  }
`
