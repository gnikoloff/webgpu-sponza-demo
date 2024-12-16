import { AllDebugStatTypes } from "../../../renderer/constants";
import { DebugStatType } from "../../../renderer/types";

const DebugTimingTypeToDebugIds: Map<DebugStatType, string> = new Map([
	[DebugStatType.CPUTotal, "cpu-total"],
	[DebugStatType.GPUTotal, "gpu-total"],
	[DebugStatType.FPS, "fps"],
	[DebugStatType.VRAM, "vram"],
	[DebugStatType.VisibleMeshes, "culled-meshes"],
	[DebugStatType.DeferredRenderPass, "deferred"],
	[
		DebugStatType.DirectionalAmbientLightingRenderPass,
		"directional-ambient-light",
	],
	[DebugStatType.PointLightsStencilMask, "point-lights-stencil-mask"],
	[DebugStatType.PointLightsLighting, "point-lights-lighting"],
	[DebugStatType.SSAORenderPass, "ssao"],
	[DebugStatType.TransparentRenderPass, "transparent"],
	[DebugStatType.ShadowRenderPass, "shadow"],
	[DebugStatType.TAAResolveRenderPass, "taa-resolve"],
	[DebugStatType.ReflectionRenderPass, "reflection"],
	[DebugStatType.BlitRenderPass, "blit"],
]);

const DebugTimingTypeToNames: Map<DebugStatType, string> = new Map([
	[DebugStatType.CPUTotal, "CPU"],
	[DebugStatType.GPUTotal, "GPU"],
	[DebugStatType.FPS, "FPS"],
	[DebugStatType.VRAM, "VRAM Usage"],
	[DebugStatType.VisibleMeshes, "Visible Meshes"],
	[DebugStatType.DeferredRenderPass, "G-Buffer Render Pass"],
	[
		DebugStatType.DirectionalAmbientLightingRenderPass,
		"Directional + Ambient Render Pass",
	],
	[DebugStatType.PointLightsStencilMask, "Point Lights Stencil Mask Pass"],
	[DebugStatType.PointLightsLighting, "Point Lights Render Pass"],
	[DebugStatType.SSAORenderPass, "SSAO Render Pass"],
	[DebugStatType.TransparentRenderPass, "Transparent Render Pass"],
	[DebugStatType.ShadowRenderPass, "Directional Shadow Render Pass"],
	[DebugStatType.TAAResolveRenderPass, "TAA Resolve Render Pass"],
	[DebugStatType.ReflectionRenderPass, "Reflection Render Pass"],
	[DebugStatType.BlitRenderPass, "Blit Render Pass"],
]);

interface TimingDisplay {
	root: HTMLDivElement;
	label: HTMLDivElement;
	value: HTMLDivElement;
}

export default class DebugStatsContainer {
	private static readonly NOT_AVAILABLE_STR = "N/A";

	private $root: HTMLDivElement;

	private $renderPassTimingDisplayEls: Map<DebugStatType, TimingDisplay> =
		new Map();

	constructor() {
		this.$root = document.createElement("div");
		this.$root.id = "timings-debug-container";
		this.$root.classList.add("fadable");
		document.body.appendChild(this.$root);

		for (const debugTimeType of AllDebugStatTypes) {
			const id = DebugTimingTypeToDebugIds.get(debugTimeType);
			const $el = document.createElement("div");

			$el.id = `${id}-debug-timing`;
			$el.classList.add("timing-container");
			this.$root.appendChild($el);

			const $label = document.createElement("div");
			$label.classList.add("timing-label");

			$label.innerText = `${DebugTimingTypeToNames.get(debugTimeType)}:`;
			$el.appendChild($label);

			const $val = document.createElement("div");
			$val.classList.add("timing-value");
			$el.appendChild($val);

			const display: TimingDisplay = {
				root: $el,
				label: $label,
				value: $val,
			};

			this.$renderPassTimingDisplayEls.set(debugTimeType, display);
		}
	}

	public setDisplayValue(renderPass: DebugStatType, value: string): this {
		const displayEl = this.$renderPassTimingDisplayEls.get(renderPass);
		displayEl.value.innerText = value;

		return this;
	}
}
