import Renderer from "./app/Renderer";

import * as dat from "dat.gui";

const $canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = await Renderer.initialize($canvas);

const GUI_PARAMS = {
	"Play Animation": true,
	"Enable TAA": true,
	"Debug G-Buffer": false,
	"Debug Shadow Map": false,
	"Debug Point Lights Mask": false,
	"Debug Shadow Cascade Index": false,
};

const gui = new dat.GUI({ width: 243 });

gui.add(GUI_PARAMS, "Play Animation").onChange((v: boolean) => {
	renderer.enableAnimation = v;
});

const shadowFolder = gui.addFolder("Shadow");
shadowFolder.open();
shadowFolder.add(GUI_PARAMS, "Debug Shadow Map").onChange((v: boolean) => {
	renderer.debugShadowMap = v;
});
shadowFolder
	.add(GUI_PARAMS, "Debug Shadow Cascade Index")
	.onChange((v: boolean) => {
		renderer.debugShadowCascadeIndex = v;
	});

const deferredRendererFolder = gui.addFolder("Deferred Renderer");
deferredRendererFolder.open();

deferredRendererFolder
	.add(GUI_PARAMS, "Debug G-Buffer")
	.onChange((v: boolean) => {
		renderer.debugGBuffer = v;
	});
deferredRendererFolder
	.add(GUI_PARAMS, "Debug Point Lights Mask")
	.onChange((v: boolean) => {
		renderer.debugPointLights = v;
	});

const antialiasFolder = gui.addFolder("Anti-Aliasing");
antialiasFolder.open();
antialiasFolder.add(GUI_PARAMS, "Enable TAA").onChange((v: boolean) => {
	renderer.enableTAA = v;
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

	renderer.enableAnimation = GUI_PARAMS["Play Animation"];
	renderer.enableTAA = GUI_PARAMS["Enable TAA"];
	renderer.debugGBuffer = GUI_PARAMS["Debug G-Buffer"];
	renderer.debugShadowMap = GUI_PARAMS["Debug Shadow Map"];
	renderer.debugPointLights = GUI_PARAMS["Debug Point Lights Mask"];
}
