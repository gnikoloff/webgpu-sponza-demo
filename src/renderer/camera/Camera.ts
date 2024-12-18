import {
	StructuredView,
	makeShaderDataDefinitions,
	makeStructuredView,
} from "webgpu-utils";
import { Mat4, Vec3, Vec4, mat4, vec3, vec4 } from "wgpu-matrix";
import RenderingContext from "../core/RenderingContext";
import Plane from "../math/Plane";
import VRAMUsageTracker from "../misc/VRAMUsageTracker";
import Drawable from "../scene/Drawable";
import Node from "../scene/Node";
import { SHADER_CHUNKS } from "../shader/chunks";

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

export default class Camera extends Node {
	public static readonly UP_VECTOR = vec3.fromValues(0, 1, 0);

	public lookAt = vec3.fromValues(0, 0, 0);

	public hasChangedSinceLastFrame = true;

	public near: number;
	public far: number;

	public projectionMatrix = mat4.create();
	public inverseProjectionMatrix = mat4.create();
	public viewMatrix = mat4.create();
	public inverseViewMatrix = mat4.create();
	public projectionViewMatrix = mat4.create();
	public inverseProjectionViewMatrix = mat4.create();

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

	protected frustumPlanes: Plane[] = [];

	protected viewportWidth: number;
	protected viewportHeight: number;
	// prettier-ignore
	protected hamiltonSequence = new Array(16).fill([]).map(() => new Array(2).fill(0));
	protected bufferUniformValues: StructuredView;

	constructor() {
		super();
		const cameraShaderDefs = makeShaderDataDefinitions(SHADER_CHUNKS.Camera);
		this.bufferUniformValues = makeStructuredView(
			cameraShaderDefs.structs.Camera,
		);
		this.bufferUniformValues.set({
			viewMatrix: this.viewMatrix,
			projectionMatrix: this.projectionMatrix,
			projectionViewMatrix: this.projectionViewMatrix,
		});

		this.gpuBuffer = RenderingContext.device.createBuffer({
			size: this.bufferUniformValues.arrayBuffer.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "Camera GPUBuffer",
		});

		VRAMUsageTracker.addBufferBytes(this.gpuBuffer);

		for (let i = 0; i < 6; i++) {
			this.frustumPlanes.push(new Plane(vec3.create(), 0));
		}
	}

	public set x(v: number) {
		this.position[0] = v;
		this.bufferUniformValues.set({
			position: this.position,
		});
	}

	public get x(): number {
		return this.position[0];
	}

	public set y(v: number) {
		this.position[1] = v;
		this.bufferUniformValues.set({
			position: this.position,
		});
	}

	public get y(): number {
		return this.position[1];
	}

	public set z(v: number) {
		this.position[2] = v;
		this.bufferUniformValues.set({
			position: this.position,
		});
	}

	public get z(): number {
		return this.position[2];
	}

	public get frustumCornersWorldSpace(): Vec4[] {
		const inv = this.inverseProjectionViewMatrix;
		const frustumCorners: Vec4[] = [];

		for (let x = 0; x < 2; x++) {
			for (let y = 0; y < 2; y++) {
				for (let z = 0; z < 2; z++) {
					const px = 2 * x - 1;
					const py = 2 * y - 1;
					const pz = z;
					const pw = 1;
					const pt = vec4.create(px, py, pz, pw);
					vec4.transformMat4(pt, inv, pt);
					pt[0] /= pt[3];
					pt[1] /= pt[3];
					pt[2] /= pt[3];
					frustumCorners.push(pt);
				}
			}
		}
		return frustumCorners;
	}

	public cullMeshes(meshes: Drawable[], outMeshes: Drawable[]): number {
		let nonCulledCount = 0;

		for (let i = 0; i < meshes.length; i++) {
			const mesh = meshes[i];
			const bbox = mesh.worldBoundingBox;
			let insideCount = 0;

			for (const plane of this.frustumPlanes) {
				if (plane.checkIfBBoxIsInside(bbox)) {
					insideCount++;
				}
			}

			const isInside = insideCount === 6;
			if (isInside) {
				outMeshes[nonCulledCount] = meshes[i];
				nonCulledCount++;
			}
		}

		return nonCulledCount;
	}

	public setLookAt(x: number, y: number, z: number) {
		this.lookAt[0] = x;
		this.lookAt[1] = y;
		this.lookAt[2] = z;
	}

	public setLookAtVec3(v: Vec3) {
		this.lookAt = v;
	}

