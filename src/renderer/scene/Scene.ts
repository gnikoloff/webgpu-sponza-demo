import { vec3 } from "wgpu-matrix";
import Renderer from "../../app/Renderer";
import Camera from "../camera/Camera";
import DirectionalLight from "../lighting/DirectionalLight";
import Light from "../lighting/Light";
import PointLight from "../lighting/PointLight";
import Drawable from "./Drawable";
import Transform from "./Transform";

export default class Scene extends Transform {
	public opaqueMeshes: Drawable[] = [];
	public transparentMeshes: Drawable[] = [];

	private culledOpaqueMeshes: Drawable[] = [];
	private culledTransparentMeshes: Drawable[] = [];

	public lightsBuffer?: GPUBuffer;

	private _pointLights: PointLight[] = [];
	private _directionalLights: DirectionalLight[] = [];
	private _lights: Light[] = [];

	public get nodesCount(): number {
		return this.opaqueMeshes.length + this.transparentMeshes.length;
	}

	public getLights(): Light[] {
		return this._lights;
	}

	public addPointLight(v: PointLight) {
		this._pointLights.push(v);
		this._lights.push(v);
	}

	public getPointLights(): PointLight[] {
		return this._pointLights;
	}

	public getPointLightAt(idx: number): PointLight {
		return this._pointLights[idx];
	}

	public addDirectionalLight(v: DirectionalLight) {
		this._directionalLights.push(v);
		this._lights.push(v);
	}

	public getDiretionalLights(): DirectionalLight[] {
		return this._directionalLights;
	}

	public getDirectionalLightAt(idx: number): DirectionalLight {
		return this._directionalLights[idx];
	}

	public renderOpaqueNodes(
		renderPassEncoder: GPURenderPassEncoder,
		camera: Camera,
	) {
		const nonCulledCount = camera.cullMeshes(
			this.opaqueMeshes,
			this.culledOpaqueMeshes,
		);

		for (let i = 0; i < nonCulledCount; i++) {
			this.culledOpaqueMeshes[i].render(renderPassEncoder);
		}
	}

	public renderTransparentNodes(
		renderPassEncoder: GPURenderPassEncoder,
		camera: Camera,
	) {
		const nonCulledCount = camera.cullMeshes(
			this.transparentMeshes,
			this.culledTransparentMeshes,
		);

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

	public updateLightsBuffer() {
		if (this.lightsBuffer) {
			this.lightsBuffer.destroy();
		}
		this.lightsBuffer = Renderer.device.createBuffer({
			label: "Scene Lights GPUBuffer",
			size: Light.STRUCT_BYTE_SIZE * this.getLights().length,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		let lightIdx = 0;
		for (let i = 0; i < this._directionalLights.length; i++) {
			Renderer.device.queue.writeBuffer(
				this.lightsBuffer,
				lightIdx * Light.STRUCT_BYTE_SIZE,
				this._directionalLights[i].lightsStorageView.arrayBuffer,
			);
			lightIdx++;
		}
		for (let i = 0; i < this._pointLights.length; i++) {
			Renderer.device.queue.writeBuffer(
				this.lightsBuffer,
				lightIdx * Light.STRUCT_BYTE_SIZE,
				this._pointLights[i].lightsStorageView.arrayBuffer,
			);
			lightIdx++;
		}

		this.lightsBuffer.unmap();
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
	}
}
