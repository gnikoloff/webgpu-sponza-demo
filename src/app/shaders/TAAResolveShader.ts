export const TAA_RESOLVE_FRAGMENT_SHADER_ENTRY_NAME = "main";

export const TAA_RESOLVE_FRAGMENT_SHADER_SRC = /*wgsl*/ `

  @group(0) @binding(0) var colorTexture: texture_2d<f32>;
  @group(0) @binding(1) var velocityTexture: texture_2d<f32>;
  @group(0) @binding(2) var historyTexture: texture_2d<f32>;

  @fragment
  fn ${TAA_RESOLVE_FRAGMENT_SHADER_ENTRY_NAME}(@builtin(position) coord: vec4f) -> @location(0) vec4f {
    let pixelCoords = vec2i(floor(coord.xy));
    let currColor = textureLoad(colorTexture, pixelCoords, 0).xyz;
    let velocity = textureLoad(velocityTexture, pixelCoords, 0).xy;
    let prevousPixelPos = vec2i(floor(coord.xy - velocity));
    
    var history = textureLoad(historyTexture, prevousPixelPos, 0).xyz;

    let nearColor0 = textureLoad(colorTexture, pixelCoords + vec2i(1, 0), 0).xyz;
    let nearColor1 = textureLoad(colorTexture, pixelCoords + vec2i(0, 1), 0).xyz;
    let nearColor2 = textureLoad(colorTexture, pixelCoords + vec2i(-1, 0), 0).xyz;
    let nearColor3 = textureLoad(colorTexture, pixelCoords + vec2i(0, -1), 0).xyz;
    
    let boxMin = min(currColor, min(nearColor0, min(nearColor1, min(nearColor2, nearColor3))));
    let boxMax = max(currColor, max(nearColor0, max(nearColor1, max(nearColor2, nearColor3))));;
    
    history = clamp(history, boxMin, boxMax);


    let modulationFactor: f32 = 0.9;
    var color = vec4f(mix(currColor, history, modulationFactor), 1.0);

    // color = color / (color + vec4f(vec3f(1.0), 0.0));
    // // gamma correct
    // color = pow(color, vec4f(vec3f(1.0/2.2), 1.0)); 

    return color;
  }
`;
