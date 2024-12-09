import RenderPass from "../../renderer/core/RenderPass";
import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import Scene from "../../renderer/scene/Scene";
import Transform from "../../renderer/scene/Transform";
import { RenderPassType } from "../../renderer/types";
import Renderer from "../Renderer";

export default class SkyboxRenderPass extends RenderPass {
	constructor() {
		super(RenderPassType.Skybox);
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.inputTextureViews[0],
				loadOp: "load",
				storeOp: "store",
			},
		];
		return this.augmentRenderPassDescriptorWithTimestampQuery({
			label: "Skybox render Pass",
			colorAttachments: renderPassColorAttachments,
			depthStencilAttachment: {
				depthReadOnly: true,
				view: this.inputTextureViews[1],
				stencilLoadOp: "load",
				stencilStoreOp: "store",
			},
		});
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		Renderer.activeRenderPass = this.type;

		if (!this.inputTextureViews.length) {
			this.inputTextureViews.push(inputs[0].createView());
			this.inputTextureViews.push(inputs[1].createView());
		}

		const renderEncoder = commandEncoder.beginRenderPass(
			this.createRenderPassDescriptor(),
		);
		renderEncoder.pushDebugGroup("Begin Skybox");

		renderEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.cameraBindGroup,
		);

		scene.skybox?.render(renderEncoder);

		renderEncoder.popDebugGroup();
		renderEncoder.end();

		this.resolveTiming(commandEncoder);

		return inputs;
	}
}
