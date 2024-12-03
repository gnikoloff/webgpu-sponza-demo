import { vec3 } from "wgpu-matrix";
import Renderer from "../../app/Renderer";
import Camera from "../camera/Camera";
import DirectionalLight from "../lighting/DirectionalLight";
import Light from "../lighting/Light";
import PointLight from "../lighting/PointLight";
import Drawable from "./Drawable";
import Transform from "./Transform";

export default class Scene extends Transform {
	public opaqueNodes: Drawable[] = [];
	public transparentNodes: Drawable[] = [];

	public lightsBuffer?: GPUBuffer;

	private _pointLights: PointLight[] = [];
	private _directionalLights: DirectionalLight[] = [];
	private _lights: Light[] = [];

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

	public renderOpaqueNodes(renderPassEncoder: GPURenderPassEncoder) {
		for (const node of this.opaqueNodes) {
			node.render(renderPassEncoder);
		}
	}

	public renderTransparentNodes(renderPassEncoder: GPURenderPassEncoder) {
		for (const node of this.transparentNodes) {
			node.render(renderPassEncoder);
		}
	}

	public sortTransparentNodesFrom(camera: Camera) {
		console.log("---");
		if (this.transparentNodes.length) {
			// debugger;
			this.transparentNodes[10].worldPosition;
		}
		this.transparentNodes.sort((a, b) => {
			const diffAx = camera.position[0] - a.worldPosition[0];
			const diffAy = camera.position[1] - a.worldPosition[1];
			const diffAz = camera.position[2] - a.worldPosition[2];

			const diffBx = camera.position[0] - b.worldPosition[0];
			const diffBy = camera.position[1] - b.worldPosition[1];
			const diffBz = camera.position[2] - b.worldPosition[2];

			const d0 = vec3.lenSq(vec3.sub(camera.position, a.worldPosition));
			const d1 = vec3.lenSq(vec3.sub(camera.position, b.worldPosition));
			// console.log(`d0 ${d0}`);
			// console.log(`d1 ${d1}`);

			const diffASq = diffAx * diffAy * diffAz;
			const diffBSq = diffBx * diffBy * diffBz;
			const out = diffASq - diffBSq;
			// console.log(out);
			// debugger;
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
				this.opaqueNodes.push(child);
				// console.log(`new opaque nodes count: ${this.opaqueNodes.length}`);
			} else {
				this.transparentNodes.push(child);
				// console.log(
				// 	`new transparent nodes count: ${this.transparentNodes.length}`,
				// );
			}
		}
	}

	protected override onChildRemove(child: Transform): void {
		super.onChildRemove(child);
		if (child instanceof Drawable) {
			if (child.isOpaque) {
				this.opaqueNodes = this.opaqueNodes.filter(({ id }) => id !== child.id);
			} else {
				this.transparentNodes = this.transparentNodes.filter(
					({ id }) => id !== child.id,
				);
			}
		}
	}
}
