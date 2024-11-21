import Renderer from "../Renderer";
import RenderPass from "../../renderer/core/RenderPass";

export default class GBufferRenderPass extends RenderPass {
	public normalTexture: GPUTexture;
	public normalReflectanceTextureView: GPUTextureView;

	public colorTexture: GPUTexture;
	public colorTextureView: GPUTextureView;

	public depthTexture: GPUTexture;
	public depthTextureView: GPUTextureView;

	public override resize(width: number, height: number): void {
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

		if (this.normalTexture) {
			this.normalTexture.destroy();
		}
		this.normalTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: "rgba16float",
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			label: "Normal + Reflectance GBuffer Texture",
		});
		this.normalReflectanceTextureView = this.normalTexture.createView();

		if (this.depthTexture) {
			this.depthTexture.destroy();
		}
		this.depthTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: Renderer.depthFormat,
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width, height, depthOrArrayLayers: 1 },
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			label: "Depth GBuffer Texture",
		});
		this.depthTextureView = this.depthTexture.createView();
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		const mainRenderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.normalReflectanceTextureView,
				loadOp: "clear",
				clearValue: [0.1, 0.1, 0.1, 1],
				storeOp: "store",
			},
			{
				view: this.colorTextureView,
				loadOp: "clear",
				clearValue: [0.1, 0.1, 0.1, 1],
				storeOp: "store",
			},
		];

		return {
			colorAttachments: mainRenderPassColorAttachments,
			depthStencilAttachment: {
				view: this.depthTextureView,
				depthLoadOp: "clear",
				depthStoreOp: "store",
				depthClearValue: 1,
			},
			label: "GBuffer Render Pass",
		};
	}
}
