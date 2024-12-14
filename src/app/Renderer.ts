import PerspectiveCamera from "../renderer/camera/PerspectiveCamera";
import {
	MAIN_CAMERA_FAR,
	MAIN_CAMERA_NEAR,
	RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
	RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE,
	RENDER_PASS_DEPTH_STENCIL_TEXTURE,
	RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE,
	RENDER_PASS_HI_Z_DEPTH_TEXTURE,
	RENDER_PASS_LIGHTING_RESULT_TEXTURE,
	RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
	RENDER_PASS_SSAO_BLUR_TEXTURE,
	RENDER_PASS_SSAO_TEXTURE,
	RENDER_PASS_TAA_RESOLVE_TEXTURE,
	RENDER_PASS_VELOCITY_TEXTURE,
} from "./constants";
import Drawable from "../renderer/scene/Drawable";

import GBufferRenderPass from "./render-passes/GBufferRenderPass";
import CubeGeometry from "../renderer/geometry/CubeGeometry";
import MaterialCache from "./utils/MaterialCache";
import ReflectionComputePass from "./render-passes/ReflectionComputePass";
import SphereGeometry from "../renderer/geometry/SphereGeometry";
import TAAResolveRenderPass from "./render-passes/TAAResolveRenderPass";
import DirectionalShadowRenderPass from "./render-passes/DirectionalShadowRenderPass";
import GLTFModel from "../renderer/scene/GLTFModel";
import TextureLoader from "../renderer/texture/TextureLoader";
import Skybox from "./meshes/Skybox";
import DiffuseIBLGenerator from "../renderer/texture/DiffuseIBLGenerator";
import TextureController from "../renderer/texture/TextureController";
import SpecularIBLGenerator from "../renderer/texture/SpecularIBLGenerator";
import BDRFLutGenerator from "../renderer/texture/BDRFLutGenerator";
import TexturesDebugContainer from "./debug/textures-debug/TexturesDebugContainer";
import Scene from "../renderer/scene/Scene";
import TransparentRenderPass from "./render-passes/TransparentRenderPass";
import CameraFlyController from "../renderer/camera/CameraFlyController";
import SSAORenderPass from "./render-passes/SSAORenderPass";
import RollingAverage from "../renderer/math/RollingAverage";
import DebugTimingContainer from "./debug/timings-debug/DebugTimingContainer";
import { DebugTimingType, RenderPassType } from "../renderer/types";
import RenderPassComposer from "../renderer/core/RenderPassComposer";
import BlitRenderPass from "./render-passes/BlitRenderPass";
import DirectionalAmbientLightRenderPass from "./render-passes/DirectionalAmbientLightRenderPass";
import GeometryCache from "./utils/GeometryCache";
import PointLightsMaskPass from "./render-passes/PointLightsMaskPass";
import PointLightsRenderPass from "./render-passes/PointLightsRenderPass";
import SkyboxRenderPass from "./render-passes/SkyboxRenderPass";
import RenderingContext from "../renderer/core/RenderingContext";
import SSAOBlurRenderPass from "./render-passes/SSAOBlurRenderPass";
import HiZDepthComputePass from "./render-passes/HiZDepthComputePass";
import HiZCopyDepthComputePass from "./render-passes/HiZCopyDepthComputePass";
import DebugBoundsPass from "./render-passes/DebugBoundsPass";
import LightingSystem from "./lighting/LightingSystem";
import { TextureDebugMeshType } from "../types";
import PointLightsNonCulledRenderPass from "./render-passes/PointLightsNonCulledRenderPass";
import LineDebugDrawable from "./debug/LineDebugDrawable";
import { vec3 } from "wgpu-matrix";
import CatmullRomCurve3 from "../renderer/math/CatmullRomCurve3";
// import EnvironmentProbePass from "./render-passes/EnvironmentProbePass";

