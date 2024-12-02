import { Vec2, Vec3, vec2, vec3 } from "wgpu-matrix";

export default class Face {
	public centroid = vec3.create();

	constructor(
		public indexV0,
		public indexV1,
		public indexV2,
		public p0: Vec3,
		public p1: Vec3,
		public p2: Vec3,
		public n0: Vec3,
		public n1: Vec3,
		public v2: Vec3,
		public texCoord0: Vec2,
		public texCoord1: Vec2,
		public texCoord2: Vec2,
	) {
		this.computeCetroid();
	}

	private computeCetroid() {
		this.centroid[0] = (this.p0[0] + this.p1[0] + this.p2[0]) / 3;
		this.centroid[1] = (this.p0[1] + this.p1[1] + this.p2[1]) / 3;
		this.centroid[2] = (this.p0[2] + this.p1[2] + this.p2[2]) / 3;
	}

	public getArea(): number {
		let v0 = vec3.sub(this.p2, this.p1);
		let v1 = vec3.sub(this.p0, this.p1);
		return vec3.len(vec3.cross(v0, v1)) * 0.5;
	}
}
