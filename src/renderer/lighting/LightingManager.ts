import RenderingContext from "../core/RenderingContext";
import VRAMUsageTracker from "../misc/VRAMUsageTracker";
import CameraFaceCulledPointLight from "./CameraFaceCulledPointLight";
import DirectionalLight from "./DirectionalLight";
import Light from "./Light";
import PointLight from "./PointLight";

export default class LightingManager {
	public pointLights: PointLight[] = [];
	public cameraFaceCulledPointLights: CameraFaceCulledPointLight[] = [];
	public directionalLights: DirectionalLight[] = [];
	public allLights: Light[] = [];

	public gpuBuffer!: GPUBuffer;

	get lightsCount(): number {
		return this.allLights.length;
	}

	get pointLightsCount(): number {
		return this.pointLights.length;
	}

	get directionalLightsCount(): number {
		return this.directionalLights.length;
	}

	public updateGPUBuffer(): this {
		if (!this.allLights.length) {
			console.warn("No lights, skip creating GPUBuffer");
			return;
		}

		if (this.gpuBuffer) {
			VRAMUsageTracker.removeBufferBytes(this.gpuBuffer);
			this.gpuBuffer.destroy();
		}
		this.gpuBuffer = RenderingContext.device.createBuffer({
			label: "Lights GPU Buffer",
			size: Light.STRUCT_BYTE_SIZE * this.allLights.length,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
		});

		VRAMUsageTracker.addBufferBytes(this.gpuBuffer);

		// TODO: this can be better done by mapping the buffer at creation
		let lightIdx = 0;
		for (let i = 0; i < this.directionalLights.length; i++) {
			RenderingContext.device.queue.writeBuffer(
				this.gpuBuffer,
				lightIdx * Light.STRUCT_BYTE_SIZE,
				this.directionalLights[i].lightsStorageView.arrayBuffer,
			);
			lightIdx++;
		}

		for (let i = 0; i < this.pointLights.length; i++) {
			RenderingContext.device.queue.writeBuffer(
				this.gpuBuffer,
				lightIdx * Light.STRUCT_BYTE_SIZE,
				this.pointLights[i].lightsStorageView.arrayBuffer,
			);
			lightIdx++;
		}
		return this;
	}

	public addLight(v: Light): this {
		if (v instanceof CameraFaceCulledPointLight) {
			this.cameraFaceCulledPointLights.push(v);
		} else if (v instanceof PointLight) {
			this.pointLights.push(v);
		} else if (v instanceof DirectionalLight) {
			this.directionalLights.push(v);
		}
		this.allLights.push(v);
		return this;
	}

	public removeLight(v: Light): this {
		const filterOut = (light: Light) => light.id !== v.id;
		if (v instanceof CameraFaceCulledPointLight) {
			this.cameraFaceCulledPointLights =
				this.cameraFaceCulledPointLights.filter(filterOut);
		} else if (v instanceof PointLight) {
			this.pointLights = this.pointLights.filter(filterOut);
		} else if (v instanceof DirectionalLight) {
			this.directionalLights = this.directionalLights.filter(filterOut);
		}
		this.allLights = this.allLights.filter(filterOut);
		return this;
	}

	public render(_renderPass: GPURenderPassEncoder) {
		throw new Error("Needs implementation");
	}
}
