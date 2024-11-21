import Renderer from "./app/Renderer";

const $canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = await Renderer.initialize($canvas);

let oldTimeMs = 0;

requestAnimationFrame(renderFrame);
window.addEventListener("resize", resize);
resize();

function renderFrame() {
	const nowMs = performance.now() * 0.001;
	const diff = nowMs - oldTimeMs;
	oldTimeMs = nowMs;
	requestAnimationFrame(renderFrame);

	renderer.renderFrame(nowMs, diff);
}

function resize() {
	const w = innerWidth;
	const h = innerHeight;
	$canvas.width = w;
	$canvas.height = h;
	$canvas.style.setProperty("width", `${w}px`);
	$canvas.style.setProperty("height", `${h}px`);

	renderer.resize(w, h);
}
