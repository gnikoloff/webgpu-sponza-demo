import { Vec2, Vec3, vec2, vec3 } from "wgpu-matrix";
import Face from "./Face";
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
		const vertices: Vec3[] = [];
		const normals: Vec3[] = [];
		const uvs: Vec2[] = [];
		let numberOfVertices = 0;

		// prettier-ignore
		buildPlane.call(this, 2, 1, 0, -1, -1, depth, height, width, depthSegments, heightSegments); // px
		// prettier-ignore
		buildPlane.call(this, 2, 1, 0, 1, -1, depth, height, -width, depthSegments, heightSegments); // nx
		// prettier-ignore
		buildPlane.call(this, 0, 2, 1, 1, 1, width, depth, height, widthSegments, depthSegments); // py
		// prettier-ignore
		buildPlane.call(this, 0, 2, 1, 1, -1, width, depth, -height, widthSegments, depthSegments); // ny
		// prettier-ignore
		buildPlane.call(this, 0, 1, 2, 1, -1, width, height, depth, widthSegments, heightSegments); // pz
		// prettier-ignore
		buildPlane.call(this, 0, 1, 2, -1, -1, width, height, -depth, widthSegments, heightSegments); // nz

		this.createBuffersWithTangentsManually(
			indices.length,
			vertices,
			normals,
			uvs,
			new Uint16Array(indices),
		);

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

					vertices.push(vec3.clone(vector));

					// set values to correct vector component

					vector[u] = 0;
					vector[v] = 0;
					vector[w] = depth > 0 ? 1 : -1;

					// now apply vector to normal buffer

					normals.push(vec3.clone(vector));

					// uvs

					uvs.push(vec2.create(ix / gridX, 1 - iy / gridY));

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

					const face0 = new Face(
						a,
						b,
						d,
						vertices[a],
						vertices[b],
						vertices[d],
						normals[a],
						normals[b],
						normals[d],
						uvs[a],
						uvs[b],
						uvs[d],
					);
					this.faces.push(face0);

					indices.push(b, c, d);

					const face1 = new Face(
						b,
						c,
						d,
						vertices[b],
						vertices[c],
						vertices[d],
						normals[b],
						normals[c],
						normals[d],
						uvs[b],
						uvs[c],
						uvs[d],
					);
					this.faces.push(face1);

					// increase counter

					groupCount += 6;
				}
			}

			numberOfVertices += vertexCounter;
		}
	}
}
