import RenderPass from "../../renderer/core/RenderPass";
import RenderingContext from "../../renderer/core/RenderingContext";
import VRAMUsageTracker from "../../renderer/misc/VRAMUsageTracker";
import SamplerController from "../../renderer/texture/SamplerController";
import TextureLoader from "../../renderer/texture/TextureLoader";
import { RenderPassType } from "../../renderer/types";
import { LightPassType } from "../../types";

export default class LightRenderPass extends RenderPass {
	protected static readonly RENDER_TARGETS: GPUColorTargetState[] = [
		{
			format: "rgba16float",
			blend: {
				color: {
					srcFactor: "one",
					dstFactor: "one",
					operation: "add",
				},
				alpha: {
					srcFactor: "one",
					dstFactor: "one",
					operation: "add",
				},
			},
		},
	];

	protected gbufferCommonBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [];

	protected gbufferCommonBindGroupLayout: GPUBindGroupLayout;
	protected gbufferTexturesBindGroupEntries: GPUBindGroupEntry[] = [];
	protected gbufferTexturesBindGroup: GPUBindGroup;
	protected debugLightsBuffer: GPUBuffer;

	private _debugLightsMask = false;
	private _debugShadowCascadeLayer = false;

	public set debugLightsMask(v: boolean) {
		this._debugLightsMask = v;
		this.updateLightSettingsBuffer();
	}

	public set debugShadowCascadeLayer(v: boolean) {
		this._debugShadowCascadeLayer = v;
		this.updateLightSettingsBuffer();
	}

	private updateLightSettingsBuffer() {
		RenderingContext.device.queue.writeBuffer(
			this.debugLightsBuffer,
			0,
			new Float32Array([
				this._debugLightsMask ? 1 : 0,
				this._debugShadowCascadeLayer ? 1 : 0,
			]),
		);
	}

	protected updateGbufferBindGroupEntryAt(
		idx: number,
		val: GPUBindingResource,
	): this {
		this.gbufferTexturesBindGroupEntries[idx].resource = val;
		return this;
	}

	protected recreateGBufferTexturesBindGroup() {
		this.gbufferTexturesBindGroup = RenderingContext.device.createBindGroup({
			label: "G-Buffer Textures Input Bind Group",
			layout: this.gbufferCommonBindGroupLayout,
			entries: this.gbufferTexturesBindGroupEntries,
		});
	}

	constructor(type: LightPassType, width: number, height: number) {
		super(type, width, height);

		this.gbufferCommonBindGroupLayoutEntries.push({
			binding: 0,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {},
		});
		this.gbufferCommonBindGroupLayoutEntries.push({
			binding: 1,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {},
		});
		this.gbufferCommonBindGroupLayoutEntries.push({
			binding: 2,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {
				sampleType: "depth",
			},
		});
		this.gbufferCommonBindGroupLayoutEntries.push({
			binding: 3,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {},
		});
		this.gbufferCommonBindGroupLayoutEntries.push({
			binding: 4,
			visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
			buffer: {
				type: "uniform",
			},
		});

		if (
			type === RenderPassType.PointLightsLighting ||
			type === RenderPassType.DirectionalAmbientLighting ||
			type === RenderPassType.PointLightsStencilMask
		) {
			this.gbufferCommonBindGroupLayoutEntries.push({
				binding: 5,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "read-only-storage",
				},
			});
			this.gbufferCommonBindGroupLayoutEntries.push({
				binding: 6,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform",
				},
			});
		}

		this.gbufferCommonBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "GBuffer Textures Bind Group",
				entries: this.gbufferCommonBindGroupLayoutEntries,
			});

		this.debugLightsBuffer = RenderingContext.device.createBuffer({
			label: "Debug Lights GPUBuffer",
			size: 4 * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		});

		VRAMUsageTracker.addBufferBytes(this.debugLightsBuffer);

		new Float32Array(this.debugLightsBuffer.getMappedRange()).set(
			new Float32Array([0, 0]),
		);
		this.debugLightsBuffer.unmap();

		this.gbufferTexturesBindGroupEntries.push({
			binding: 0,
			resource: null,
		});
		this.gbufferTexturesBindGroupEntries.push({
			binding: 1,
			resource: null,
		});
		this.gbufferTexturesBindGroupEntries.push({
			binding: 2,
			resource: null,
		});
		this.gbufferTexturesBindGroupEntries.push({
			binding: 3,
			resource: null,
		});
		this.gbufferTexturesBindGroupEntries.push({
			binding: 4,
			resource: {
				buffer: null,
			},
		});

		if (
			type === RenderPassType.DirectionalAmbientLighting ||
			type === RenderPassType.PointLightsLighting ||
			type === RenderPassType.PointLightsStencilMask
		) {
			this.gbufferTexturesBindGroupEntries.push({
				binding: 5,
				resource: {
					buffer: null,
				},
			});
			this.gbufferTexturesBindGroupEntries.push({
				binding: 6,
				resource: {
					buffer: this.debugLightsBuffer,
				},
			});
		}
	}
}
