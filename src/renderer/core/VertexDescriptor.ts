import BaseUtilObject from "./BaseUtilObject";
import { SHADER_ATTRIB_LOCATIONS } from "./RendererBindings";

let _defaultVertexLayout: GPUVertexBufferLayout[];
let _defaultGltfVertexLayout: GPUVertexBufferLayout[];

export default class VertexDescriptor extends BaseUtilObject {
	public static readonly itemsPerVertexDefaultLayout = 3 + 3 + 2 + 4;

	public static get defaultGLTFLayout(): GPUVertexBufferLayout[] {
		if (_defaultGltfVertexLayout) {
			return _defaultGltfVertexLayout;
		}

		const posAttribs: GPUVertexAttribute[] = [
			{
				shaderLocation: SHADER_ATTRIB_LOCATIONS.Position,
				format: "float32x3",
				offset: 0,
			},
		];
		const normAttribs: GPUVertexAttribute[] = [
			{
				shaderLocation: SHADER_ATTRIB_LOCATIONS.Normal,
				format: "float32x3",
				offset: 0,
			},
		];
		const texCoordsAttribs: GPUVertexAttribute[] = [
			{
				shaderLocation: SHADER_ATTRIB_LOCATIONS.TexCoord,
				format: "float32x2",
				offset: 0,
			},
		];
		const tangentsAttribs: GPUVertexAttribute[] = [
			{
				shaderLocation: SHADER_ATTRIB_LOCATIONS.Tangent,
				format: "float32x4",
				offset: 0,
			},
		];

		_defaultGltfVertexLayout = [
			{
				arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
				attributes: posAttribs,
			},
			{
				arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
				attributes: normAttribs,
			},
			{
				arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
				attributes: texCoordsAttribs,
			},
			{
				arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
				attributes: tangentsAttribs,
			},
		];

		return _defaultGltfVertexLayout;
	}

	public static get defaultLayout(): GPUVertexBufferLayout[] {
		if (_defaultVertexLayout) {
			return _defaultVertexLayout;
		}

		const attributes: GPUVertexAttribute[] = [
			{
				shaderLocation: SHADER_ATTRIB_LOCATIONS.Position,
				offset: 0,
				format: "float32x3",
			},
			{
				shaderLocation: SHADER_ATTRIB_LOCATIONS.Normal,
				offset: 3 * Float32Array.BYTES_PER_ELEMENT,
				format: "float32x3",
			},
			{
				shaderLocation: SHADER_ATTRIB_LOCATIONS.TexCoord,
				offset: 6 * Float32Array.BYTES_PER_ELEMENT,
				format: "float32x2",
			},
			{
				shaderLocation: SHADER_ATTRIB_LOCATIONS.Tangent,
				offset: 8 * Float32Array.BYTES_PER_ELEMENT,
				format: "float32x4",
			},
		];
		_defaultVertexLayout = [
			{
				arrayStride:
					VertexDescriptor.itemsPerVertexDefaultLayout *
					Float32Array.BYTES_PER_ELEMENT,
				attributes,
			},
		];

		return _defaultVertexLayout;
	}
}
