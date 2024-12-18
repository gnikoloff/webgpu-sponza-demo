import NormalEncoderShaderUtils from '../../renderer/shader/NormalEncoderShaderUtils'
import { SHADER_CHUNKS } from '../../renderer/shader/chunks'

export const SSAOShaderName = 'fragSSAO'

const SSAOShaderSrc = /* wgsl */ `
  ${SHADER_CHUNKS.Camera}
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.MathHelpers}

  ${NormalEncoderShaderUtils}

  struct Settings {
    kernelSize: u32,
    radius: f32,
    strength: f32
  };

  @group(0) @binding(0) var normalMetallicRoughnessTex: texture_2d<f32>;
  @group(0) @binding(1) var depthTexture: texture_depth_2d;
  @group(0) @binding(2) var noiseTexture: texture_2d<f32>;
  @group(0) @binding(3) var<storage, read> kernelBuffer: array<vec4f>;
  @group(0) @binding(4) var<uniform> camera: Camera;
  @group(0) @binding(5) var<uniform> settings: Settings; 

  @fragment
  fn ${SSAOShaderName}(
    in: VertexOutput
  ) -> @location(0) vec4f {
    let coord = in.position;
    let pixelCoords = vec2i(floor(coord.xy));
    let encodedN = textureLoad(normalMetallicRoughnessTex, pixelCoords, 0).rg;
    let viewNormal = decodeNormal(encodedN); 
    let centerDepth = textureLoad(depthTexture, pixelCoords, 0);
    let viewSpacePos = calcViewSpacePos(camera, coord.xy, centerDepth);

    let noiseScale = vec2i(textureDimensions(noiseTexture).xy);
    let sampleCoords = pixelCoords % noiseScale;
    var randomVec = textureLoad(noiseTexture, sampleCoords, 0).rgb;
    randomVec = (camera.viewMatrix * vec4f(randomVec, 0)).xyz;

    let viewTangent = normalize(randomVec - viewNormal * dot(randomVec, viewNormal));
    let viewBitangent = cross(viewNormal, viewTangent);
    let TBN = mat3x3f(viewTangent, viewBitangent, viewNormal);

    let kernelSize = settings.kernelSize;
    let radius = settings.radius;

    var occlusion = 0.0;

    let screenSize = vec2i(textureDimensions(depthTexture).xy);

    for (var i = 0u; i < kernelSize; i++) {
      var viewSamplePos = TBN * kernelBuffer[i].xyz;
      viewSamplePos = viewSpacePos + viewSamplePos * radius;

      let viewSampleDir = normalize(viewSamplePos - viewSpacePos);
      let NdotS = max(dot(viewNormal, viewSampleDir), 0.0);

      let clipPos = camera.projectionMatrix * vec4f(viewSamplePos, 1.0);
      let ndcPos = clipPos.xy / clipPos.w;

      let screenCoord = vec2i(vec2f(ndcPos.x * 0.5 + 0.5, -ndcPos.y * 0.5 + 0.5) * vec2f(screenSize));

      var sampleDepth = textureLoad(depthTexture, screenCoord, 0);
      sampleDepth = calcViewSpacePos(camera, vec2f(screenCoord), sampleDepth).z;
      
      let rangeCheck = smoothstep(0.0, 1.0, radius / abs(viewSpacePos.z - sampleDepth));

      occlusion += select(0.0, 1.0, sampleDepth > viewSamplePos.z) * rangeCheck * NdotS;
    }

    occlusion = 1 - (occlusion / f32(kernelSize));
    let finalOcclusion = pow(occlusion, settings.strength);

    return vec4f(finalOcclusion);
  }
`

export default SSAOShaderSrc