export default class Renderer extends RenderingContext {
	public static initialize = async (
		canvas: HTMLCanvasElement,
	): Promise<Renderer> => {
		const adapter = await navigator.gpu.requestAdapter();

		RenderingContext.$canvas = canvas;
		RenderingContext.canvasContext = canvas.getContext(
			"webgpu",
		) as GPUCanvasContext;

		RenderingContext.pixelFormat = navigator.gpu.getPreferredCanvasFormat();

		const requiredFeatures: GPUFeatureName[] = [];

		const supportsGPUTimestampQuery = adapter.features.has("timestamp-query");

		if (supportsGPUTimestampQuery) {
			requiredFeatures.push("timestamp-query");
		}

		RenderingContext.device = await adapter.requestDevice({
			requiredFeatures,
		});

		RenderingContext.supportsGPUTimestampQuery = supportsGPUTimestampQuery;

		RenderingContext.canvasContext.configure({
			device: RenderingContext.device,
			format: RenderingContext.pixelFormat,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
			// alphaMode: "premultiplied",
		});

		return new Renderer();
	};

	public mainCamera: PerspectiveCamera;
	public debugCamera: PerspectiveCamera;
	// public mainCameraCtrl: CameraOrbitController;
	public mainCameraCtrl: CameraFlyController;

	public set debugBoundingBoxes(v: boolean) {
		(
			this.renderPassComposer.getPass(
				RenderPassType.DebugBounds,
			) as DebugBoundsPass
		).enabled = v;
	}

	private lightingManager: LightingSystem;
	private scene = new Scene();

	private envDiffuseTexture: GPUTexture;
	private envSpecularTexture: GPUTexture;
	private envBdrfLutTexture: GPUTexture;
	private renderPassComposer!: RenderPassComposer;

	private cpuAverage = new RollingAverage();
	private gpuAverage = new RollingAverage();
	private fpsDisplayAverage = new RollingAverage();

	private texturesDebugContainer: TexturesDebugContainer;
	private timingDebugContainer: DebugTimingContainer;

	public set sunPositionX(v: number) {
		this.lightingManager.sunPositionX = v;
	}

	public set sunPositionY(v: number) {
		this.lightingManager.sunPositionY = v;
	}

	public set sunPositionZ(v: number) {
		this.lightingManager.sunPositionZ = v;
	}

	public set sunIntensity(v: number) {
		this.lightingManager.sunIntensity = v;
	}

	public set enableTAA(v: boolean) {
		this.mainCamera.shouldJitter = v;
	}

	public set debugGBuffer(v: boolean) {
		v
			? this.texturesDebugContainer.reveal()
			: this.texturesDebugContainer.hide();
	}

	public set debugShadowMap(v: boolean) {
		v
			? this.texturesDebugContainer.reveal()
			: this.texturesDebugContainer.hide();
	}

	public set debugShadowCascadeIndex(v: boolean) {
		(
			this.renderPassComposer.getPass(
				RenderPassType.DirectionalAmbientLighting,
			) as DirectionalAmbientLightRenderPass
		).debugShadowCascadeLayer = v;
	}

	public set debugLightsMask(v: boolean) {
		(
			this.renderPassComposer.getPass(
				RenderPassType.PointLightsLighting,
			) as PointLightsRenderPass
		).debugLightsMask = v;
	}

	public enableAnimation = true;

	public set ssrIsHiZ(v: boolean) {
		(
			this.renderPassComposer.getPass(
				RenderPassType.Reflection,
			) as ReflectionComputePass
		).isHiZ = v;
		this.renderPassComposer.getPass(RenderPassType.HiZ).enabled = v;
	}

	public set ssrMaxIterations(v: number) {
		(
			this.renderPassComposer.getPass(
				RenderPassType.Reflection,
			) as ReflectionComputePass
		).maxIterations = v;
	}

	public set ssrEnabled(v: boolean) {
		this.renderPassComposer.getPass(RenderPassType.Reflection).enabled = v;
		this.renderPassComposer
			.getPass(RenderPassType.TAAResolve)
			.clearInputTextures()
			.addInputTextures([
				v
					? RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE
					: RENDER_PASS_LIGHTING_RESULT_TEXTURE,
				RENDER_PASS_VELOCITY_TEXTURE,
			]);
	}

