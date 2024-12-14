import Renderer from "./app/Renderer";

import * as dat from "dat.gui";
import { IGUIParams, SSRMethod } from "./types";

const $canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = await Renderer.initialize($canvas);

const GUI_PARAMS: IGUIParams = {
	"Play Animation": true,
	"Enable TAA": true,
	"Debug G-Buffer": true,
	"Debug Shadow Map": false,
	"Debug Shadow Cascades": false,
	"Debug Point Lights Mask": false,
	"Enable SSR": true,
	"SSR Method": "hi-z",
	"SSR Max Iterations": 30,
	"Sun Intensity": 2,
	"Sun Position X": 0.1,
	"Sun Position Y": 100,
	"Sun Position Z": 0.1,
	"Debug Skybox": true,
	"Debug Bounding Boxes": false,
	"Enable SSAO": true,
	"SSAO Kernel Size": 16,
	"SSAO Radius": 0.2,
	"SSAO Strength": 3,
};

const gui = new dat.GUI({ width: 270 });

gui.add(GUI_PARAMS, "Play Animation").onChange((v: boolean) => {
	renderer.enableAnimation = v;
});

// const envFolder = gui.addFolder("Environment");
// envFolder.add(GUI_PARAMS, "Debug Skybox").onChange((v: boolean) => {
// 	renderer.debugSkybox = v;
// });

const lightingFolder = gui.addFolder("Sun");
lightingFolder.open();
lightingFolder.add(GUI_PARAMS, "Sun Intensity", 0, 5).onChange((v: number) => {
	renderer.sunIntensity = v;
});
lightingFolder
	.add(GUI_PARAMS, "Sun Position X", -100, 100)
	.onChange((v: number) => {
		renderer.sunPositionZ = v;
	});
lightingFolder
	.add(GUI_PARAMS, "Sun Position Z", -150, 150)
	.onChange((v: number) => {
		renderer.sunPositionX = v;
	});

const ssaoFolder = gui.addFolder("Screen space Ambient Occlusion");
ssaoFolder.open();
ssaoFolder.add(GUI_PARAMS, "Enable SSAO").onChange((v: boolean) => {
	renderer.ssaoEnabled = v;
});
ssaoFolder
	.add(GUI_PARAMS, "SSAO Kernel Size", 8, 128, 1)
	.onChange((v: number) => {
		renderer.ssaoKernelSize = v;
	});
ssaoFolder.add(GUI_PARAMS, "SSAO Radius", 0, 1).onChange((v: number) => {
	renderer.ssaoRadius = v;
});
ssaoFolder.add(GUI_PARAMS, "SSAO Strength", 0, 5).onChange((v: number) => {
	renderer.ssaoStrength = v;
});

const shadowFolder = gui.addFolder("Shadow");
shadowFolder.open();
const debugShadowController = shadowFolder
	.add(GUI_PARAMS, "Debug Shadow Map")
	.onChange((v: boolean) => {
		renderer.debugShadowMap = v;
		if (v && GUI_PARAMS["Debug G-Buffer"]) {
			GUI_PARAMS["Debug G-Buffer"] = false;
		}
	});
debugShadowController.listen();

shadowFolder.add(GUI_PARAMS, "Debug Shadow Cascades").onChange((v: boolean) => {
	renderer.debugShadowCascadeIndex = v;
});

const deferredRendererFolder = gui.addFolder("Deferred Renderer");
deferredRendererFolder.open();

const debugGBufferController = deferredRendererFolder
	.add(GUI_PARAMS, "Debug G-Buffer")
	.onChange((v: boolean) => {
		renderer.debugGBuffer = v;
		if (v && GUI_PARAMS["Debug Shadow Map"]) {
			GUI_PARAMS["Debug Shadow Map"] = false;
		}
	});
debugGBufferController.listen();

deferredRendererFolder
	.add(GUI_PARAMS, "Debug Point Lights Mask")
	.onChange((v: boolean) => {
		renderer.debugLightsMask = v;
	});

const ssrFolder = gui.addFolder("Screen space Reflections");
ssrFolder.open();

const ssrEnabledController = ssrFolder
	.add(GUI_PARAMS, "Enable SSR")
	.onChange((v: boolean) => {
		renderer.ssrEnabled = v;
	});
const ssrMethodController = ssrFolder
	.add(GUI_PARAMS, "SSR Method", ["hi-z", "linear"])
	.onChange((v: SSRMethod) => {
		renderer.ssrIsHiZ = v === "hi-z";
	});
const ssrMaxIterationsController = ssrFolder
	.add(GUI_PARAMS, "SSR Max Iterations", 0, 1500, 1)
	.onChange((v: number) => {
		renderer.ssrMaxIterations = v;
	});

const antialiasFolder = gui.addFolder("Anti-Aliasing");
antialiasFolder.open();
antialiasFolder.add(GUI_PARAMS, "Enable TAA").onChange((v: boolean) => {
	renderer.enableTAA = v;
});

const miscFolder = gui.addFolder("Misc");
miscFolder.open();
const debugBBoxesController = miscFolder
	.add(GUI_PARAMS, "Debug Bounding Boxes")
	.onChange((v) => {
		renderer.debugBoundingBoxes = v;
	});

requestAnimationFrame(renderFrame);
window.addEventListener("resize", resize);
resize();

function renderFrame() {
	const nowMs = performance.now();

	renderer.renderFrame(nowMs);
	requestAnimationFrame(renderFrame);
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
	renderer.sunPositionX = GUI_PARAMS["Sun Position Z"];
	renderer.sunPositionY = GUI_PARAMS["Sun Position Y"];
	renderer.sunPositionZ = GUI_PARAMS["Sun Position X"];
	renderer.sunIntensity = GUI_PARAMS["Sun Intensity"];
	renderer.ssaoEnabled = GUI_PARAMS["Enable SSAO"];
	// renderer.ssaoKernelSize = GUI_PARAMS["SSAO Kernel Size"];
	// renderer.ssaoStrength = GUI_PARAMS["SSAO Strength"];
	// renderer.ssaoRadius = GUI_PARAMS["SSAO Radius"];
	// renderer.debugPointLights = GUI_PARAMS["Debug Point Lights Mask"];
	// renderer.toggleDebugCamera = GUI_PARAMS["Toggle Debug Camera"];
	// renderer.debugSkybox = GUI_PARAMS["Debug Skybox"];
}
