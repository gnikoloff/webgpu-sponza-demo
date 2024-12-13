import Camera from "../../renderer/camera/Camera";
import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import RenderingContext from "../../renderer/core/RenderingContext";
import Scene from "../../renderer/scene/Scene";
import { RenderPassType } from "../../renderer/types";

export default class TransparentRenderPass extends RenderPass {
	constructor() {
		super(RenderPassType.Transparent);
	}

	public override toggleDebugCamera(v: boolean) {
		// ...
	}

	public setCamera(camera: Camera): this {
		this.camera = camera;
		return this;
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		if (this.renderPassDescriptor) {
			return this.renderPassDescriptor;
		}
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.inputTextureViews[0],
				loadOp: "load",
				storeOp: "store",
			},
		];
		this.renderPassDescriptor =
			this.augmentRenderPassDescriptorWithTimestampQuery({
				label: `Transparent Render Pass`,
				colorAttachments: renderPassColorAttachments,
				depthStencilAttachment: {
					view: this.inputTextureViews[1],
					depthLoadOp: "load",
					depthStoreOp: "store",
					stencilReadOnly: true,
				},
			});
		return this.renderPassDescriptor;
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		if (!this.inputTextureViews.length) {
			this.inputTextureViews.push(inputs[0].createView());
			this.inputTextureViews.push(inputs[1].createView());
		}

		const renderPassEncoder = commandEncoder.beginRenderPass(
			this.createRenderPassDescriptor(),
		);

		RenderingContext.setActiveRenderPass(this.type, renderPassEncoder);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPassEncoder.pushDebugGroup("Render Transparent Nodes");
		}

		this.cameraBindGroup = RenderingContext.device.createBindGroup({
			label: `Camera Bind Group for: Transparent Pass`,
			layout: PipelineStates.defaultCameraPlusLightsBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.camera.gpuBuffer,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: scene.lightingManager.gpuBuffer,
					},
				},
			],
		});

		renderPassEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.cameraBindGroup,
		);

		scene.lightingManager.render(renderPassEncoder);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPassEncoder.popDebugGroup();
		}
		renderPassEncoder.end();

		this.resolveTiming(commandEncoder);

		return inputs;
	}
}
