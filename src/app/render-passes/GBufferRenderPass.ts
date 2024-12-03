import Renderer from "../Renderer";
import RenderPass, { RenderPassType } from "../../renderer/core/RenderPass";
import Transform from "../../renderer/scene/Transform";
import Scene from "../../renderer/scene/Scene";
import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";

export default class GBufferRenderPass extends RenderPass {
	public normalMetallicRoughnessTexture: GPUTexture;
	public normalMetallicRoughnessTextureView: GPUTextureView;

	public velocityTexture: GPUTexture;
	public velocityTextureView: GPUTextureView;

	public colorReflectanceTexture: GPUTexture;
	public colorReflectanceTextureView: GPUTextureView;

	public depthStencilTexture: GPUTexture;
	public depthStencilTextureView: GPUTextureView;
	public depthTextureView: GPUTextureView;
	public stencilTextureView: GPUTextureView;

	constructor(scene: Scene) {
		super(RenderPassType.Deferred, scene);
	}

	public override onResize(width: number, height: number): void {
		if (this.colorReflectanceTexture) {
			this.colorReflectanceTexture.destroy();
		}

		this.colorReflectanceTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: "bgra8unorm",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			label: "Color + Reflectance GBuffer Texture",
		});
		this.colorReflectanceTextureView =
			this.colorReflectanceTexture.createView();

		if (this.velocityTexture) {
			this.velocityTexture.destroy();
		}
		this.velocityTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: "rg16float",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			label: "Velocity GBuffer Texture",
		});
		this.velocityTextureView = this.velocityTexture.createView();

		if (this.normalMetallicRoughnessTexture) {
			this.normalMetallicRoughnessTexture.destroy();
		}
		this.normalMetallicRoughnessTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: "rgba16float",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			label: "Normal + Metallic + Roughness + GBuffer Texture",
		});
		this.normalMetallicRoughnessTextureView =
			this.normalMetallicRoughnessTexture.createView();

		if (this.depthStencilTexture) {
			this.depthStencilTexture.destroy();
		}
		this.depthStencilTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: Renderer.depthStencilFormat,
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			label: "Depth + Stencil GBuffer Texture",
		});
		this.depthStencilTextureView = this.depthStencilTexture.createView();
		this.depthTextureView = this.depthStencilTexture.createView({
			aspect: "depth-only",
		});
		this.stencilTextureView = this.depthStencilTexture.createView({
			aspect: "stencil-only",
		});
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		const mainRenderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.normalMetallicRoughnessTextureView,
				loadOp: "clear",
				clearValue: [0, 0, 0, 0],
				storeOp: "store",
			},
			{
				view: this.colorReflectanceTextureView,
				loadOp: "clear",
				clearValue: [0, 0, 0, 0],
				storeOp: "store",
			},
			{
				view: this.velocityTextureView,
				loadOp: "clear",
				clearValue: [0, 0, 0, 0],
				storeOp: "store",
			},
		];

		return {
			colorAttachments: mainRenderPassColorAttachments,
			depthStencilAttachment: {
				view: this.depthStencilTextureView,
				depthLoadOp: "clear",
				depthStoreOp: "store",
				depthClearValue: 1,
				stencilLoadOp: "clear",
				stencilStoreOp: "store",
				stencilClearValue: 0,
			},
			label: "GBuffer Render Pass",
		};
	}

	public override render(commandEncoder: GPUCommandEncoder): void {
		Renderer.activeRenderPass = this.type;

		const renderPassDescriptor = this.createRenderPassDescriptor();
		const renderPassEncoder =
			commandEncoder.beginRenderPass(renderPassDescriptor);

		renderPassEncoder.pushDebugGroup("Render G-Buffer");

		renderPassEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.cameraBindGroup,
		);

		renderPassEncoder.setStencilReference(128);

		this.scene.renderOpaqueNodes(renderPassEncoder);

		renderPassEncoder.popDebugGroup();
		renderPassEncoder.end();
	}
}
