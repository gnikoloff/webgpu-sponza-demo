import { mat4 } from "wgpu-matrix";
import { deg2Rad } from "../math/math";
import Camera from "./Camera";

export default class PerspectiveCamera extends Camera {
	constructor(
		public fieldOfView: number,
		public aspect: number,
		near: number,
		far: number,
	) {
		super();
		this.fieldOfView = deg2Rad(fieldOfView);
		this.aspect = aspect;
		this.near = near;
		this.far = far;
		this.updateProjectionMatrix();
	}

	public override onResize(w: number, h: number): void {
		super.onResize(w, h);
		this.aspect = w / h;
		this.updateProjectionMatrix();
	}

	override updateProjectionMatrix(): this {
		mat4.perspective(
			this.fieldOfView,
			this.aspect,
			this.near,
			this.far,
			this.projectionMatrix,
		);
		super.updateProjectionMatrix();
		this.updateProjectionViewMatrix();
		return this;
	}
}