	constructor() {
		super();
		this.mainCamera = new PerspectiveCamera(
			70,
			1,
			MAIN_CAMERA_NEAR,
			MAIN_CAMERA_FAR,
		);
		this.mainCamera.shouldJitter = true;
		this.mainCamera.setPosition(4, 3, 0);
		this.mainCamera.setLookAt(0, 2, 0);
		this.mainCamera.updateViewMatrix();

		this.mainCameraCtrl = new CameraFlyController(
			this.mainCamera,
			document.body,
			RenderingContext.$canvas,
		);
		this.mainCameraCtrl.startTick();

		this.debugCamera = new PerspectiveCamera(
			70,
			1,
			MAIN_CAMERA_NEAR,
			MAIN_CAMERA_FAR,
		);
		this.debugCamera.setPosition(6, 12, 1);
		this.debugCamera.setLookAt(0, 7, 0);
		this.debugCamera.updateViewMatrix();

		const curve = new CatmullRomCurve3(
			[
				vec3.create(5.5, 7.5, 3.25),
				vec3.create(4, 6.5, 0.5),
				vec3.create(2.5, 6.5, 3.25),
				vec3.create(1, 7.5, 0.5),
				vec3.create(-0.5, 7.5, 3.25),
				vec3.create(-2, 6.5, 0.5),
				vec3.create(-3.5, 6.5, 3.25),
				vec3.create(-5, 7.5, 0.5),
				vec3.create(-6.5, 7.5, 3.25),
				vec3.create(-7.75, 6.5, 0.5),
				vec3.create(-10.5, 7.5, -0.125),
				vec3.create(-7.75, 7.5, -1),
				vec3.create(-6.5, 6.5, -4),
				vec3.create(-5, 6.5, -1),
				vec3.create(-3.5, 7.5, -4),
				vec3.create(-2, 7.5, -1),
				vec3.create(-0.5, 6.5, -4),
				vec3.create(1, 6.5, -1),
				vec3.create(2.5, 7.5, -4),
				vec3.create(4, 7.5, -1),
				vec3.create(5.5, 6.5, -4),
				vec3.create(6.5, 6.5, -1),
				vec3.create(9, 6.5, -1),
				vec3.create(9.5, 7.5, -0.125),
				vec3.create(9, 6.5, 0.7),
				vec3.create(6, 6.5, 1),
				vec3.create(6, 7.5, 3.25),
			],
			true,
		);
		const movementCurvePoints = curve.getPoints(240);
		// const debugLine = new LineDebugDrawable(movementCurvePoints);
		// this.scene.addChild(debugLine);

		this.lightingManager = new LightingSystem(movementCurvePoints);
		this.scene.lightingManager = this.lightingManager;

		this.texturesDebugContainer = new TexturesDebugContainer();
		this.timingDebugContainer = new DebugTimingContainer();

		this.scene.skybox = new Skybox();

		TextureLoader.load6SeparateHDRFacesAsCubeMapTexture(
			["/px.hdr", "/nx.hdr", "/py.hdr", "/ny.hdr", "/pz.hdr", "/nz.hdr"],
			512,
			true,
			"Skybox Faces",
		).then((texture) => {
			this.envDiffuseTexture = DiffuseIBLGenerator.encode(texture);
			this.envSpecularTexture = SpecularIBLGenerator.encode(texture, 256);
			this.envBdrfLutTexture = BDRFLutGenerator.encode();

			TextureController.generateMipsForCubeTexture(this.envDiffuseTexture);
			this.scene.skybox.setTexture(this.envDiffuseTexture);

			const dirAmbientLightPass = this.renderPassComposer.getPass(
				RenderPassType.DirectionalAmbientLighting,
			) as DirectionalAmbientLightRenderPass;

			dirAmbientLightPass
				.setDiffuseIBLTexture(this.envDiffuseTexture)
				.setSpecularIBLTexture(this.envSpecularTexture)
				.setBDRFLutTexture(this.envBdrfLutTexture);
		});

		const a = new GLTFModel("/sponza/Sponza.gltf");
		this.scene.addChild(a);
		a.setPositionY(2) //.setRotationY(Math.PI * 0.5)
			.updateWorldMatrix();
		a.load().then(() => {
			// a.setIsReflective(false);
			a.setMaterial(
				MaterialCache.defaultGLTFTexturedDeferredMaterial,
			).setMaterial(
				MaterialCache.defaultGLTFShadowMaterial,
				RenderPassType.Shadow,
			);

			// a.setMaterial(
			// 	MaterialCache.defaultGLTFTransparentPBRMaterial,
			// 	RenderPassType.Transparent,
			// );
		});
	}

