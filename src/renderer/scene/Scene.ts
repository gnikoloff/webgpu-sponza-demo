import LineDebugDrawable from "../../app/debug/LineDebugDrawable";
import Camera from "../camera/Camera";
import LightingManager from "../lighting/LightingManager";
import Drawable from "./Drawable";
import Transform from "./Transform";

export default class Scene extends Transform {
	public skybox: Drawable;

	public debugMeshes: Transform[] = [];
	public opaqueMeshes: Drawable[] = [];
	public transparentMeshes: Drawable[] = [];
	public lightingManager: LightingManager;

	private culledOpaqueMeshes: Drawable[] = [];
	private culledTransparentMeshes: Drawable[] = [];

	private nonCulledTransparentCount = 0;
	private nonCulledOpaqueCount = 0;

	private onGraphChangedCallbacks: (() => void)[] = [];

	public get nodesCount(): number {
		return this.opaqueMeshes.length + this.transparentMeshes.length;
	}

	public get visibleNodesCount(): number {
		return this.nonCulledOpaqueCount + this.nonCulledTransparentCount;
	}

	public addOnGraphChangedCallback(v: () => void) {
		this.onGraphChangedCallbacks.push(v);
	}

	public renderDebugMeshes(renderPassEncoder: GPURenderPassEncoder) {
		for (const debugMesh of this.debugMeshes) {
			debugMesh.render(renderPassEncoder);
		}
	}

	public renderOpaqueNodes(
		renderPassEncoder: GPURenderPassEncoder,
		camera?: Camera,
	) {
		if (!camera) {
			for (const mesh of this.opaqueMeshes) {
				mesh.render(renderPassEncoder);
			}
			return;
		}

		const nonCulledCount = camera.cullMeshes(
			this.opaqueMeshes,
			this.culledOpaqueMeshes,
		);

		this.nonCulledOpaqueCount = nonCulledCount;

		for (let i = 0; i < nonCulledCount; i++) {
			this.culledOpaqueMeshes[i].render(renderPassEncoder);
		}
	}

	public renderTransparentNodes(
		renderPassEncoder: GPURenderPassEncoder,
		camera?: Camera,
	) {
		if (!camera) {
			for (const mesh of this.transparentMeshes) {
				mesh.render(renderPassEncoder);
			}
			return;
		}
		const nonCulledCount = camera.cullMeshes(
			this.transparentMeshes,
			this.culledTransparentMeshes,
		);

		this.nonCulledTransparentCount = nonCulledCount;

		for (let i = 0; i < nonCulledCount; i++) {
			this.culledTransparentMeshes[i].render(renderPassEncoder);
		}
	}

	public sortTransparentNodesFrom(camera: Camera) {
		this.transparentMeshes.sort((a, b) => {
			const aBBoxCenter = a.worldBoundingBox.boundingBoxCenter;
			const bBBoxCenter = b.worldBoundingBox.boundingBoxCenter;
			const aWorldPosX =
				a.worldPosition[0] !== 0 ? a.worldPosition[0] : aBBoxCenter[0];
			const aWorldPosY =
				a.worldPosition[1] !== 0 ? a.worldPosition[1] : aBBoxCenter[0];
			const aWorldPosZ =
				a.worldPosition[2] !== 0 ? a.worldPosition[2] : aBBoxCenter[0];

			const bWorldPosX =
				b.worldPosition[0] !== 0 ? b.worldPosition[0] : bBBoxCenter[0];
			const bWorldPosY =
				b.worldPosition[1] !== 0 ? b.worldPosition[1] : bBBoxCenter[0];
			const bWorldPosZ =
				b.worldPosition[2] !== 0 ? b.worldPosition[2] : bBBoxCenter[0];
			const diffAx = camera.position[0] - aWorldPosX;
			const diffAy = camera.position[1] - aWorldPosY;
			const diffAz = camera.position[2] - aWorldPosZ;

			const diffBx = camera.position[0] - bWorldPosX;
			const diffBy = camera.position[1] - bWorldPosY;
			const diffBz = camera.position[2] - bWorldPosZ;

			const d0 = diffAx * diffAy * diffAz;
			const d1 = diffBx * diffBy * diffBz;

			const out = d1 - d0;
			return out;
		});
	}

	protected override onChildAdd(child: Transform): void {
		if (child instanceof Drawable) {
			if (child.isOpaque) {
				this.opaqueMeshes.push(child);
				this.culledOpaqueMeshes.push(child);
				// console.log(`new opaque nodes count: ${this.opaqueMeshes.length}`);
			} else {
				this.transparentMeshes.push(child);
				this.culledTransparentMeshes.push(child);
				// console.log(
				// 	`new transparent nodes count: ${this.transparentMeshes.length}`,
				// );
			}
		}

		if (child instanceof LineDebugDrawable) {
			this.debugMeshes.push(child);
		}

		for (const callback of this.onGraphChangedCallbacks) {
			callback();
		}
	}

	protected override onChildRemove(child: Transform): void {
		super.onChildRemove(child);

		const filterOut = ({ id }: Transform) => id !== child.id;

		if (child instanceof Drawable) {
			if (child.isOpaque) {
				this.opaqueMeshes = this.opaqueMeshes.filter(filterOut);
				this.culledOpaqueMeshes = this.culledOpaqueMeshes.filter(filterOut);
			} else {
				this.transparentMeshes = this.transparentMeshes.filter(filterOut);
				this.culledTransparentMeshes =
					this.culledTransparentMeshes.filter(filterOut);
			}
		}

		for (const callback of this.onGraphChangedCallbacks) {
			callback();
		}
	}
}
