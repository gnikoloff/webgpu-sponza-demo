import { Vec3, vec3 } from "wgpu-matrix";
import BoundingBox from "./BoundingBox";

export default class Plane {
	constructor(public normal: Vec3, public d: number) {}

	public normalize() {
		const length = vec3.len(this.normal);
		vec3.normalize(this.normal, this.normal);
		this.d /= length;
	}

	checkIfBBoxIsInside(bbox: BoundingBox) {
		const px = this.normal[0] >= 0 ? bbox.maxX : bbox.minX;
		const py = this.normal[1] >= 0 ? bbox.maxY : bbox.minY;
		const pz = this.normal[2] >= 0 ? bbox.maxZ : bbox.minZ;

		// Distance from the positive vertex to the plane
		const distance =
			this.normal[0] * px + this.normal[1] * py + this.normal[2] * pz + this.d;

		return distance >= 0;
	}
}
