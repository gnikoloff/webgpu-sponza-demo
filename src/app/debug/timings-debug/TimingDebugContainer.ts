export default class TimingDebugContainer {
	public $root: HTMLDivElement;

	constructor() {
		this.$root = document.createElement("div");
		this.$root.id = "timings-debug-container";
		document.body.appendChild(this.$root);
	}
}
