import { mat4 } from "wgpu-matrix";
import Camera from "./Camera";
import { deg2Rad } from "../utils/math";

export default class PerspectiveCamera extends Camera {
	fieldOfView: number;
	aspect: number;
	near: number;
	far: number;

	constructor(fieldOfView: number, aspect: number, near: number, far: number) {
		super();
		this.fieldOfView = deg2Rad(fieldOfView);
		this.aspect = aspect;
		this.near = near;
		this.far = far;
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
