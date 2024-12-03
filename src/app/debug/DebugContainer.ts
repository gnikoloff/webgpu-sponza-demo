import GBufferDebugSection from "./GBufferDebugSection";
import ShadowDebugSection from "./ShadowDebugSection";
import styles from "./debug.css?inline";

export default class DebugContainer {
	private static readonly ROOT_EL_ID = "webgpu-debug-root";

	private $root: HTMLDivElement;
	private open = false;

	public gbufferDebugSection: GBufferDebugSection;
	public shadowDebugSection: ShadowDebugSection;

	constructor() {
		this.$root = document.createElement("div");
		this.$root.id = DebugContainer.ROOT_EL_ID;
		document.body.appendChild(this.$root);

		this.gbufferDebugSection = new GBufferDebugSection();
		this.gbufferDebugSection.appendTo(this.$root);

		this.shadowDebugSection = new ShadowDebugSection();
		this.shadowDebugSection.appendTo(this.$root);

		const sheet = document.createElement("style");
		sheet.innerHTML = styles;
		document.head.appendChild(sheet);
	}

	public reveal() {
		this.open = true;
		this.$root.classList.add("open");
	}

	public hide() {
		this.open = false;
		this.$root.classList.remove("open");
	}

	public render(commandEncoder: GPUCommandEncoder) {
		if (!this.open) {
			return;
		}
		this.gbufferDebugSection.render(commandEncoder);
		this.shadowDebugSection.render(commandEncoder);
	}
}
