import { Renderer } from "./Renderer";

const $canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = await Renderer.initialize($canvas);

let oldTimeMs = 0;

renderer.mainCamera.y = 3;
renderer.mainCamera.z = 4;

requestAnimationFrame(renderFrame);
resize();

function renderFrame() {
	const nowMs = performance.now() * 0.001;
	const diff = nowMs - oldTimeMs;
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
