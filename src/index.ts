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
	"Debug Shadow Cascade Index": false,
	"Debug Point Lights Mask": false,
	"SSR Enabled": true,
	"SSR Method": "hi-z",
	"SSR Max Iterations": 150,
	"Auto-Rotate Sun": false,
	"Debug Skybox": true,
	"Debug Bounding Boxes": false,
};

const gui = new dat.GUI({ width: 243 });

gui.add(GUI_PARAMS, "Play Animation").onChange((v: boolean) => {
	renderer.enableAnimation = v;
});

// const envFolder = gui.addFolder("Environment");
// envFolder.add(GUI_PARAMS, "Debug Skybox").onChange((v: boolean) => {
// 	renderer.debugSkybox = v;
// });

const lightingFolder = gui.addFolder("Lighting");
lightingFolder.open();
lightingFolder.add(GUI_PARAMS, "Auto-Rotate Sun").onChange((v: boolean) => {
	renderer.autoRotateSun = v;
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

shadowFolder
	.add(GUI_PARAMS, "Debug Shadow Cascade Index")
	.onChange((v: boolean) => {
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

const ssrFolder = gui.addFolder("Screenspace Reflections");
ssrFolder.open();

const ssrEnabledController = ssrFolder
	.add(GUI_PARAMS, "SSR Enabled")
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
	renderer.debugPointLights = GUI_PARAMS["Debug Point Lights Mask"];
	renderer.autoRotateSun = GUI_PARAMS["Auto-Rotate Sun"];
	renderer.toggleDebugCamera = GUI_PARAMS["Toggle Debug Camera"];
	// renderer.debugSkybox = GUI_PARAMS["Debug Skybox"];
}