	private recreateRenderComposer(width: number, height: number) {
		this.renderPassComposer?.destroy();

		this.renderPassComposer = new RenderPassComposer();
		this.renderPassComposer.setScene(this.scene);

		const shadowRenderPass = new DirectionalShadowRenderPass(
			this.lightingManager.mainDirLight,
			width,
			height,
		)
			.addOutputTexture(RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE)
			.setCamera(this.mainCamera);

		const gbufferRenderPass = new GBufferRenderPass(width, height)
			.setCamera(this.mainCamera)
			.addOutputTextures([
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
				RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
				RENDER_PASS_VELOCITY_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			]);

		const ssaoRenderPass = new SSAORenderPass(width, height)
			.setCamera(this.mainCamera)
			.addInputTextures([
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			])
			.addOutputTexture(RENDER_PASS_SSAO_TEXTURE);

		const ssaoBlurRenderPass = new SSAOBlurRenderPass(width, height)
			.addInputTexture(RENDER_PASS_SSAO_TEXTURE)
			.addOutputTexture(RENDER_PASS_SSAO_BLUR_TEXTURE);

		const directionalAmbientLightRenderPass =
			new DirectionalAmbientLightRenderPass(
				shadowRenderPass.shadowCascadesBuffer,
				width,
				height,
			)
				.setCamera(this.mainCamera)
				.addInputTextures([
					RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
					RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
					RENDER_PASS_DEPTH_STENCIL_TEXTURE,
					RENDER_PASS_SSAO_BLUR_TEXTURE,
					RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE,
				])
				.addOutputTexture(RENDER_PASS_LIGHTING_RESULT_TEXTURE);

		if (this.envDiffuseTexture) {
			directionalAmbientLightRenderPass.setDiffuseIBLTexture(
				this.envDiffuseTexture,
			);
		}

		if (this.envSpecularTexture) {
			directionalAmbientLightRenderPass.setSpecularIBLTexture(
				this.envSpecularTexture,
			);
		}
		if (this.envBdrfLutTexture) {
			directionalAmbientLightRenderPass.setBDRFLutTexture(
				this.envBdrfLutTexture,
			);
		}

		const pointLightsNonInstancedNonCulledRenderPass =
			new PointLightsNonCulledRenderPass(width, height)
				.setCamera(this.mainCamera)
				.addInputTextures([
					RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
					RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
					RENDER_PASS_DEPTH_STENCIL_TEXTURE,
					RENDER_PASS_SSAO_BLUR_TEXTURE,
					RENDER_PASS_LIGHTING_RESULT_TEXTURE,
				])
				.addOutputTexture(RENDER_PASS_LIGHTING_RESULT_TEXTURE);

		const pointLightsStencilMaskPass = new PointLightsMaskPass(width, height)
			.setCamera(this.mainCamera)
			.addInputTextures([RENDER_PASS_DEPTH_STENCIL_TEXTURE])
			.addOutputTexture(RENDER_PASS_DEPTH_STENCIL_TEXTURE)
			.setLightsBuffer(this.lightingManager.gpuBuffer)
			.updateLightsMaskBindGroup();

		const pointLightsRenderPass = new PointLightsRenderPass(width, height)
			.setCamera(this.mainCamera)
			.addInputTextures([
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
				RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
				RENDER_PASS_SSAO_BLUR_TEXTURE,
				RENDER_PASS_LIGHTING_RESULT_TEXTURE,
			])
			.addOutputTexture(RENDER_PASS_LIGHTING_RESULT_TEXTURE);

		const transparentRenderPass = new TransparentRenderPass(width, height)
			.setCamera(this.mainCamera)
			.addInputTextures([
				RENDER_PASS_LIGHTING_RESULT_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			])
			.addOutputTextures([
				RENDER_PASS_LIGHTING_RESULT_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			]);

		const skyboxRenderPass = new SkyboxRenderPass(width, height)
			.setCamera(this.mainCamera)
			.addInputTextures([
				RENDER_PASS_LIGHTING_RESULT_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			])
			.addOutputTextures([
				RENDER_PASS_LIGHTING_RESULT_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			]);

		const hiZCopyDepthComputePass = new HiZCopyDepthComputePass(width, height)
			.addInputTexture(RENDER_PASS_DEPTH_STENCIL_TEXTURE)
			.addOutputTexture(RENDER_PASS_HI_Z_DEPTH_TEXTURE);

		const hiZDepthComputePass = new HiZDepthComputePass(width, height)
			.addInputTexture(RENDER_PASS_HI_Z_DEPTH_TEXTURE)
			.addOutputTexture(RENDER_PASS_HI_Z_DEPTH_TEXTURE);

		const reflectionsComputePass = new ReflectionComputePass(width, height)
			.setCamera(this.mainCamera)
			.addInputTextures([
				RENDER_PASS_LIGHTING_RESULT_TEXTURE,
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
				RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
				RENDER_PASS_HI_Z_DEPTH_TEXTURE,
			])
			.addOutputTexture(RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE);

		const taaResolveRenderPass = new TAAResolveRenderPass(width, height)
			.addInputTextures([
				RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE,
				RENDER_PASS_VELOCITY_TEXTURE,
			])
			.addOutputTexture(RENDER_PASS_TAA_RESOLVE_TEXTURE);

		const debugBBoxesPass = new DebugBoundsPass(width, height)
			.addInputTextures([
				RENDER_PASS_TAA_RESOLVE_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			])
			.addOutputTexture(RENDER_PASS_TAA_RESOLVE_TEXTURE)
			.setScene(this.scene)
			.setCamera(this.mainCamera);

		debugBBoxesPass.enabled = false;

		const blitRenderPass = new BlitRenderPass(width, height).addInputTexture(
			RENDER_PASS_TAA_RESOLVE_TEXTURE,
		);

		this.renderPassComposer
			.addPass(shadowRenderPass)
			.addPass(gbufferRenderPass)
			.addPass(ssaoRenderPass)
			.addPass(ssaoBlurRenderPass)
			.addPass(directionalAmbientLightRenderPass)
			.addPass(pointLightsNonInstancedNonCulledRenderPass)
			.addPass(pointLightsStencilMaskPass)
			.addPass(pointLightsRenderPass)
			.addPass(transparentRenderPass)
			.addPass(skyboxRenderPass)
			.addPass(hiZCopyDepthComputePass)
			.addPass(hiZDepthComputePass)
			.addPass(reflectionsComputePass)
			.addPass(taaResolveRenderPass)
			.addPass(debugBBoxesPass)
			.addPass(blitRenderPass);
	}

