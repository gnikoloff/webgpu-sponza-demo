import { BIND_GROUP_LOCATIONS } from "../../app/constants";
import Renderer from "../../app/Renderer";
import Camera from "../camera/Camera";
import PipelineStates from "./PipelineStates";
import Transform from "../scene/Transform";

export default class RenderPass {
	protected cameraBindGroup?: GPUBindGroup;
	protected camera?: Camera;

	constructor() {}

	protected createRenderPassDescriptor(): GPURenderPassDescriptor {
		throw new Error("Needs implementation");
	}

	public setCamera(camera: Camera) {
		this.camera = camera;

		this.cameraBindGroup = Renderer.device.createBindGroup({
			label: "Main Camera Bind Group",
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
				BIND_GROUP_LOCATIONS.Camera,
				this.cameraBindGroup,
			);
		}

		scene.traverse((node) => {
			node.render(renderPassEncoder);
		});

		renderPassEncoder.end();
	}
}
