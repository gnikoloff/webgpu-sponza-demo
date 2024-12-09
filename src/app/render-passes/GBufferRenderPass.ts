import RenderPass from "../../renderer/core/RenderPass";
import RenderingContext from "../../renderer/core/RenderingContext";
import Scene from "../../renderer/scene/Scene";
import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import { RenderPassType } from "../../renderer/types";

export default class GBufferRenderPass extends RenderPass {
	private normalMetallicRoughnessTexture: GPUTexture;
	private velocityTexture: GPUTexture;
	private colorReflectanceTexture: GPUTexture;
	private depthStencilTexture: GPUTexture;

	constructor() {
		super(RenderPassType.Deferred);
	}

	public override onResize(width: number, height: number): void {
		if (this.colorReflectanceTexture) {
			this.colorReflectanceTexture.destroy();
		}

		this.colorReflectanceTexture = RenderingContext.device.createTexture({
			dimension: "2d",
			format: "bgra8unorm",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			label: "Color + Reflectance GBuffer Texture",
		});

		if (this.velocityTexture) {
			this.velocityTexture.destroy();
		}
		this.velocityTexture = RenderingContext.device.createTexture({
			dimension: "2d",
			format: "rg16float",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			label: "Velocity GBuffer Texture",
		});

		if (this.normalMetallicRoughnessTexture) {
			this.normalMetallicRoughnessTexture.destroy();
		}
		this.normalMetallicRoughnessTexture = RenderingContext.device.createTexture(
			{
				dimension: "2d",
				format: "rgba16float",
				mipLevelCount: 1,
				sampleCount: 1,
				size: { width, height, depthOrArrayLayers: 1 },
				usage:
					GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
				label: "Normal + Metallic + Roughness + GBuffer Texture",
			},
		);

		if (this.depthStencilTexture) {
			this.depthStencilTexture.destroy();
		}
		this.depthStencilTexture = RenderingContext.device.createTexture({
			dimension: "2d",
			format: RenderingContext.depthStencilFormat,
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			label: "Depth + Stencil GBuffer Texture",
		});
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		const mainRenderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.normalMetallicRoughnessTexture.createView(),
				loadOp: "clear",
				clearValue: [0, 0, 0, 0],
				storeOp: "store",
			},
			{
				view: this.colorReflectanceTexture.createView(),
				loadOp: "clear",
				clearValue: [0, 0, 0, 0],
				storeOp: "store",
			},
			{
				view: this.velocityTexture.createView(),
				loadOp: "clear",
				clearValue: [0, 0, 0, 0],
				storeOp: "store",
			},
		];

		return this.augmentRenderPassDescriptorWithTimestampQuery({
			colorAttachments: mainRenderPassColorAttachments,
			depthStencilAttachment: {
				view: this.depthStencilTexture.createView(),
				depthLoadOp: "clear",
				depthStoreOp: "store",
				depthClearValue: 1,
				stencilLoadOp: "clear",
				stencilStoreOp: "store",
				stencilClearValue: 0,
			},
			label: "GBuffer Render Pass",
		});
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

		renderPassEncoder.pushDebugGroup("Render G-Buffer");

		renderPassEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.cameraBindGroup,
		);

		renderPassEncoder.setStencilReference(128);

		scene.renderOpaqueNodes(renderPassEncoder, this.camera);

		renderPassEncoder.popDebugGroup();
		renderPassEncoder.end();

		this.resolveTiming(commandEncoder);

		return [
			this.normalMetallicRoughnessTexture,
			this.colorReflectanceTexture,
			this.velocityTexture,
			this.depthStencilTexture,
		];
	}
}
