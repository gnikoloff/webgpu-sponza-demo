import Renderer from "../../app/Renderer";
import Camera from "../camera/Camera";
import PipelineStates from "./PipelineStates";
import Transform from "../scene/Transform";
import Scene from "../scene/Scene";
import { BIND_GROUP_LOCATIONS } from "./RendererBindings";
import { RenderPassType } from "../types";
import { RenderPassNames } from "../constants";
import RenderPassTimingHelper from "../debug/RenderPassTimingHelper";

export default class RenderPass extends RenderPassTimingHelper {
	protected cameraBindGroup?: GPUBindGroup;
	protected camera?: Camera;
	protected debugCamera?: Camera;

	protected timestampQuery?: GPUQuerySet;
	protected timestampQueryResolveBuffer?: GPUBuffer;
	public timestampQueryResultBuffer?: GPUBuffer;

	constructor(public type: RenderPassType, protected scene: Scene) {
		super(type);

		if (Renderer.supportsGPUTimestampQuery) {
			this.timestampQuery = Renderer.device.createQuerySet({
				type: "timestamp",
				count: 2,
			});
			const name = RenderPassNames.get(type);
			this.timestampQueryResolveBuffer = Renderer.device.createBuffer({
				label: `Timestamp Query Resolve Buffer for Pass: ${name}`,
				size: this.timestampQuery.count * 8,
				usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
			});
			this.timestampQueryResultBuffer = Renderer.device.createBuffer({
				label: `Timestamp Query Result Buffer for Pass: ${name}`,
				size: this.timestampQueryResolveBuffer.size,
				usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
			});
		}
	}

	protected createRenderPassDescriptor(): GPURenderPassDescriptor {
		throw new Error("Needs implementation");
	}

	public setDebugCamera(camera: Camera) {
		this.debugCamera = camera;
	}

	public toggleDebugCamera(v: boolean) {
		this.cameraBindGroup = Renderer.device.createBindGroup({
			label: `Camera Bind Group for: ${RenderPassNames.get(this.type)}`,
			layout: PipelineStates.defaultCameraBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: v ? this.debugCamera.gpuBuffer : this.camera.gpuBuffer,
					},
				},
			],
		});
	}

	public setCamera(camera: Camera) {
		this.camera = camera;

		this.cameraBindGroup = Renderer.device.createBindGroup({
			label: `Camera Bind Group for: ${RenderPassNames.get(this.type)}`,
			layout: PipelineStates.defaultCameraBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: camera.gpuBuffer,
					},
				},
			],
		});
	}

	public onResize(_width: number, _height: number) {
		// noop
	}

	public render(commandEncoder: GPUCommandEncoder, scene: Transform) {
		const renderPassDescriptor = this.createRenderPassDescriptor();
		const renderPassEncoder =
			commandEncoder.beginRenderPass(renderPassDescriptor);

		if (this.cameraBindGroup) {
			renderPassEncoder.setBindGroup(
				BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
				this.cameraBindGroup,
			);
		}

		renderPassEncoder.end();
	}
}
