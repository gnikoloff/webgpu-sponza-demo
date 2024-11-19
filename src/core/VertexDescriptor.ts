import { SHADER_ATTRIB_LOCATIONS } from "../constants";

let _defaultVertexLayout: GPUVertexBufferLayout;

export const VertexDescriptor = {
	get defaultLayout(): GPUVertexBufferLayout {
		if (_defaultVertexLayout) {
			return _defaultVertexLayout;
		}

		const attributes: GPUVertexAttribute[] = [
			// position
			{
				shaderLocation: SHADER_ATTRIB_LOCATIONS.Position,
				offset: 0,
				format: "float32x3",
			},
			// normal
			{
				shaderLocation: SHADER_ATTRIB_LOCATIONS.Normal,
				offset: 3 * Float32Array.BYTES_PER_ELEMENT,
				format: "float32x3",
			},
			// uv
			{
				shaderLocation: SHADER_ATTRIB_LOCATIONS.TexCoord,
				offset: 6 * Float32Array.BYTES_PER_ELEMENT,
				format: "float32x2",
			},
		];
		_defaultVertexLayout = {
			arrayStride: (3 + 3 + 2) * Float32Array.BYTES_PER_ELEMENT,
			attributes,
		};

		return _defaultVertexLayout;
	},
};
