import NormalEncoderShaderUtils from "../../renderer/shader/NormalEncoderShaderUtils";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

export const REFLECTION_PASS_COMPUTE_SHADER_ENTRY_NAME = "main";

export const getReflectionComputeShader = (
	pixelFormat: GPUTextureFormat,
): string => /* wgsl */ `
  ${SHADER_CHUNKS.CameraUniform}

  @group(0) @binding(0) var sceneTexture: texture_2d<f32>;
  @group(0) @binding(1) var normalMetallicRoughnessTexture: texture_2d<f32>;
  @group(0) @binding(2) var albedoReflectanceTexture: texture_2d<f32>;
  @group(0) @binding(3) var depthTexture: texture_depth_2d;
  @group(0) @binding(4) var outTexture: texture_storage_2d<${pixelFormat}, write>;
  @group(0) @binding(5) var<uniform> camera: CameraUniform;

  override WORKGROUP_SIZE_X: u32;
  override WORKGROUP_SIZE_Y: u32;

  ${NormalEncoderShaderUtils}

  fn ComputePosAndReflection(
    tid: vec2u,
    viewNormal: vec3f,
    projectionMatrix: mat4x4f,
    inverseProjectionMatrix: mat4x4f,
    viewportWidth: u32,
    viewportHeight: u32,
    depthTexture: texture_depth_2d,
    outSamplePosInTexSpace: ptr<function, vec3f>,
    outReflDirInTexSpace: ptr<function, vec3f>,
    outMaxDistance: ptr<function, f32>
  ) {
    let sampleDepth = textureLoad(depthTexture, tid, 0);
    var samplePosClipSpace = vec4f(
      ((f32(tid.x) + 0.5) / f32(viewportWidth)) * 2 - 1.0,
      ((f32(tid.y) + 0.5) / f32(viewportHeight)) * 2 - 1.0,
      sampleDepth,
      1
    );
    samplePosClipSpace.y *= -1;
    var samplePosViewSpace = inverseProjectionMatrix * samplePosClipSpace;
    samplePosViewSpace /= samplePosViewSpace.w;
    let vCamToSampleViewSpace = normalize(samplePosViewSpace.xyz);
    let vReflectionViewSpace = vec4f(reflect(vCamToSampleViewSpace.xyz, viewNormal.xyz), 0.0);

    var vReflectionEndPosViewSpace = samplePosViewSpace + vReflectionViewSpace * 1000;
    vReflectionEndPosViewSpace /= select(1.0, vReflectionEndPosViewSpace.z, vReflectionEndPosViewSpace.z > 0.0);
    var vReflectionEndPosClipSpace = projectionMatrix * vec4f(vReflectionEndPosViewSpace.xyz, 1.0);
    vReflectionEndPosClipSpace /= vReflectionEndPosClipSpace.w;

    let vReflectionDir = normalize((vReflectionEndPosClipSpace - samplePosClipSpace).xyz);

    // transform to texture space
    (*outSamplePosInTexSpace) = vec3f(
      samplePosClipSpace.xy * vec2f(0.5, -0.5) + vec2f(0.5, 0.5),
      samplePosClipSpace.z
    );

    (*outReflDirInTexSpace) = vec3f(
      vReflectionDir.xy * vec2f(0.5, -0.5),
      vReflectionDir.z
    );

    (*outMaxDistance) = select(-outSamplePosInTexSpace.x / outReflDirInTexSpace.x, (1 - outSamplePosInTexSpace.x) / outReflDirInTexSpace.x, outReflDirInTexSpace.x >= 0);
    (*outMaxDistance) = min(*outMaxDistance, select((1 - outSamplePosInTexSpace.y) / outReflDirInTexSpace.y, -outSamplePosInTexSpace.y / outReflDirInTexSpace.y, outReflDirInTexSpace.y < 0));
    (*outMaxDistance) = min(*outMaxDistance, select((1 - outSamplePosInTexSpace.z) / outReflDirInTexSpace.z, -outSamplePosInTexSpace.z / outReflDirInTexSpace.z, outReflDirInTexSpace.z < 0));
  }

  fn FindIntersectionLinear(
    samplePosInTexSpace: vec3f,
    reflDirInTexSpace: vec3f,
    maxTraceDistance: f32,
    viewportWidth: u32,
    viewportHeight: u32,
    depthTexture: texture_depth_2d,
    intersection: ptr<function, vec3f>
  ) -> f32 {
    let vReflectionEndPosTexSpace = samplePosInTexSpace + reflDirInTexSpace * maxTraceDistance;
    var dp = vReflectionEndPosTexSpace.xyz - samplePosInTexSpace.xyz;
    let viewSize = vec2f(f32(viewportWidth), f32(viewportHeight));
    let sampleScreenPos = vec2i(samplePosInTexSpace.xy * viewSize);
    let endPosScreenPos = vec2i(vReflectionEndPosTexSpace.xy * viewSize);
    let dp2 = endPosScreenPos - sampleScreenPos;
    let maxDist = max(abs(dp2.x), abs(dp2.y));
    dp /= f32(maxDist);

    var rayPosTexSpace = vec4f(samplePosInTexSpace.xyz + dp, 0);
    let rayDirTexSpace = vec4f(dp.xyz, 0);
    let rayPosStartTexSpace = rayPosTexSpace;

    let MAX_ITERATIONS = 2000;
    let MAX_THICKNESS = 0.001;

    var hitIndex = -1;
    for (var i = 0; i < maxDist && i < MAX_ITERATIONS; i += 4) {
      let rayPosTexSpace0 = rayPosTexSpace + rayDirTexSpace * 0;
      let rayPosTexSpace1 = rayPosTexSpace + rayDirTexSpace * 1;
      let rayPosTexSpace2 = rayPosTexSpace + rayDirTexSpace * 2;
      let rayPosTexSpace3 = rayPosTexSpace + rayDirTexSpace * 3;

      let depth0 = textureLoad(depthTexture, vec2u(rayPosTexSpace0.xy * viewSize), 0);
      let depth1 = textureLoad(depthTexture, vec2u(rayPosTexSpace1.xy * viewSize), 0);
      let depth2 = textureLoad(depthTexture, vec2u(rayPosTexSpace2.xy * viewSize), 0);
      let depth3 = textureLoad(depthTexture, vec2u(rayPosTexSpace3.xy * viewSize), 0);

      var thickness = 0.0;

      thickness = rayPosTexSpace0.z - depth0;
      hitIndex = select(hitIndex, i + 0, thickness >= 0 && thickness < MAX_THICKNESS);

      thickness = rayPosTexSpace1.z - depth1;
      hitIndex = select(hitIndex, i + 1, thickness >= 0 && thickness < MAX_THICKNESS);

      thickness = rayPosTexSpace2.z - depth2;
      hitIndex = select(hitIndex, i + 2, thickness >= 0 && thickness < MAX_THICKNESS);

      thickness = rayPosTexSpace3.z - depth3;
      hitIndex = select(hitIndex, i + 3, thickness >= 0 && thickness < MAX_THICKNESS);

      if (hitIndex != -1) {
        break;
      }

      rayPosTexSpace = rayPosTexSpace3 + rayDirTexSpace;
    }

    let intersected = hitIndex >= 0;
    (*intersection) = rayPosStartTexSpace.xyz + rayDirTexSpace.xyz * f32(hitIndex);

    return select(0.0, 1.0, intersected);
  }

  fn ComputeReflectionColor(
    intensity: f32,
    intersection: vec3f,
    viewportWidth: u32,
    viewportHeight: u32,
    sceneTexture: texture_2d<f32>
  ) -> vec4f {
    let viewSize = vec2f(f32(viewportWidth), f32(viewportHeight));
    let texCoords = vec2u(intersection.xy * viewSize);
    let ssrColor = textureLoad(sceneTexture, texCoords, 0);
    // return mix(vec4f(0.0), ssrColor, intensity);
    return ssrColor;
  }

  @compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y)
  fn ${REFLECTION_PASS_COMPUTE_SHADER_ENTRY_NAME}(@builtin(global_invocation_id) globalInvocationId : vec3u,) {
    let pos = globalInvocationId.xy;

    let encodedN = textureLoad(normalMetallicRoughnessTexture, pos, 0).rg;
    let N = decodeNormal(encodedN);
    let sceneColor = textureLoad(sceneTexture, pos, 0);
    let reflectanceMask = textureLoad(albedoReflectanceTexture, pos, 0).a;

    var reflectionColor = vec4f(0);

    if (reflectanceMask != 0) {
       var samplePosInTexSpace = vec3f(0);
       var reflDirInTexSpace = vec3f(0);
       var maxTraceDistance = 0.0;

       ComputePosAndReflection(
        pos.xy,
        N,
        camera.projectionMatrix,
        camera.inverseProjectionMatrix,
        camera.viewportWidth,
        camera.viewportHeight,
        depthTexture,
        &samplePosInTexSpace,
        &reflDirInTexSpace,
        &maxTraceDistance
       );

       var intersection = vec3f(0);

       let intensity = FindIntersectionLinear(
        samplePosInTexSpace,
        reflDirInTexSpace,
        maxTraceDistance,
        camera.viewportWidth,
        camera.viewportHeight,
        depthTexture,
        &intersection
      );

      reflectionColor = ComputeReflectionColor(
        intensity,
        intersection,
        camera.viewportWidth,
        camera.viewportHeight,
        sceneTexture
      );
      // reflectionColor = vec4f(vec3f(intensity), 1);
    }

    let finalColor = sceneColor + reflectionColor;

    textureStore(outTexture, pos, finalColor);
    
  }
`;
