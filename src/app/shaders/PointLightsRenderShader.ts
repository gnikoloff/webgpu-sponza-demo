import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

export const PARTICLES_SHADER_VERTEX_ENTRY_FN = "vertexMain";
export const PARTICLES_SHADER_FRAGMENT_ENTRY_FN = "fragMain";

export const PARTICLES_RENDER_SHADER_SRC = /* wgsl */ `
  ${SHADER_CHUNKS.Particle}
  ${SHADER_CHUNKS.Light}
  ${SHADER_CHUNKS.CameraUniform}

  struct VertexOut {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) @interpolate(flat) instanceId: u32,
  };

  @group(0) @binding(0) var<uniform> camera: CameraUniform;

  @group(1) @binding(0) var<storage, read> particles: array<Particle>;
  @group(1) @binding(1) var<storage, read> lights: array<Light>;

  override ANIMATED_PARTICLES_OFFSET_START: u32;

  const positions = array<vec2f, 4>(
    vec2f(-1.0, -1.0), 
    vec2f(1.0, -1.0),  
    vec2f(-1.0, 1.0),   
    vec2f(1.0, 1.0),   
  );

  const uvs = array<vec2f, 4>(
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 0.0),
  );

  @vertex
  fn ${PARTICLES_SHADER_VERTEX_ENTRY_FN}(
    @builtin(vertex_index) vertexId: u32,
    @builtin(instance_index) instanceId: u32,
  ) -> VertexOut {
    let p = particles[instanceId];
    let particlePosition = p.position;
    let particleRadius = p.radius - p.radius * p.life;
    let uv = uvs[vertexId];
    var out: VertexOut;
    out.position = camera.projectionViewMatrix * vec4f(particlePosition, 1);
    let aspect = f32(camera.viewportWidth) / f32(camera.viewportHeight);
    out.position += vec4f(positions[vertexId].xy * vec2f(particleRadius, particleRadius * aspect), 0, 0);
    out.instanceId = instanceId;
    out.uv = uv;
    return out;
  }

  @fragment
  fn ${PARTICLES_SHADER_FRAGMENT_ENTRY_FN}(
    in: VertexOut
  ) -> @location(0) vec4f {
    let light = &lights[in.instanceId + ANIMATED_PARTICLES_OFFSET_START];
    let d = distance(in.uv, vec2f(0.5));
    let mask = 1.0 - smoothstep(0.2, 0.5, d);
    if (mask < 0.2) {
      discard;
    }
    return vec4f(light.color * mask * 0.8, 1);
  }
`;
