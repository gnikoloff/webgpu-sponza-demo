import { RenderPassType } from "../types";

export default class RenderingContext {
	public static $canvas: HTMLCanvasElement;
	public static canvasContext: GPUCanvasContext;
	public static device: GPUDevice;
	public static supportsGPUTimestampQuery: boolean;
	public static elapsedTimeMs = 0;
	public static pixelFormat: GPUTextureFormat;
	public static readonly depthStencilFormat: GPUTextureFormat =
		"depth32float-stencil8";

	protected static prevTimeMs = 0;

	protected static activeRenderPassType?: RenderPassType;
	protected static activeRenderPassEncoder?: GPURenderPassEncoder;
	protected static currentlyBoundRenderPSO?: GPURenderPipeline;

	public static getActiveRenderPassType(): RenderPassType | null {
		return this.activeRenderPassType;
	}

	public static setActiveRenderPass(
		type: RenderPassType,
		renderPassEncoder: GPURenderPassEncoder,
	) {
		this.activeRenderPassType = type;
		this.activeRenderPassEncoder = renderPassEncoder;

		this.currentlyBoundRenderPSO = null;
	}

	public static bindRenderPSO(v: GPURenderPipeline) {
		if (v === this.currentlyBoundRenderPSO) {
			return;
		}
		this.currentlyBoundRenderPSO = v;
		this.activeRenderPassEncoder?.setPipeline(v);
	}
}
