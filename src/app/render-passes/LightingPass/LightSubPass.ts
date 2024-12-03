export default class LightSubPass {
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

	constructor(protected gbufferCommonBindGroupLayout: GPUBindGroupLayout) {}

	public render(renderPassEncoder: GPURenderPassEncoder) {
		throw new Error("Each light pass needs its own render method");
	}
}
