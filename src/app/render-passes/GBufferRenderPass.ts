import Renderer from "../Renderer";
import RenderPass, { RenderPassType } from "../../renderer/core/RenderPass";
import Transform from "../../renderer/scene/Transform";
import { BIND_GROUP_LOCATIONS } from "../constants";

export default class GBufferRenderPass extends RenderPass {
	public normalReflectanceTexture: GPUTexture;
	public normalReflectanceTextureView: GPUTextureView;

	public velocityTexture: GPUTexture;
	public velocityTextureView: GPUTextureView;

	public colorTexture: GPUTexture;
	public colorTextureView: GPUTextureView;

	public depthStencilTexture: GPUTexture;
	public depthStencilTextureView: GPUTextureView;
	public depthTextureView: GPUTextureView;
	public stencilTextureView: GPUTextureView;

	constructor() {
		super();
		this.type = RenderPassType.Deferred;
	}

	public override onResize(width: number, height: number): void {
		if (this.colorTexture) {
			this.colorTexture.destroy();
		}

		this.colorTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: "bgra8unorm",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			label: "Color GBuffer Texture",
		});
		this.colorTextureView = this.colorTexture.createView();

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

		if (this.normalReflectanceTexture) {
			this.normalReflectanceTexture.destroy();
		}
		this.normalReflectanceTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: "rgba16float",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			label: "Normal + Reflectance GBuffer Texture",
		});
		this.normalReflectanceTextureView =
			this.normalReflectanceTexture.createView();

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
				view: this.normalReflectanceTextureView,
				loadOp: "clear",
				clearValue: [0, 0, 0, 0],
				storeOp: "store",
			},
			{
				view: this.colorTextureView,
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

	public override render(
		commandEncoder: GPUCommandEncoder,
		scene: Transform,
	): void {
		Renderer.activeRenderPass = this.type;

		const renderPassDescriptor = this.createRenderPassDescriptor();
		const renderPassEncoder =
			commandEncoder.beginRenderPass(renderPassDescriptor);

		if (this.cameraBindGroup) {
			renderPassEncoder.setBindGroup(
				BIND_GROUP_LOCATIONS.Camera,
				this.cameraBindGroup,
			);
		}

		renderPassEncoder.setStencilReference(128);

		scene.traverse((node) => {
			node.render(renderPassEncoder);
		});

		renderPassEncoder.end();
	}
}
