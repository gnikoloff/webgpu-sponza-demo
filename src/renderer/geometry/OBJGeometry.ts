import { IModel } from "obj-file-parser-ts";
import { Vec2, Vec3, vec2, vec3 } from "wgpu-matrix";
import Face from "./Face";
import Geometry from "./Geometry";

export default class OBJGeometry extends Geometry {
	constructor(modelInfo: IModel) {
		super();

		const { faces: modelFaces } = modelInfo;

		const vertices: Vec3[] = [];
		const normals: Vec3[] = [];
		const uvs: Vec2[] = [];
		const indices: number[] = [];
		const uniqueVertices = new Map<string, number>();

		for (const modelFace of modelFaces) {
			const faceIndices: number[] = [];
			const faceVertices: Vec3[] = [];
			const faceNormals: Vec3[] = [];
			const faceTexCoords: Vec2[] = [];

			for (let i = 0; i < 3; i++) {
				const vertexIdx = modelFace.vertices[i].vertexIndex;
				const normIdx = modelFace.vertices[i].vertexNormalIndex;
				const uvIdx = modelFace.vertices[i].textureCoordsIndex;

				const modelVertex = modelInfo.vertices[vertexIdx - 1];
				const modelNormal = modelInfo.vertexNormals[normIdx - 1];
				const modelTexCoord = modelInfo.textureCoords[uvIdx - 1];

				const key = `${vertexIdx}/${normIdx}/${uvIdx}`;

				faceIndices[i] = vertices.length - 1;

				const v = vec3.create(modelVertex.x, modelVertex.y, modelVertex.z);
				const n = vec3.create(modelNormal.x, modelNormal.y, modelNormal.z);
				const t = vec2.create(modelTexCoord.u, modelTexCoord.v);

				if (!uniqueVertices.has(key)) {
					vertices.push(v);
					normals.push(n);
					uvs.push(t);
					uniqueVertices.set(key, vertices.length - 1);
					faceIndices[i] = vertices.length - 1;
				}
				faceNormals.push(n);
				faceVertices.push(v);
				faceTexCoords.push(t);
				indices.push(uniqueVertices.get(key));
			}

			const face = new Face(
				faceIndices[0],
				faceIndices[1],
				faceIndices[2],
				faceVertices[0],
				faceVertices[1],
				faceVertices[2],
				faceNormals[0],
				faceNormals[1],
				faceNormals[2],
				faceTexCoords[0],
				faceTexCoords[1],
				faceTexCoords[2],
			);
			this.faces.push(face);
		}

		this.createBuffersWithTangentsManually(
			indices.length,
			vertices,
			normals,
			uvs,
			new Uint16Array(indices),
		);
	}
}
