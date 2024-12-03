import {
	RENDER_TARGET_LOCATIONS,
	SHADER_ATTRIB_LOCATIONS,
} from "../core/RendererBindings";

export const SHADER_CHUNKS = Object.freeze({
	get VertexInput(): string {
		return /* wgsl */ `

      struct VertexInput {
        @location(${SHADER_ATTRIB_LOCATIONS.Position}) position: vec4f,
        @location(${SHADER_ATTRIB_LOCATIONS.Normal}) normal: vec3f,
        @location(${SHADER_ATTRIB_LOCATIONS.TexCoord}) uv: vec2f,
        @location(${SHADER_ATTRIB_LOCATIONS.Tangent}) tangent: vec3f,
      };

    `;
	},

	get VertexOutput(): string {
		return /* wgsl */ `
    
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) worldPosition: vec3f,
        @location(1) normal: vec3f,
        @location(2) uv: vec2f,
        @location(3) tangent: vec3f,
        @location(4) bitangent: vec3f,
        @location(5) currFrameClipPos: vec4f,
        @location(6) prevFrameClipPos: vec4f,
        @location(7) @interpolate(flat) instanceId: u32,
      };

    `;
	},

	get InstanceInput(): string {
		return /* wgsl */ `
      struct InstanceInput {
        worldMatrix: mat4x4f,
        metallic: f32,
        roughness: f32,
      };
    `;
	},

	get ModelUniform(): string {
		return /* wgsl */ `

      struct ModelUniform {
        worldMatrix: mat4x4f,
        prevFrameWorldMatrix: mat4x4f,
        normalMatrix: mat3x3f,
        baseColor: vec3f,
        isReflective: u32,
        metallic: f32,
        roughness: f32,
      };

    `;
	},

	get CameraUniform(): string {
		return /* wgsl */ `

      struct CameraUniform {
        position: vec3f,
        projectionMatrix: mat4x4f,
        viewMatrix: mat4x4f,
        projectionViewMatrix: mat4x4f,
        inverseProjectionViewMatrix: mat4x4f,
        prevFrameProjectionViewMatrix: mat4x4f,
        viewportWidth: u32,
        viewportHeight: u32,
        jitterOffset: vec2f,
      };

    `;
	},

	get GBufferOutput(): string {
		return /* wgsl */ `

      struct GBufferOutput {
        @location(${RENDER_TARGET_LOCATIONS.NormalMetallicRoughness}) normalMetallicRoughness: vec4f,
        @location(${RENDER_TARGET_LOCATIONS.ColorReflectance}) color: vec4f,
        @location(${RENDER_TARGET_LOCATIONS.Velocity}) velocity: vec4f,
      };
      
    `;
	},

	get Light(): string {
		return /* wgsl */ `

      struct Light {
        lightType: u32, // 0 - Directional Light, 1 - Point Light, 2 - Ambient Light
        intensity: f32,
        radius: f32,
        position: vec3f,
        color: vec3f,
      };

    `;
	},

	get Material(): string {
		return /* wgsl */ `
    
      struct Material {
        metallic: f32,
        albedo: vec3f,
        roughness: f32,
        ambientOcclusion: f32,
      };

    `;
	},

	get ShadowCascade(): string {
		return /* wgsl */ `
      struct ShadowCascade {
        projViewMatrix: mat4x4<f32>,
        distance: f32,
      };
    `;
	},

	get CommonHelpers(): string {
		const out = /* wgsl */ `

      const WORLD_UP = vec3f(0.0, 1.0, 0.0);
      const WORLD_FORWARD = vec3f(0.0, 0.0, 1.0);
      const PI: f32 = 3.1415;
      const TWO_PI: f32 = 6.2831;
      const HALF_PI: f32 = 1.5707;
      const DELTA_PHI: f32 = 0.01745;
      const DELTA_THETA: f32 = 0.01745;
    
      const CUBE_NORMALS: array<vec3<f32>, 6> = array<vec3<f32>, 6>(
        vec3<f32>(1.0, 0.0, 0.0),
        vec3<f32>(-1.0, 0.0, 0.0),
        vec3<f32>(0.0, 1.0, 0.0),
        vec3<f32>(0.0, -1.0, 0.0),
        vec3<f32>(0.0, 0.0, 1.0),
        vec3<f32>(0.0, 0.0, -1.0)
      );
      
      const CUBE_UPS: array<vec3<f32>, 6> = array<vec3<f32>, 6>(
        vec3<f32>(0.0, 1.0, 0.0),
        vec3<f32>(0.0, 1.0, 0.0),
        vec3<f32>(0.0, 0.0, -1.0),
        vec3<f32>(0.0, 0.0, 1.0),
        vec3<f32>(0.0, 1.0, 0.0),
        vec3<f32>(0.0, 1.0, 0.0)
      );
      
      const CUBE_ROTATIONS: array<vec4<f32>, 6> = array<vec4<f32>, 6>(
        vec4<f32>(0.0, 1.0, 0.0, HALF_PI),
        vec4<f32>(0.0, 1.0, 0.0, -HALF_PI),
        vec4<f32>(1.0, 0.0, 0.0, -HALF_PI),
        vec4<f32>(1.0, 0.0, 0.0, HALF_PI),
        vec4<f32>(0.0, 0.0, 1.0, 0.0),
        vec4<f32>(0.0, 1.0, 0.0, PI)
      );
    `;

		return out;
	},
	get sRGBToLinear(): string {
		return /* wgsl */ `

      @must_use
      fn srgbToLinear(srgb: vec3f) -> vec3f {
        return select(
            srgb / 12.92,
            pow((srgb + vec3f(0.055)) / vec3f(1.055), vec3f(2.4)),
            srgb > vec3f(0.04045)
        );
      }

    `;
	},
	get MathHelpers(): string {
		return /* wgsl */ `

      @must_use
      fn rotateAxisAngle(inAxis: vec3f, angle: f32) -> mat3x3f {
        let axis = normalize(inAxis);
        let s = sin(angle);
        let c = cos(angle);
        let oc = 1.0 - c;
    
        return mat3x3f(
          oc * axis.x * axis.x + c, oc * axis.x * axis.y - axis.z * s, oc * axis.z * axis.x + axis.y * s,
          oc * axis.x * axis.y + axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z - axis.x * s,
          oc * axis.z * axis.x - axis.y * s, oc * axis.y * axis.z + axis.x * s, oc * axis.z * axis.z + c
        );
      }
      
    `;
	},
});
