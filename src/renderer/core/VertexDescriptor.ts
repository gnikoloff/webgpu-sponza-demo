import BaseUtilObject from "./BaseUtilObject";
import { SHADER_ATTRIB_LOCATIONS } from "./RendererBindings";

let _defaultVertexLayout: GPUVertexBufferLayout;

export default class VertexDescriptor extends BaseUtilObject {
	public static readonly itemsPerVertexDefaultLayout = 3 + 3 + 2 + 3;

	public static get defaultLayout(): GPUVertexBufferLayout {
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
			// tangent
			{
				shaderLocation: SHADER_ATTRIB_LOCATIONS.Tangent,
				offset: 8 * Float32Array.BYTES_PER_ELEMENT,
				format: "float32x3",
			},
		];
		_defaultVertexLayout = {
			arrayStride:
				VertexDescriptor.itemsPerVertexDefaultLayout *
				Float32Array.BYTES_PER_ELEMENT,
			attributes,
		};

		return _defaultVertexLayout;
	}
}
