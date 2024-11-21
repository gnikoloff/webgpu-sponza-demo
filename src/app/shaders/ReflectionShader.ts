export const REFLECTION_PASS_FRAGMENT_SHADER_ENTRY_NAME = "main";

export const getReflectionComputeShader = (
	pixelFormat: GPUTextureFormat,
): string => /* wgsl */ `
  @group(0) @binding(0) var sceneTexture: texture_2d<f32>;
  @group(0) @binding(1) var outTexture: texture_storage_2d<${pixelFormat}, write>;
  @group(0) @binding(2) var<storage> texSize: vec2u;

  override WORKGROUP_SIZE_X: u32;
  override WORKGROUP_SIZE_Y: u32;

  @compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y)
  fn ${REFLECTION_PASS_FRAGMENT_SHADER_ENTRY_NAME}(@builtin(global_invocation_id) globalInvocationId : vec3<u32>,) {
    let pos = globalInvocationId.xy;

    if (all(pos > texSize)) {
      return;
    }
    let color = textureLoad(sceneTexture, pos, 0);

    textureStore(outTexture, pos, color);
    
  }
`;
