import { Vec3, vec3 } from "wgpu-matrix";

export default class BoundingBox {
	public min = vec3.create();
	public max = vec3.create();

	private _temp = vec3.create();

	public get minX(): number {
		return this.min[0];
	}

	public get minY(): number {
		return this.min[1];
	}

	public get minZ(): number {
		return this.min[2];
	}

	public get maxX(): number {
		return this.max[0];
	}

	public get maxY(): number {
		return this.max[1];
	}

	public get maxZ(): number {
		return this.max[2];
	}

	public getArea(): number {
		const width = this.max[0] - this.min[0];
		const height = this.max[1] - this.min[1];
		const depth = this.max[2] - this.min[2];
		const area = 2 * (width * width + height * height + depth * depth);

		return area;
	}

	public setMinAABB(x: number, y: number, z: number) {
		this.min[0] = x;
		this.min[1] = y;
		this.min[2] = z;
	}

	public setMinAABBfromGLTF(v: number[]) {
		this.setMinAABB(v[0], v[1], v[2]);
	}

	public setMaxAABB(x: number, y: number, z: number) {
		this.max[0] = x;
		this.max[1] = y;
		this.max[2] = z;
	}

	public setMaxAABBfromGLTF(v: number[]) {
		this.setMaxAABB(v[0], v[1], v[2]);
	}

	public get boundingBoxCenter(): Vec3 {
		return this.getBoundingBoxCenter();
	}

	public getBoundingBoxCenter(): Vec3 {
		this._temp[0] = this.max[0] - this.min[0];
		this._temp[1] = this.max[1] - this.min[1];
		this._temp[2] = this.max[2] - this.min[2];
		return this._temp;
	}
}
