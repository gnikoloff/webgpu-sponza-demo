import { SHADER_ATTRIB_LOCATIONS } from "../constants";

export const SHADER_CHUNKS = {
	get VertexInput(): string {
		return /* wgsl */ `

      struct VertexInput {
        @location(${SHADER_ATTRIB_LOCATIONS.Position}) position: vec4<f32>,
        @location(${SHADER_ATTRIB_LOCATIONS.Normal}) normal: vec3<f32>,
        @location(${SHADER_ATTRIB_LOCATIONS.TexCoord}) uv: vec2<f32>,
      };

    `;
	},

	get VertexOutput(): string {
		return /* wgsl */ `
    
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) normal: vec3<f32>,
        @location(1) uv: vec2<f32>,
      };

    `;
	},

	get ModelUniform(): string {
		return /* wgsl */ `
      struct ModelUniform {
        worldMatrix: mat4x4<f32>,
      };
    `;
	},

	get CameraUniform(): string {
		return /* wgsl */ `
      struct CameraUniform {
        projectionMatrix: mat4x4<f32>,
        projectionViewMatrix: mat4x4<f32>,
        viewMatrix: mat4x4<f32>
      };
    `;
	},
};