	public resize(w: number, h: number) {
		this.debugCamera.onResize(w, h);
		this.mainCamera.onResize(w, h);

		this.recreateRenderComposer(w, h);
	}

	public async renderFrame(elapsedTime: number) {
		const now = (elapsedTime - RenderingContext.elapsedTimeMs) * 0.001;
		const deltaDiff = now - RenderingContext.prevTimeMs;
		RenderingContext.prevTimeMs = now;
		RenderingContext.elapsedTimeMs += this.enableAnimation ? deltaDiff : 0;
		RenderingContext.deltaTimeMs = Math.min(deltaDiff, 0.5);

		const jsPerfStartTime = performance.now();

		// a.textContent = `Display Meshes: ${this.scene.visibleNodesCount} / ${this.scene.nodesCount}`;

		this.debugCamera.onFrameStart();
		this.mainCamera.onFrameStart();

		if (this.mainCamera.hasChangedSinceLastFrame) {
			// this.scene.sortTransparentNodesFrom(this.mainCamera);
		}

		const commandEncoder = RenderingContext.device.createCommandEncoder({
			label: "Render Pass Composer Command Encoder",
		});

		this.lightingManager.update(commandEncoder);
		this.renderPassComposer.render(commandEncoder);

		// this.texturesDebugContainer.setTextureGBufferSection(
		// 	TextureDebugMeshType.Albedo,
		// 	this.renderPassComposer.getTexture(
		// 		RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
		// 	),
		// );
		// this.texturesDebugContainer.setTextureGBufferSection(
		// 	TextureDebugMeshType.Normal,
		// 	this.renderPassComposer.getTexture(
		// 		RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
		// 	),
		// );
		// this.texturesDebugContainer.setTextureGBufferSection(
		// 	TextureDebugMeshType.Metallic,
		// 	this.renderPassComposer.getTexture(
		// 		RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
		// 	),
		// );
		// this.texturesDebugContainer.setTextureGBufferSection(
		// 	TextureDebugMeshType.Roughness,
		// 	this.renderPassComposer.getTexture(
		// 		RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
		// 	),
		// );
		// this.texturesDebugContainer.setTextureGBufferSection(
		// 	TextureDebugMeshType.AO,
		// 	this.renderPassComposer.getTexture(RENDER_PASS_SSAO_BLUR_TEXTURE),
		// );
		// this.texturesDebugContainer.setTextureGBufferSection(
		// 	TextureDebugMeshType.Reflectance,
		// 	this.renderPassComposer.getTexture(
		// 		RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
		// 	),
		// );
		// this.texturesDebugContainer.setTextureGBufferSection(
		// 	TextureDebugMeshType.Depth,
		// 	this.renderPassComposer.getTexture(RENDER_PASS_DEPTH_STENCIL_TEXTURE),
		// );
		// this.texturesDebugContainer.setTextureGBufferSection(
		// 	TextureDebugMeshType.Velocity,
		// 	this.renderPassComposer.getTexture(RENDER_PASS_VELOCITY_TEXTURE),
		// );
		// this.texturesDebugContainer.shadowDebugSection.setTextureFor(
		// 	TextureDebugMeshType.ShadowDepthCascade0,
		// 	this.renderPassComposer.getTexture(
		// 		RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE,
		// 	),
		// );
		// this.texturesDebugContainer.shadowDebugSection.setTextureFor(
		// 	TextureDebugMeshType.ShadowDepthCascade1,
		// 	this.renderPassComposer.getTexture(
		// 		RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE,
		// 	),
		// );
		// this.texturesDebugContainer.render(commandEncoder);

		RenderingContext.device.queue.submit([commandEncoder.finish()]);

		this.mainCamera.onFrameEnd();
		this.debugCamera.onFrameEnd();

		const jsPerfTime = performance.now() - jsPerfStartTime;

		const [shadowRenderPassTimingResult, blitRenderPassTimingResult] =
			await Promise.all([
				this.renderPassComposer
					.getPass(RenderPassType.Shadow)
					.getTimingResult(),
				this.renderPassComposer.getPass(RenderPassType.Blit).getTimingResult(),
			]);

		const gbufferRenderPassTimings = shadowRenderPassTimingResult.timings;
		const blitRenderPassTimings = blitRenderPassTimingResult.timings;
		const totalGPUTime =
			Math.abs(blitRenderPassTimings[1] - gbufferRenderPassTimings[0]) /
			1_000_000;

		this.cpuAverage.addSample(jsPerfTime);
		this.fpsDisplayAverage.addSample(1 / deltaDiff);
		this.gpuAverage.addSample(totalGPUTime);

		this.timingDebugContainer
			.setDisplayValue(DebugTimingType.CPUTotal, this.cpuAverage.get())
			.setDisplayValue(DebugTimingType.GPUTotal, this.gpuAverage.get())
			.setDisplayValue(DebugTimingType.FPS, this.fpsDisplayAverage.get());

		RenderingContext.frameIndex++;
	}
}
