import RenderPass from "../../renderer/core/RenderPass";
import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import RenderingContext from "../../renderer/core/RenderingContext";
import Scene from "../../renderer/scene/Scene";
import Transform from "../../renderer/scene/Transform";
import { RenderPassType } from "../../renderer/types";
import Renderer from "../Renderer";

export default class SkyboxRenderPass extends RenderPass {
	constructor() {
		super(RenderPassType.Skybox);
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
				label: "Skybox render Pass",
				colorAttachments: renderPassColorAttachments,
				depthStencilAttachment: {
					// depthReadOnly: true,
					stencilReadOnly: true,
					view: this.inputTextureViews[1],
					depthLoadOp: "load",
					depthStoreOp: "store",
					// stencilLoadOp: "load",
					// stencilStoreOp: "discard",
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

		const renderEncoder = commandEncoder.beginRenderPass(
			this.createRenderPassDescriptor(),
		);

		RenderingContext.setActiveRenderPass(this.type, renderEncoder);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderEncoder.pushDebugGroup("Begin Skybox");
		}

		renderEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.cameraBindGroup,
		);

		scene.skybox?.render(renderEncoder);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderEncoder.popDebugGroup();
		}
		renderEncoder.end();

		this.resolveTiming(commandEncoder);

		return inputs;
	}
}
