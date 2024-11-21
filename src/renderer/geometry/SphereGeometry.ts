import { vec3 } from "wgpu-matrix";
import Geometry from "./Geometry";

export default class SphereGeometry extends Geometry {
	constructor(
		public radius = 1,
		public widthSegments = 32,
		public heightSegments = 16,
		public phiStart = 0,
		public phiLength = Math.PI * 2,
		public thetaStart = 0,
		public thetaLength = Math.PI,
	) {
		super();

		widthSegments = Math.max(3, Math.floor(widthSegments));
		heightSegments = Math.max(2, Math.floor(heightSegments));

		const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI);

		let index = 0;
		const grid = [];

		const vertex = vec3.create();
		const normal = vec3.create();

		const interleavedArray = [];
		const indices = [];

		for (let iy = 0; iy <= heightSegments; iy++) {
			const verticesRow = [];

			const v = iy / heightSegments;

			// special case for the poles

			let uOffset = 0;

			if (iy === 0 && thetaStart === 0) {
				uOffset = 0.5 / widthSegments;
			} else if (iy === heightSegments && thetaEnd === Math.PI) {
				uOffset = -0.5 / widthSegments;
			}

			for (let ix = 0; ix <= widthSegments; ix++) {
				const u = ix / widthSegments;

				// vertex

				vertex[0] =
					-radius *
					Math.cos(phiStart + u * phiLength) *
					Math.sin(thetaStart + v * thetaLength);
				vertex[1] = radius * Math.cos(thetaStart + v * thetaLength);
				vertex[2] =
					radius *
					Math.sin(phiStart + u * phiLength) *
					Math.sin(thetaStart + v * thetaLength);

				interleavedArray.push(vertex[0], vertex[1], vertex[2]);

				// normal

				vec3.copy(vertex, normal);
				vec3.normalize(normal, normal);
				interleavedArray.push(normal[0], normal[1], normal[2]);

				// uv

				interleavedArray.push(u + uOffset, 1 - v);

				verticesRow.push(index++);
			}

			grid.push(verticesRow);
		}

		// indices

		for (let iy = 0; iy < heightSegments; iy++) {
			for (let ix = 0; ix < widthSegments; ix++) {
				const a = grid[iy][ix + 1];
				const b = grid[iy][ix];
				const c = grid[iy + 1][ix];
				const d = grid[iy + 1][ix + 1];

				if (iy !== 0 || thetaStart > 0) indices.push(a, b, d);
				if (iy !== heightSegments - 1 || thetaEnd < Math.PI)
					indices.push(b, c, d);
			}
		}

		this.createBuffers({
			vertexCount: indices.length,
			interleavedVertexArr: new Float32Array(interleavedArray),
			indicesArr: new Uint16Array(indices),
		});
	}
}
