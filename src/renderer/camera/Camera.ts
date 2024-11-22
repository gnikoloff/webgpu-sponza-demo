import { mat4, vec3 } from "wgpu-matrix";
import {
	StructuredView,
	makeShaderDataDefinitions,
	makeStructuredView,
} from "webgpu-utils";
import Renderer from "../../app/Renderer";
import { SHADER_CHUNKS } from "../../app/shaders/chunks";

const HAMILTON_SEQUENCE = [
	[0.5, 0.333333],
	[0.25, 0.666667],
	[0.75, 0.111111],
	[0.125, 0.444444],
	[0.625, 0.777778],
	[0.375, 0.222222],
	[0.875, 0.555556],
	[0.0625, 0.888889],
	[0.5625, 0.037037],
	[0.3125, 0.37037],
	[0.8125, 0.703704],
	[0.1875, 0.148148],
	[0.6875, 0.481481],
	[0.4375, 0.814815],
	[0.9375, 0.259259],
	[0.03125, 0.592593],
];

export default class Camera {
	private static readonly UP_VECTOR = vec3.fromValues(0, 1, 0);

	public position = vec3.fromValues(0, 0, 0);
	public lookAt = vec3.fromValues(0, 0, 0);

	public projectionMatrix = mat4.create();
	public viewMatrix = mat4.create();
	public viewMatrixInverse = mat4.create();
	public projectionViewMatrix = mat4.create();

	public gpuBuffer: GPUBuffer;
	public get shouldJitter(): boolean {
		return this._shouldJitter;
	}
	public set shouldJitter(v: boolean) {
		this._shouldJitter = v;
		this._shouldJitterChanged = true;
	}

	private _shouldJitter = false;
	private _shouldJitterChanged = false;

	private prevFrameProjectionViewMatrix = mat4.create();
	private frameCounter = 0;

	protected viewportWidth: number;
	protected viewportHeight: number;
	// prettier-ignore
	protected hamiltonSequence = new Array(16).fill([]).map(() => new Array(2).fill(0));
	protected bufferUniformValues: StructuredView;
	// protected needsUploadToGPU = true;

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

	public updateViewMatrix(): this {
		mat4.lookAt(this.position, this.lookAt, Camera.UP_VECTOR, this.viewMatrix);

		this.bufferUniformValues.set({
			viewMatrix: this.viewMatrix,
		});

		// this.needsUploadToGPU = true;

		this.updateProjectionViewMatrix();
		return this;
	}

	public updateProjectionMatrix(): this {
		this.bufferUniformValues.set({
			projectionMatrix: this.projectionMatrix,
		});
		// this.needsUploadToGPU = true;
		return this;
	}

	public updateProjectionViewMatrix(): this {
		mat4.mul(this.projectionMatrix, this.viewMatrix, this.projectionViewMatrix);
		this.bufferUniformValues.set({
			projectionViewMatrix: this.projectionViewMatrix,
			prevFrameProjectionViewMatrix: this.prevFrameProjectionViewMatrix,
		});
		// this.needsUploadToGPU = true;
		return this;
	}

	public onResize(w: number, h: number) {
		this.viewportWidth = w;
		this.viewportHeight = h;
		this.bufferUniformValues.set({
			viewportWidth: w,
			viewportHeight: h,
		});

		for (let i = 0; i < 16; i++) {
			// prettier-ignore
			this.hamiltonSequence[i][0] = ((HAMILTON_SEQUENCE[i][0] - 0.5) / this.viewportWidth) * 2;
			// prettier-ignore
			this.hamiltonSequence[i][1] = ((HAMILTON_SEQUENCE[i][1] - 0.5) / this.viewportHeight) * 2;
		}
	}

	public onFrameStart() {
		const hamiltonOffset = this.hamiltonSequence[this.frameCounter % 16];

		if (this._shouldJitterChanged) {
			if (!this._shouldJitter) {
				this.bufferUniformValues.set({
					jitterOffset: [0, 0],
				});
			}
			this._shouldJitterChanged = false;
		}

		if (this._shouldJitter) {
			this.bufferUniformValues.set({
				jitterOffset: hamiltonOffset,
			});
		}
		Renderer.device.queue.writeBuffer(
			this.gpuBuffer,
			0,
			this.bufferUniformValues.arrayBuffer,
		);
		// this.needsUploadToGPU = false;
	}

	public onFrameEnd() {
		mat4.copy(this.projectionViewMatrix, this.prevFrameProjectionViewMatrix);
		this.frameCounter++;
	}
}
