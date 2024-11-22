import { RENDER_TARGET_LOCATIONS, SHADER_ATTRIB_LOCATIONS } from "../constants";

export const SHADER_CHUNKS = {
	get VertexInput(): string {
		return /* wgsl */ `

      struct VertexInput {
        @location(${SHADER_ATTRIB_LOCATIONS.Position}) position: vec4f,
        @location(${SHADER_ATTRIB_LOCATIONS.Normal}) normal: vec3f,
        @location(${SHADER_ATTRIB_LOCATIONS.TexCoord}) uv: vec2f,
      };

    `;
	},

	get VertexOutput(): string {
		return /* wgsl */ `
    
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) normal: vec3f,
        @location(1) uv: vec2f,
        @location(2) currFrameClipPos: vec4f,
        @location(3) prevFrameClipPos: vec4f,
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
      };

    `;
	},

	get CameraUniform(): string {
		return /* wgsl */ `

      struct CameraUniform {
        projectionMatrix: mat4x4f,
        viewMatrix: mat4x4f,
        projectionViewMatrix: mat4x4f,
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
        @location(${RENDER_TARGET_LOCATIONS.NormalReflectance}) normalReflectance: vec4f,
        @location(${RENDER_TARGET_LOCATIONS.Color}) color: vec4f,
        @location(${RENDER_TARGET_LOCATIONS.Velocity}) velocity: vec4f,
      };
      
    `;
	},
};
