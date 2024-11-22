import Renderer from "./app/Renderer";

import * as dat from "dat.gui";

const $canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = await Renderer.initialize($canvas);

const GUI_PARAMS = {
	"Enable Anim": true,
	"Enable TAA": true,
	"Debug G-Buffer": true,
};

renderer.enableAnimation = GUI_PARAMS["Enable Anim"];
renderer.enableTAA = GUI_PARAMS["Enable TAA"];
renderer.debugGBuffer = GUI_PARAMS["Debug G-Buffer"];

const gui = new dat.GUI();

gui.add(GUI_PARAMS, "Enable Anim").onChange((v: boolean) => {
	renderer.enableAnimation = v;
});
gui.add(GUI_PARAMS, "Enable TAA").onChange((v: boolean) => {
	renderer.enableTAA = v;
});
gui.add(GUI_PARAMS, "Debug G-Buffer").onChange((v: boolean) => {
	renderer.debugGBuffer = v;
});

let oldTimeMs = 0;

requestAnimationFrame(renderFrame);
window.addEventListener("resize", resize);
resize();

function renderFrame() {
	const nowMs = performance.now();

	requestAnimationFrame(renderFrame);

	renderer.renderFrame(nowMs);
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
