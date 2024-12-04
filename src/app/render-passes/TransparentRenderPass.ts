import Camera from "../../renderer/camera/Camera";
import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass, { RenderPassType } from "../../renderer/core/RenderPass";
import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import Scene from "../../renderer/scene/Scene";
import Renderer from "../Renderer";

export default class TransparentRenderPass extends RenderPass {
	public inPlaceTextureView: GPUTextureView;
	public inPlaceDepthStencilTextureView: GPUTextureView;

	constructor(scene: Scene) {
		super(RenderPassType.Transparent, scene);
	}

	public override toggleDebugCamera(v: boolean) {
		this.cameraBindGroup = Renderer.device.createBindGroup({
			label: `Camera Bind Group for: Transparent Pass`,
			layout: PipelineStates.defaultCameraPlusLightsBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: v ? this.debugCamera.gpuBuffer : this.camera.gpuBuffer,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.scene.lightsBuffer,
					},
				},
			],
		});
	}

	public setCamera(camera: Camera) {
		this.camera = camera;

		this.cameraBindGroup = Renderer.device.createBindGroup({
			label: `Camera Bind Group for: Transparent Pass`,
			layout: PipelineStates.defaultCameraPlusLightsBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: camera.gpuBuffer,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.scene.lightsBuffer,
					},
				},
			],
		});
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.inPlaceTextureView,
				loadOp: "load",
				storeOp: "store",
			},
		];
		return {
			label: `Transparent Render Pass`,
			colorAttachments: renderPassColorAttachments,
			depthStencilAttachment: {
				view: this.inPlaceDepthStencilTextureView,
				depthLoadOp: "load",
				depthStoreOp: "store",
				stencilReadOnly: true,
			},
		};
	}

	public override render(commandEncoder: GPUCommandEncoder): void {
		Renderer.activeRenderPass = this.type;

		const renderPassEncoder = commandEncoder.beginRenderPass(
			this.createRenderPassDescriptor(),
		);
		renderPassEncoder.pushDebugGroup("Render Transparent Nodes");

		renderPassEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.cameraBindGroup,
		);

		this.scene.renderTransparentNodes(renderPassEncoder, this.camera);

		renderPassEncoder.popDebugGroup();
		renderPassEncoder.end();
	}
}
