import RenderPass from "../../renderer/core/RenderPass";
import {
	BIND_GROUP_LOCATIONS,
	RENDER_TARGET_LOCATIONS,
} from "../../renderer/core/RendererBindings";
import RenderingContext from "../../renderer/core/RenderingContext";
import VRAMUsageTracker from "../../renderer/misc/VRAMUsageTracker";
import Scene from "../../renderer/scene/Scene";
import { RenderPassType } from "../../renderer/types";

export default class GBufferRenderPass extends RenderPass {
	constructor(width: number, height: number) {
		super(RenderPassType.Deferred, width, height);

		this.outTextures.push(
			RenderingContext.device.createTexture({
				dimension: "2d",
				format: "rgba16float",
				mipLevelCount: 1,
				sampleCount: 1,
				size: { width, height, depthOrArrayLayers: 1 },
				usage:
					GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
				label: "Normal + Metallic + Roughness + GBuffer Texture",
			}),
		);

		this.outTextures.push(
			RenderingContext.device.createTexture({
				dimension: "2d",
				format: "bgra8unorm",
				mipLevelCount: 1,
				sampleCount: 1,
				size: { width, height, depthOrArrayLayers: 1 },
				usage:
					GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
				label: "Color + Reflectance GBuffer Texture",
			}),
		);

		this.outTextures.push(
			RenderingContext.device.createTexture({
				dimension: "2d",
				format: "rg16float",
				mipLevelCount: 1,
				sampleCount: 1,
				size: { width, height, depthOrArrayLayers: 1 },
				usage:
					GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
				label: "Velocity GBuffer Texture",
			}),
		);

		this.outTextures.push(
			RenderingContext.device.createTexture({
				dimension: "2d",
				format: RenderingContext.depthStencilFormat,
				mipLevelCount: 1,
				sampleCount: 1,
				size: { width, height, depthOrArrayLayers: 1 },
				usage:
					GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
				label: "Depth + Stencil GBuffer Texture",
			}),
		);

		for (const tex of this.outTextures) {
			VRAMUsageTracker.addTextureBytes(tex);
		}
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		if (this.renderPassDescriptor) {
			return this.renderPassDescriptor;
		}

		const mainRenderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.outTextures[
					RENDER_TARGET_LOCATIONS.NormalMetallicRoughness
				].createView(),
				loadOp: "clear",
				clearValue: [0, 0, 0, 0],
				storeOp: "store",
			},
			{
				view: this.outTextures[
					RENDER_TARGET_LOCATIONS.ColorReflectance
				].createView(),
				loadOp: "clear",
				clearValue: [0, 0, 0, 0],
				storeOp: "store",
			},
			{
				view: this.outTextures[RENDER_TARGET_LOCATIONS.Velocity].createView(),
				loadOp: "clear",
				clearValue: [0, 0, 0, 0],
				storeOp: "store",
			},
		];

		this.renderPassDescriptor =
			this.augmentRenderPassDescriptorWithTimestampQuery({
				colorAttachments: mainRenderPassColorAttachments,
				depthStencilAttachment: {
					view: this.outTextures[3].createView(),
					depthLoadOp: "clear",
					depthStoreOp: "store",
					depthClearValue: 1,
					stencilLoadOp: "clear",
					stencilStoreOp: "store",
					stencilClearValue: 0,
				},
				label: "GBuffer Render Pass",
			});
		return this.renderPassDescriptor;
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		const renderPassDescriptor = this.createRenderPassDescriptor();
		const renderPassEncoder =
			commandEncoder.beginRenderPass(renderPassDescriptor);

		RenderingContext.setActiveRenderPass(this.type, renderPassEncoder);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPassEncoder.pushDebugGroup("Render G-Buffer");
		}

		renderPassEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.cameraBindGroup,
		);

		renderPassEncoder.setStencilReference(128);

		scene.renderOpaqueNodes(renderPassEncoder, this.camera);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPassEncoder.popDebugGroup();
		}
		renderPassEncoder.end();

		this.postRender(commandEncoder);

		return this.outTextures;
	}
}
