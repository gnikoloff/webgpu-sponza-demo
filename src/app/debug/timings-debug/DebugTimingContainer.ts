import { AllDebugTimingTypes } from "../../../renderer/constants";
import { DebugTimingType } from "../../../renderer/types";

const DebugTimingTypeToDebugIds: Map<DebugTimingType, string> = new Map([
	[DebugTimingType.CPUTotal, "cpu-total"],
	[DebugTimingType.GPUTotal, "gpu-total"],
	[DebugTimingType.FPS, "fps"],
	[DebugTimingType.DeferredRenderPass, "deferred"],
	[
		DebugTimingType.DirectionalAmbientLightingRenderPass,
		"directional-ambient-light",
	],
	[DebugTimingType.PointLightsStencilMask, "point-lights-stencil-mask"],
	[DebugTimingType.PointLightsLighting, "point-lights-lighting"],
	[DebugTimingType.SSAORenderPass, "ssao"],
	[DebugTimingType.TransparentRenderPass, "transparent"],
	[DebugTimingType.ShadowRenderPass, "shadow"],
	[DebugTimingType.TAAResolveRenderPass, "taa-resolve"],
	[DebugTimingType.ReflectionRenderPass, "reflection"],
	[DebugTimingType.BlitRenderPass, "blit"],
]);

const DebugTimingTypeToNames: Map<DebugTimingType, string> = new Map([
	[DebugTimingType.CPUTotal, "CPU"],
	[DebugTimingType.GPUTotal, "GPU"],
	[DebugTimingType.FPS, "FPS"],
	[DebugTimingType.DeferredRenderPass, "G-Buffer Render Pass"],
	[
		DebugTimingType.DirectionalAmbientLightingRenderPass,
		"Directional + Ambient Render Pass",
	],
	[DebugTimingType.PointLightsStencilMask, "Point Lights Stencil Mask Pass"],
	[DebugTimingType.PointLightsLighting, "Point Lights Render Pass"],
	[DebugTimingType.SSAORenderPass, "SSAO Render Pass"],
	[DebugTimingType.TransparentRenderPass, "Transparent Render Pass"],
	[DebugTimingType.ShadowRenderPass, "Directional Shadow Render Pass"],
	[DebugTimingType.TAAResolveRenderPass, "TAA Resolve Render Pass"],
	[DebugTimingType.ReflectionRenderPass, "Reflection Render Pass"],
	[DebugTimingType.BlitRenderPass, "Blit Render Pass"],
]);

interface TimingDisplay {
	root: HTMLDivElement;
	label: HTMLDivElement;
	value: HTMLDivElement;
}

export default class DebugTimingContainer {
	private static readonly NOT_AVAILABLE_STR = "N/A";

	private $root: HTMLDivElement;

	private $renderPassTimingDisplayEls: Map<DebugTimingType, TimingDisplay> =
		new Map();

	constructor() {
		this.$root = document.createElement("div");
		this.$root.id = "timings-debug-container";
		document.body.appendChild(this.$root);

		for (const debugTimeType of AllDebugTimingTypes) {
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

	public setDisplayValue(renderPass: DebugTimingType, value: number): this {
		const displayEl = this.$renderPassTimingDisplayEls.get(renderPass);
		displayEl.value.innerText =
			value !== 0
				? `${value.toFixed(1)}ms`
				: DebugTimingContainer.NOT_AVAILABLE_STR;
		return this;
	}
}
