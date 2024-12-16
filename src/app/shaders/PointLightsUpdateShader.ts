import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

export const POINT_LIGHTS_SHADER_COMPUTE_ENTRY_FN = `updatePointLights`;

export const POINT_LIGHTS_UPDATE_SHADER_SRC = /* wgsl */ `
  ${SHADER_CHUNKS.Particle}
  ${SHADER_CHUNKS.Light}

  struct SimSettings {
    time: f32,
    timeDelta: f32,
  };

  @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
  @group(0) @binding(1) var<storage, read_write> lights: array<Light>;
  @group(0) @binding(2) var<uniform> simSettings: SimSettings;
  @group(0) @binding(3) var<storage, read> linePointPositions: array<vec4f>;

  override WORKGROUP_SIZE_X: u32;
  override WORKGROUP_SIZE_Y: u32;
  override ANIMATED_PARTICLES_OFFSET_START: u32;
  override FIREWORK_PARTICLES_OFFSET: u32;
  override FIREWORK_PARTICLES_COUNT: u32;
  override CURVE_PARTICLES_OFFSET: u32;
  override CURVE_POSITIONS_COUNT: u32;
  
  @must_use
  fn noise(p: vec3f) -> f32 {
    return fract(
      sin(dot(p, vec3f(12.9898, 78.233, 45.164))) * 43758.5453
    );
  }

  @must_use
  fn random(seed: f32) -> f32 {
    return fract(sin(seed * 12.9898) * 43758.5453);
  }

  // Curl noise for more natural 3D fluid-like motion
  fn curlNoise(p: vec3<f32>) -> vec3<f32> {
    let eps = 0.1;
    
    let nx = noise(p + vec3<f32>(eps, 0.0, 0.0));
    let ny = noise(p + vec3<f32>(0.0, eps, 0.0));
    let nz = noise(p + vec3<f32>(0.0, 0.0, eps));
    
    let x = ny - noise(p - vec3<f32>(eps, 0.0, 0.0));
    let y = nz - noise(p - vec3<f32>(0.0, eps, 0.0));
    let z = nx - noise(p - vec3<f32>(0.0, 0.0, eps));
    
    return vec3<f32>(x, y, z) / (2.0 * eps);
  }

  fn interpolateLinePoint(t: f32) -> vec3f {
    let totalCount = CURVE_POSITIONS_COUNT;
    let segmentLength = 1.0 / f32(totalCount - 1u);
    let baseIndex = u32(t / segmentLength);
    let localT = fract(t / segmentLength);
    let safeIndex = min(baseIndex, totalCount - 2u);
    let start = linePointPositions[safeIndex];
    let end = linePointPositions[safeIndex + 1u];
    return mix(start, end, localT).xyz;
  }

  @compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
  fn ${POINT_LIGHTS_SHADER_COMPUTE_ENTRY_FN}(
    @builtin(global_invocation_id) tid : vec3u
  ) {
    let idx = tid.x;
    let particle = &particles[idx];
    let light = &lights[idx + ANIMATED_PARTICLES_OFFSET_START];


    particle.life += particle.lifeSpeed * simSettings.timeDelta;

    if (particle.life >= 1) {
      particle.position = particle.origPosition;
      particle.life = 0;
    }

    if (idx >= FIREWORK_PARTICLES_OFFSET && idx < CURVE_PARTICLES_OFFSET - 4) {
      let turbulence = curlNoise(
        particle.position * 0.05 + 
        vec3<f32>(0.0, simSettings.time * 0.05, 0.0)
      ) * 0.2;

      particle.position += (particle.velocity + turbulence) * simSettings.timeDelta;

      light.position = particle.position;
      light.intensity = (1 - particle.life);
    }

    if (idx >= CURVE_PARTICLES_OFFSET) {
      particle.position = interpolateLinePoint(particle.life) + particle.velocity;
      light.position = particle.position;
      light.intensity = 1;
    }

  }
`;
