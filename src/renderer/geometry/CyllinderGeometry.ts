import { vec2, vec3 } from "wgpu-matrix";
import Geometry from "./Geometry";

export default class CyllinderGeometry extends Geometry {
	constructor(
		public radiusTop = 1,
		public radiusBottom = 1,
		public height = 1,
		public radialSegments = 32,
		public heightSegments = 1,
		public openEnded = false,
		public thetaStart = 0,
		public thetaLength = Math.PI * 2,
	) {
		super();
		radialSegments = Math.floor(radialSegments);
		heightSegments = Math.floor(heightSegments);

		const indices: number[] = [];
		const interleavedArray: number[] = [];

		let index = 0;
		const indexArray = [];
		const halfHeight = height / 2;

		generateTorso();
		if (openEnded === false) {
			if (radiusTop > 0) generateCap(true);
			if (radiusBottom > 0) generateCap(false);
		}

		this.createBuffersWithTangentsManually({
			indexCount: indices.length,
			interleavedVertexArr: new Float32Array(interleavedArray),
			indicesArr: new Uint16Array(indices),
		});

		function generateTorso() {
			const normal = vec3.create();
			const vertex = vec3.create();

			// this will be used to calculate the normal
			const slope = (radiusBottom - radiusTop) / height;

			// generate vertices, normals and uvs

			for (let y = 0; y <= heightSegments; y++) {
				const indexRow = [];

				const v = y / heightSegments;

				// calculate the radius of the current row

				const radius = v * (radiusBottom - radiusTop) + radiusTop;

				for (let x = 0; x <= radialSegments; x++) {
					const u = x / radialSegments;

					const theta = u * thetaLength + thetaStart;

					const sinTheta = Math.sin(theta);
					const cosTheta = Math.cos(theta);

					// vertex
					vertex[0] = radius * sinTheta;
					vertex[1] = -v * height + halfHeight;
					vertex[2] = radius * cosTheta;
					interleavedArray.push(vertex[0], vertex[1], vertex[2]);

					// normal
					normal[0] = sinTheta;
					normal[1] = slope;
					normal[2] = cosTheta;
					vec3.normalize(normal);
					interleavedArray.push(normal[0], normal[1], normal[2]);

					// uv
					interleavedArray.push(u, 1 - v);

					indexRow.push(index++);
				}

				indexArray.push(indexRow);
			}

			// generate indices

			for (let x = 0; x < radialSegments; x++) {
				for (let y = 0; y < heightSegments; y++) {
					// we use the index array to access the correct indices

					const a = indexArray[y][x];
					const b = indexArray[y + 1][x];
					const c = indexArray[y + 1][x + 1];
					const d = indexArray[y][x + 1];

					// faces

					if (radiusTop > 0 || y !== 0) {
						indices.push(a, b, d);
					}

					if (radiusBottom > 0 || y !== heightSegments - 1) {
						indices.push(b, c, d);
					}
				}
			}
		}

		function generateCap(top) {
			// save the index of the first center vertex
			const centerIndexStart = index;

			const uv = vec2.create();
			const vertex = vec3.create();

			const radius = top === true ? radiusTop : radiusBottom;
			const sign = top === true ? 1 : -1;

			// first we generate the center vertex data of the cap.
			// because the geometry needs one set of uvs per face,
			// we must generate a center vertex per face/segment

			for (let x = 1; x <= radialSegments; x++) {
				// vertex

				interleavedArray.push(0, halfHeight * sign, 0);

				// normal

				interleavedArray.push(0, sign, 0);

				// uv

				interleavedArray.push(0.5, 0.5);

				// increase index

				index++;
			}

			// save the index of the last center vertex
			const centerIndexEnd = index;

			// now we generate the surrounding vertices, normals and uvs

			for (let x = 0; x <= radialSegments; x++) {
				const u = x / radialSegments;
				const theta = u * thetaLength + thetaStart;

				const cosTheta = Math.cos(theta);
				const sinTheta = Math.sin(theta);

				// vertex

				vertex[0] = radius * sinTheta;
				vertex[1] = halfHeight * sign;
				vertex[2] = radius * cosTheta;
				interleavedArray.push(vertex[0], vertex[1], vertex[2]);

				// normal

				interleavedArray.push(0, sign, 0);

				// uv

				uv[0] = cosTheta * 0.5 + 0.5;
				uv[1] = sinTheta * 0.5 * sign + 0.5;
				interleavedArray.push(uv[0], uv[1]);

				// increase index

				index++;
			}

			// generate indices

			for (let x = 0; x < radialSegments; x++) {
				const c = centerIndexStart + x;
				const i = centerIndexEnd + x;

				if (top === true) {
					// face top

					indices.push(i, i + 1, c);
				} else {
					// face bottom

					indices.push(i + 1, i, c);
				}
			}
		}
	}
}
