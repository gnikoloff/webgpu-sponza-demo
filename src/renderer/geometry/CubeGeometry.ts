import { vec3 } from "wgpu-matrix";
import Geometry from "./Geometry";

export default class CubeGeometry extends Geometry {
	constructor(
		public width = 1,
		public height = 1,
		public depth = 1,
		public widthSegments = 1,
		public heightSegments = 1,
		public depthSegments = 1,
	) {
		super();

		widthSegments = Math.floor(widthSegments);
		heightSegments = Math.floor(heightSegments);
		depthSegments = Math.floor(depthSegments);

		const indices: number[] = [];
		const interleavedArray: number[] = [];
		let numberOfVertices = 0;

		// prettier-ignore
		buildPlane(2, 1, 0, -1, -1, depth, height, width, depthSegments, heightSegments); // px
		// prettier-ignore
		buildPlane(2, 1, 0, 1, -1, depth, height, -width, depthSegments, heightSegments); // nx
		// prettier-ignore
		buildPlane(0, 2, 1, 1, 1, width, depth, height, widthSegments, depthSegments); // py
		// prettier-ignore
		buildPlane(0, 2, 1, 1, -1, width, depth, -height, widthSegments, depthSegments); // ny
		// prettier-ignore
		buildPlane(0, 1, 2, 1, -1, width, height, depth, widthSegments, heightSegments); // pz
		// prettier-ignore
		buildPlane(0, 1, 2, -1, -1, width, height, -depth, widthSegments, heightSegments); // nz

		this.createBuffers({
			vertexCount: indices.length,
			interleavedVertexArr: new Float32Array(interleavedArray),
			indicesArr: new Uint16Array(indices),
		});

		function buildPlane(
			u: number,
			v: number,
			w: number,
			udir: number,
			vdir: number,
			width: number,
			height: number,
			depth: number,
			gridX: number,
			gridY: number,
		) {
			const segmentWidth = width / gridX;
			const segmentHeight = height / gridY;

			const widthHalf = width / 2;
			const heightHalf = height / 2;
			const depthHalf = depth / 2;

			const gridX1 = gridX + 1;
			const gridY1 = gridY + 1;

			let vertexCounter = 0;
			let groupCount = 0;

			const vector = vec3.create();

			// generate vertices, normals and uvs

			for (let iy = 0; iy < gridY1; iy++) {
				const y = iy * segmentHeight - heightHalf;

				for (let ix = 0; ix < gridX1; ix++) {
					const x = ix * segmentWidth - widthHalf;

					// set values to correct vector component

					vector[u] = x * udir;
					vector[v] = y * vdir;
					vector[w] = depthHalf;

					// now apply vector to vertex buffer

					interleavedArray.push(vector[0], vector[1], vector[2]);

					// set values to correct vector component

					vector[u] = 0;
					vector[v] = 0;
					vector[w] = depth > 0 ? 1 : -1;

					// now apply vector to normal buffer

					interleavedArray.push(vector[0], vector[1], vector[2]);

					// uvs

					interleavedArray.push(ix / gridX);
					interleavedArray.push(1 - iy / gridY);

					// counters

					vertexCounter += 1;
				}
			}

			// indices

			// 1. you need three indices to draw a single face
			// 2. a single segment consists of two faces
			// 3. so we need to generate six (2*3) indices per segment

			for (let iy = 0; iy < gridY; iy++) {
				for (let ix = 0; ix < gridX; ix++) {
					const a = numberOfVertices + ix + gridX1 * iy;
					const b = numberOfVertices + ix + gridX1 * (iy + 1);
					const c = numberOfVertices + (ix + 1) + gridX1 * (iy + 1);
					const d = numberOfVertices + (ix + 1) + gridX1 * iy;

					// faces

					indices.push(a, b, d);
					indices.push(b, c, d);

					// increase counter

					groupCount += 6;
				}
			}

			numberOfVertices += vertexCounter;
		}
	}
}
