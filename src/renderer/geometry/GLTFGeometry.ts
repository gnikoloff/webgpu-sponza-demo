import {
	GLTFMeshPostprocessed,
	GLTFMeshPrimitivePostprocessed,
} from "@loaders.gl/gltf";
import { TypedArray } from "webgpu-utils";
import { Vec2, Vec3, vec2, vec3 } from "wgpu-matrix";

import Geometry from "./Geometry";
import Face from "./Face";
import VertexDescriptor from "../core/VertexDescriptor";

export default class GLTFGeometry extends Geometry {
	constructor(primitive: GLTFMeshPrimitivePostprocessed) {
		super();

		const positionAttrib = primitive.attributes.POSITION;
		if (!positionAttrib) {
			throw new Error("GLTF Mesh needs to have vertices array");
		}

		const normalAttrib = primitive.attributes.NORMAL;
		const texCoord0Attrib = primitive.attributes.TEXCOORD_0;
		const tangentAttrib = primitive.attributes.TANGENT;
		const indicesSlot = primitive.indices;

		const positions = positionAttrib.value;
		const normals = normalAttrib.value;
		const texCoords = texCoord0Attrib.value;
		const indices = indicesSlot.value as Uint16Array;

		if (tangentAttrib) {
			const tangents = tangentAttrib.value;
			this.consumeMeshWithTangents(
				positions,
				normals,
				texCoords,
				tangents,
				indices,
			);
		} else {
			this.consumeMeshWithoutTangents(positions, normals, texCoords, indices);
		}
	}

	private consumeMeshWithTangents(
		positions: TypedArray,
		normals: TypedArray,
		texCoords: TypedArray,
		tangents: TypedArray,
		indices: Uint16Array,
	) {
		const interleavedArray = new Float32Array(
			positions.length * VertexDescriptor.itemsPerVertexDefaultLayout,
		);

		let interleavedArrIdx = 0;

		for (let i = 0; i < positions.length / 3; i++) {
			const idx0 = i * 3 + 0;
			const idx1 = i * 3 + 1;
			const idx2 = i * 3 + 2;
			const px = positions[idx0];
			const py = positions[idx1];
			const pz = positions[idx2];
			interleavedArray[interleavedArrIdx++] = px;
			interleavedArray[interleavedArrIdx++] = py;
			interleavedArray[interleavedArrIdx++] = pz;

			const nx = normals[idx0];
			const ny = normals[idx1];
			const nz = normals[idx2];
			interleavedArray[interleavedArrIdx++] = nx;
			interleavedArray[interleavedArrIdx++] = ny;
			interleavedArray[interleavedArrIdx++] = nz;

			const uvx = texCoords[i * 2];
			const uvy = texCoords[i * 2 + 1];

			interleavedArray[interleavedArrIdx++] = uvx;
			interleavedArray[interleavedArrIdx++] = uvy;

			const tx = tangents[idx0];
			const ty = tangents[idx1];
			const tz = tangents[idx2];
			interleavedArray[interleavedArrIdx++] = tx;
			interleavedArray[interleavedArrIdx++] = ty;
			interleavedArray[interleavedArrIdx++] = tz;
		}
		this.createBuffersWithDataDirectly(
			indices.length,
			interleavedArray,
			indices,
		);
	}

	private consumeMeshWithoutTangents(
		positionsIn: TypedArray,
		normalsIn: TypedArray,
		texCoordsIn: TypedArray,
		indices: Uint16Array,
	) {
		const vertices: Vec3[] = [];
		const normals: Vec3[] = [];
		const texCoords: Vec2[] = [];
		for (let i = 0; i < positionsIn.length / 3; i++) {
			const p0x = positionsIn[i * 3 + 0];
			const p0y = positionsIn[i * 3 + 1];
			const p0z = positionsIn[i * 3 + 2];

			const pos = vec3.create(p0x, p0y, p0z);
			vertices.push(pos);

			const n0x = normalsIn[i * 3 + 0];
			const n0y = normalsIn[i * 3 + 1];
			const n0z = normalsIn[i * 3 + 2];

			const normal = vec3.create(n0x, n0y, n0z);
			normals.push(normal);
		}

		for (let i = 0; i < texCoordsIn.length / 2; i++) {
			const uv0x = texCoordsIn[i * 2 + 0];
			const uv0y = texCoordsIn[i * 2 + 1];

			const uv = vec2.create(uv0x, uv0y);

			texCoords.push(uv);
		}

		for (let i = 0; i < vertices.length; i += 3) {
			const idx0 = indices[i + 0];
			const idx1 = indices[i + 1];
			const idx2 = indices[i + 2];

			const pos0 = vertices[idx0];
			const pos1 = vertices[idx1];
			const pos2 = vertices[idx2];

			const norm0 = normals[idx0];
			const norm1 = normals[idx1];
			const norm2 = normals[idx2];

			const uv0 = texCoords[idx0];
			const uv1 = texCoords[idx1];
			const uv2 = texCoords[idx2];

			const face = new Face(
				idx0,
				idx1,
				idx2,
				pos0,
				pos1,
				pos2,
				norm0,
				norm1,
				norm2,
				uv0,
				uv1,
				uv2,
			);
			this.faces.push(face);
		}

		this.createBuffersWithTangentsManually(
			indices.length,
			vertices,
			normals,
			texCoords,
			indices,
		);
	}
}
