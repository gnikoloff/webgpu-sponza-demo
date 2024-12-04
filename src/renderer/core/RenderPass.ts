import Renderer from "../../app/Renderer";
import Camera from "../camera/Camera";
import PipelineStates from "./PipelineStates";
import Transform from "../scene/Transform";
import Scene from "../scene/Scene";
import { BIND_GROUP_LOCATIONS } from "./RendererBindings";

export enum RenderPassType {
	Deferred,
	DeferredLighting,
	Transparent,
	Shadow,
	EnvironmentCube,
	TAAResolve,
	Reflection,
	DebugBounds,
}

const RenderPassNames: Map<RenderPassType, string> = new Map([
	[RenderPassType.Deferred, "G-Buffer Render Pass"],
	[RenderPassType.DeferredLighting, "Lighting Pass"],
	[RenderPassType.Transparent, "Transparent Pass"],
	[RenderPassType.Shadow, "Shadow Pass"],
	[RenderPassType.EnvironmentCube, "Environment Cube Pass"],
	[RenderPassType.TAAResolve, "TAA Resolve Pass"],
	[RenderPassType.Reflection, "SSR Pass"],
	[RenderPassType.DebugBounds, "Debug Bounds Pass"],
]);

export default class RenderPass {
	protected cameraBindGroup?: GPUBindGroup;
	protected camera?: Camera;
	protected debugCamera?: Camera;

	constructor(public type: RenderPassType, protected scene: Scene) {}

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
