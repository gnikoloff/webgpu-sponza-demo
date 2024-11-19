import { Geometry } from "./Geometry";

export default class PlaneGeometry extends Geometry {
	constructor(
		public width = 1,
		public height = 1,
		public widthSegments = 1,
		public heightSegments = 1,
	) {
		super();

		const halfWidth = width * 0.5;
		const halfHeight = height * 0.5;

		const gridX1 = widthSegments + 1;
		const gridY1 = heightSegments + 1;

		const gridX = Math.floor(widthSegments);
		const gridY = Math.floor(heightSegments);

		const segmentWidth = width / widthSegments;
		const segmentHeight = height / heightSegments;

		const indices: number[] = [];
		const interleavedArray: number[] = [];

		for (let iy = 0; iy < gridY1; iy++) {
			const y = iy * segmentHeight - halfHeight;

			for (let ix = 0; ix < gridX1; ix++) {
				const x = ix * segmentWidth - halfWidth;

				interleavedArray.push(x, -y, 0);

				interleavedArray.push(0, 0, 1);

				interleavedArray.push(ix / gridX);
				interleavedArray.push(1 - iy / gridY);
			}
		}

		for (let iy = 0; iy < gridY; iy++) {
			for (let ix = 0; ix < gridX; ix++) {
				const a = ix + gridX1 * iy;
				const b = ix + gridX1 * (iy + 1);
				const c = ix + 1 + gridX1 * (iy + 1);
				const d = ix + 1 + gridX1 * iy;

				indices.push(a, b, d);
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
