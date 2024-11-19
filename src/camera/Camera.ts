import { mat4, vec3 } from "gl-matrix";
import {
	StructuredView,
	makeShaderDataDefinitions,
	makeStructuredView,
} from "webgpu-utils";
import { Renderer } from "../Renderer";
import { SHADER_CHUNKS } from "../shaders/chunks";

export default class Camera {
	private static readonly UP_VECTOR = vec3.fromValues(0, 1, 0);

	public position = vec3.fromValues(0, 0, 0);
	public lookAt = vec3.fromValues(0, 0, 0);

	public projectionMatrix = mat4.create();
	public viewMatrix = mat4.create();
	public viewMatrixInverse = mat4.create();
	public projectionViewMatrix = mat4.create();

	public gpuBuffer: GPUBuffer;
	protected bufferUniformValues: StructuredView;
	protected needsUploadToGPU = true;

	constructor() {
		const cameraShaderDefs = makeShaderDataDefinitions(
			SHADER_CHUNKS.CameraUniform,
		);
		this.bufferUniformValues = makeStructuredView(
			cameraShaderDefs.structs.CameraUniform,
		);
		// debugger;
		this.bufferUniformValues.set({
			viewMatrix: this.viewMatrix,
			projectionMatrix: this.projectionMatrix,
			projectionViewMatrix: this.projectionViewMatrix,
		});

		this.gpuBuffer = Renderer.device.createBuffer({
			size: this.bufferUniformValues.arrayBuffer.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "Camera GPUBuffer",
		});
	}

	public set x(v: number) {
		this.position[0] = v;
	}

	public get x(): number {
		return this.position[0];
	}

	public set y(v: number) {
		this.position[1] = v;
	}

	public get y(): number {
		return this.position[1];
	}

	public set z(v: number) {
		this.position[2] = v;
	}

	public get z(): number {
		return this.position[2];
	}

	public setPosition(x: number, y: number, z: number) {
		this.position[0] = x;
		this.position[1] = y;
		this.position[2] = z;
	}

	public setLookAt(x: number, y: number, z: number) {
		this.lookAt[0] = x;
		this.lookAt[1] = y;
		this.lookAt[2] = z;
	}

	public update() {
		if (this.needsUploadToGPU) {
			Renderer.device.queue.writeBuffer(
				this.gpuBuffer,
				0,
				this.bufferUniformValues.arrayBuffer,
			);

			this.needsUploadToGPU = false;
		}
	}

	updateViewMatrix(): this {
		mat4.lookAt(this.viewMatrix, this.position, this.lookAt, Camera.UP_VECTOR);

		// mat4.invert(this.viewMatrix, this.viewMatrixInverse);

		const extra = new Float32Array([
			1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0.9, 1,
		]);
		const viewMatrix = true ? this.viewMatrix : extra;

		this.bufferUniformValues.set({
			// prettier-ignore
			// viewMatrix: [1, 0],
			viewMatrix,
		});
		console.log(`Wrote view matrix: ${viewMatrix}`);

		this.needsUploadToGPU = true;

		this.updateProjectionViewMatrix();
		return this;
	}

	updateProjectionMatrix(): this {
		this.bufferUniformValues.set({
			projectionMatrix: this.projectionMatrix,
		});
		console.log(`Wrote projection matrix: ${this.projectionMatrix}`);
		return this;
	}

	updateProjectionViewMatrix(): this {
		mat4.mul(this.projectionMatrix, this.viewMatrix, this.projectionViewMatrix);
		this.bufferUniformValues.set({
			projectionViewMatrix: this.projectionViewMatrix,
		});
		this.needsUploadToGPU = true;
		return this;
	}
}
