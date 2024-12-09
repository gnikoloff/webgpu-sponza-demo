import { Vec3, mat4, quat, vec2, vec3 } from "wgpu-matrix";
import Camera from "./Camera";

const DIR = vec3.create();

const FORWARD_CHAR_CODE = "W".charCodeAt(0);
const BACKWARD_CHAR_CODE = "S".charCodeAt(0);
const LEFT_CHAR_CODE = "A".charCodeAt(0);
const RIGHT_CHAR_CODE = "D".charCodeAt(0);
const UP_CHAR_CODE = "E".charCodeAt(0);
const DOWN_CHAR_CODE = "Q".charCodeAt(0);

export default class CameraFlyController {
	private angles = vec2.create(0, -Math.PI * 0.5);
	private position: Vec3;
	private viewMat = mat4.create();
	private rotMat = mat4.identity();

	// private moving = false;
	private lastX = 0;
	private lastY = 0;

	private presedKeys: string[] = new Array(128);

	private rafId = -1;

	public speed = 20;

	constructor(private camera: Camera, private domElement = document.body) {
		this.position = camera.position;
		domElement.addEventListener("keydown", this.onKeyDown);
		domElement.addEventListener("keyup", this.onKeyUp);

		domElement.addEventListener("mousedown", this.onMouseDown);
		domElement.addEventListener("mouseup", this.onMouseUp);

		this.rotateView(0.0075, 0.005);
	}

	public startTick() {
		this.rafId = requestAnimationFrame(this.update);
	}

	public endTick() {
		cancelAnimationFrame(this.rafId);
	}

	private update = (deltaTime: number) => {
		deltaTime *= 0.001;

		const speed = this.speed * 0.001;

		vec3.set(0, 0, 0, DIR);

		if (this.presedKeys[FORWARD_CHAR_CODE]) {
			DIR[2] -= speed;
		}
		if (this.presedKeys[BACKWARD_CHAR_CODE]) {
			DIR[2] += speed;
		}
		if (this.presedKeys[LEFT_CHAR_CODE]) {
			DIR[0] -= speed;
		}
		if (this.presedKeys[RIGHT_CHAR_CODE]) {
			DIR[0] += speed;
		}
		if (this.presedKeys[UP_CHAR_CODE]) {
			// Space, moves up
			DIR[1] += speed;
		}
		if (this.presedKeys[DOWN_CHAR_CODE]) {
			// Shift, moves down
			DIR[1] -= speed;
		}
		if (DIR[0] !== 0 || DIR[1] !== 0 || DIR[2] !== 0) {
			// Move the camera in the direction we are facing
			vec3.transformMat4(DIR, this.rotMat, DIR);
			vec3.add(this.position, DIR, this.position);
		}

		// if (this.isDirty) {
		const mv = this.viewMat;
		mat4.identity(mv);
		mat4.rotateX(mv, this.angles[0], mv);
		mat4.rotateY(mv, this.angles[1], mv);
		mat4.translate(mv, vec3.negate(this.position), mv);
		// console.log(this.position[2]);
		this.camera.setPosition(
			this.position[0],
			this.position[1],
			this.position[2],
		);
		this.camera.updateViewMatrixWithMat(mv);

		// this.isDirty = false;
		// }

		this.rafId = requestAnimationFrame(this.update);
	};

	private rotateView(xDelta: number, yDelta: number) {
		if (xDelta || yDelta) {
			this.angles[1] += xDelta;
			// Keep our rotation in the range of [0, 2*PI]
			// (Prevents numeric instability if you spin around a LOT.)
			while (this.angles[1] < 0) {
				this.angles[1] += Math.PI * 2.0;
			}
			while (this.angles[1] >= Math.PI * 2.0) {
				this.angles[1] -= Math.PI * 2.0;
			}

			this.angles[0] += yDelta;
			// Clamp the up/down rotation to prevent us from flipping upside-down
			if (this.angles[0] < -Math.PI * 0.5) {
				this.angles[0] = -Math.PI * 0.5;
			}
			if (this.angles[0] > Math.PI * 0.5) {
				this.angles[0] = Math.PI * 0.5;
			}

			// Update the directional matrix
			mat4.identity(this.rotMat);
			mat4.rotateY(this.rotMat, -this.angles[1], this.rotMat);
			mat4.rotateX(this.rotMat, -this.angles[0], this.rotMat);
		}
	}

	private onMouseDown = (e: MouseEvent) => {
		this.lastX = e.pageX;
		this.lastY = e.pageY;
		this.domElement.addEventListener("mousemove", this.onMouseMove);
	};

	private onMouseUp = (e: MouseEvent) => {
		this.domElement.removeEventListener("mousemove", this.onMouseMove);
	};

	private onMouseMove = (e: MouseEvent) => {
		const xDelta = e.pageX - this.lastX;
		const yDelta = e.pageY - this.lastY;
		this.lastX = e.pageX;
		this.lastY = e.pageY;
		this.rotateView(xDelta * 0.0075, yDelta * 0.005);
	};

	private onKeyDown = (e: KeyboardEvent) => {
		// @ts-ignore
		this.presedKeys[e.keyCode] = true;
	};

	private onKeyUp = (e: KeyboardEvent) => {
		// @ts-ignore
		this.presedKeys[e.keyCode] = false;
	};
}