	public updateViewMatrix(): this {
		mat4.lookAt(this.position, this.lookAt, Camera.UP_VECTOR, this.viewMatrix);
		mat4.inverse(this.viewMatrix, this.inverseViewMatrix);

		this.bufferUniformValues.set({
			viewMatrix: this.viewMatrix,
			inverseViewMatrix: this.inverseViewMatrix,
		});

		this.updateProjectionViewMatrix();
		return this;
	}

	public updateViewMatrixWithMat(v: Mat4): this {
		this.viewMatrix = v;
		mat4.inverse(this.viewMatrix, this.inverseViewMatrix);
		this.bufferUniformValues.set({
			viewMatrix: this.viewMatrix,
			inverseViewMatrix: this.inverseViewMatrix,
		});

		this.updateProjectionViewMatrix();
		return this;
	}

	public updateProjectionMatrix(): this {
		mat4.inverse(this.projectionMatrix, this.inverseProjectionMatrix);
		this.bufferUniformValues.set({
			projectionMatrix: this.projectionMatrix,
			inverseProjectionMatrix: this.inverseProjectionMatrix,
		});
		this.updateProjectionViewMatrix();

		return this;
	}

	public updateProjectionViewMatrix(): this {
		mat4.mul(this.projectionMatrix, this.viewMatrix, this.projectionViewMatrix);
		mat4.inverse(this.projectionViewMatrix, this.inverseProjectionViewMatrix);
		this.bufferUniformValues.set({
			projectionViewMatrix: this.projectionViewMatrix,
			inverseProjectionViewMatrix: this.inverseProjectionViewMatrix,
			prevFrameProjectionViewMatrix: this.prevFrameProjectionViewMatrix,
		});

		this.updateFrustumPlanes();

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
		RenderingContext.device.queue.writeBuffer(
			this.gpuBuffer,
			0,
			this.bufferUniformValues.arrayBuffer,
		);
	}

	public onFrameEnd() {
		mat4.copy(this.projectionViewMatrix, this.prevFrameProjectionViewMatrix);
		this.frameCounter++;
		this.hasChangedSinceLastFrame = false;
	}

	private updateFrustumPlanes() {
		const vpMatrix = this.projectionViewMatrix;

		// left plane
		this.frustumPlanes[0].normal[0] = vpMatrix[3] + vpMatrix[0];
		this.frustumPlanes[0].normal[1] = vpMatrix[7] + vpMatrix[4];
		this.frustumPlanes[0].normal[2] = vpMatrix[11] + vpMatrix[8];
		this.frustumPlanes[0].d = vpMatrix[15] + vpMatrix[12];

		// right plane
		this.frustumPlanes[1].normal[0] = vpMatrix[3] - vpMatrix[0];
		this.frustumPlanes[1].normal[1] = vpMatrix[7] - vpMatrix[4];
		this.frustumPlanes[1].normal[2] = vpMatrix[11] - vpMatrix[8];
		this.frustumPlanes[1].d = vpMatrix[15] - vpMatrix[12];

		// bottom plane
		this.frustumPlanes[2].normal[0] = vpMatrix[3] + vpMatrix[1];
		this.frustumPlanes[2].normal[1] = vpMatrix[7] + vpMatrix[5];
		this.frustumPlanes[2].normal[2] = vpMatrix[11] + vpMatrix[9];
		this.frustumPlanes[2].d = vpMatrix[15] + vpMatrix[13];

		// top plane
		this.frustumPlanes[3].normal[0] = vpMatrix[3] - vpMatrix[1];
		this.frustumPlanes[3].normal[1] = vpMatrix[7] - vpMatrix[5];
		this.frustumPlanes[3].normal[2] = vpMatrix[11] - vpMatrix[9];
		this.frustumPlanes[3].d = vpMatrix[15] - vpMatrix[13];

		// near plane
		this.frustumPlanes[4].normal[0] = vpMatrix[3] + vpMatrix[2];
		this.frustumPlanes[4].normal[1] = vpMatrix[7] + vpMatrix[6];
		this.frustumPlanes[4].normal[2] = vpMatrix[11] + vpMatrix[10];
		this.frustumPlanes[4].d = vpMatrix[15] + vpMatrix[14];

		// far plane
		this.frustumPlanes[5].normal[0] = vpMatrix[3] - vpMatrix[2];
		this.frustumPlanes[5].normal[1] = vpMatrix[7] - vpMatrix[6];
		this.frustumPlanes[5].normal[2] = vpMatrix[11] - vpMatrix[10];
		this.frustumPlanes[5].d = vpMatrix[15] - vpMatrix[14];

		for (const plane of this.frustumPlanes) {
			plane.normalize();
		}
	}
}
