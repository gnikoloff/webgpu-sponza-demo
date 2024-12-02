import { SHADER_CHUNKS } from "./chunks";

export const DiffuseIBLShaderEntryFn = `main`;

const DiffuseIBLShaderUtils = /* wgsl */ `
  ${SHADER_CHUNKS.CommonHelpers}
  ${SHADER_CHUNKS.MathHelpers}

  @group(0) @binding(0) var inTexture: texture_cube<f32>;
  @group(0) @binding(1) var outTexture: texture_storage_2d<rgba16float, write>;
  @group(0) @binding(2) var cubeSampler: sampler;
  @group(0) @binding(3) var<uniform> face: u32;

  @compute @workgroup_size(8, 8)
  fn ${DiffuseIBLShaderEntryFn}(@builtin(global_invocation_id) id: vec3u) {
    let texSize = textureDimensions(outTexture).xy;
    if (any(id.xy >= texSize)) {
      return;
    }

    let size = vec2f(texSize.xy);
    let uv = vec2f(id.xy) / size;
    
    var ruv = 2.0 * uv - 1.0;
    ruv.y = ruv.y * -1;
    
    var irradiance = vec3f(0.0);
    let rotation = CUBE_ROTATIONS[face];
    let N = normalize(vec3f(ruv, 1.0) * rotateAxisAngle(rotation.xyz, rotation.w));
    var UP = select(WORLD_UP, WORLD_FORWARD, abs(N.z) < 0.999);
    let RIGHT = normalize(cross(UP, N));
    UP = cross(RIGHT, N);

    var sampleCount = 0u;

    for (var phi: f32 = 0.0; phi < TWO_PI; phi += DELTA_PHI) {
      let sinPhi = sin(phi);
      let cosPhi = cos(phi);
      for (var theta: f32 = 0.0; theta < HALF_PI; theta += DELTA_THETA) {
        let sinTheta = sin(theta);
        let cosTheta = cos(theta);

        let tempVec = cosPhi * RIGHT + sinPhi * UP;
        let sampleVector = cosTheta * N + sinTheta * tempVec;

        irradiance += textureSampleLevel(inTexture, cubeSampler, sampleVector, 2).rgb * cos(theta) * sin(theta);
        sampleCount++;
      }
    }
    
    irradiance = PI * irradiance / f32(sampleCount);
    textureStore(outTexture, id.xy, vec4f(irradiance, 1.0));
  }
`;

export default DiffuseIBLShaderUtils;
