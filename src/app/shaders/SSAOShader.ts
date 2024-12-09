import NormalEncoderShaderUtils from "../../renderer/shader/NormalEncoderShaderUtils";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

export const SSAOShaderName = "fragSSAO";
export const SSSAOBlurShaderName = "fragBlurSSAO";

const SSAOShaderSrc = /* wgsl */ `
  ${SHADER_CHUNKS.CameraUniform}
  ${SHADER_CHUNKS.VertexOutput}
  ${SHADER_CHUNKS.MathHelpers}

  ${NormalEncoderShaderUtils}

  @group(0) @binding(0) var normalMetallicRoughnessTex: texture_2d<f32>;
  @group(0) @binding(1) var depthTexture: texture_depth_2d;
  @group(0) @binding(2) var noiseTexture: texture_2d<f32>;
  @group(0) @binding(3) var<storage, read> kernelBuffer: array<vec4f>;
  @group(0) @binding(4) var<uniform> camera: CameraUniform;

  @group(1) @binding(0) var ssaoTexture: texture_2d<f32>;

  @fragment
  fn ${SSSAOBlurShaderName}(in: VertexOutput) -> @location(0) vec4f {
    let coord = in.position;
    let pixelCoords = vec2i(floor(coord.xy));
    var result = 0.0;
    for (var y = -2; y < 2; y++) {
      for (var x = -2; x < 2; x++) {
        let offset = pixelCoords + vec2i(x, y);
        result += textureLoad(ssaoTexture, offset, 0).r;
      }
    }
    return vec4f(result / 16.0, 0, 0, 1);
  }

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
    var randomVec = textureLoad(noiseTexture, sampleCoords, 0).rgb * 2 - 1;
    randomVec = (camera.viewMatrix * vec4f(randomVec, 0)).xyz;

    

    let tangent = normalize(randomVec - viewNormal * dot(randomVec, viewNormal));
    let bitangent = cross(viewNormal, tangent);
    let TBN = mat3x3f(tangent, bitangent, viewNormal);

    

    const kernelSize = 32u;
    const radius = 0.35f;

    var occlusion = 0.0;

    let screenSize = vec2i(textureDimensions(depthTexture).xy);

    

    for (var i = 0u; i < kernelSize; i++) {
      var samplePos = TBN * kernelBuffer[i].xyz;
      samplePos = viewSpacePos + samplePos * radius;

      let clipPos = camera.projectionMatrix * vec4f(samplePos, 1.0);
      let ndcPos = clipPos.xyz / clipPos.w;

      var uv = ndcPos.xy * 0.5 + 0.5;
      uv.y = 1.0 - uv.y;
      let screenCoord = vec2i(uv * vec2f(screenSize));

      
      if (screenCoord.x < 0 || screenCoord.x >= screenSize.x || 
          screenCoord.y < 0 || screenCoord.y >= screenSize.y) {
          continue;
      }

      let sampleDepth = textureLoad(depthTexture, screenCoord, 0);

      let sampleOffsetViewPos = calcViewSpacePos(camera, vec2f(screenCoord.xy), sampleDepth);
      let rangeCheck = smoothstep(0.0, 1.0, radius / abs(viewSpacePos.z - sampleOffsetViewPos.z));

      let bias = 0.015;
      occlusion += select(
        0.0,
        1.0,
        sampleOffsetViewPos.z >= samplePos.z + bias
      ) * rangeCheck;
    }
    // return vec4f(1, 0, 0, 1);

    occlusion = 1 - (occlusion / f32(kernelSize));
    // // occlusion = pow(occlusion, 1);

    return vec4f(vec3f(occlusion), 1);

    // let near: f32 = 0.1; // Example near plane
    // let far: f32 = 0.8; // Example far plane
    // let depth_linear = near * far / (far - centerDepth * (far - near));
    // return vec4f(depth_linear, 0, 0, 1);
  }
`;

export default SSAOShaderSrc;
