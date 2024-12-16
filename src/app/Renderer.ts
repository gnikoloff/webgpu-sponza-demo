import PerspectiveCamera from "../renderer/camera/PerspectiveCamera";
import {
	ENVIRONMENT_CUBE_TEXTURE_FACE_URLS,
	MAIN_CAMERA_FAR,
	MAIN_CAMERA_NEAR,
	RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
	RENDER_PASS_BLOOM_TEXTURE,
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
	SECOND_FLOOR_PARTICLES_CATMULL_CURVE_POINT_POSITIONS,
} from "./constants";

import CameraFlyController from "../renderer/camera/CameraFlyController";
import RenderPassComposer from "../renderer/core/RenderPassComposer";
import RenderingContext from "../renderer/core/RenderingContext";
import CatmullRomCurve3 from "../renderer/math/CatmullRomCurve3";
import RollingAverage from "../renderer/math/RollingAverage";
import VRAMUsageTracker from "../renderer/misc/VRAMUsageTracker";
import GLTFModel from "../renderer/scene/GLTFModel";
import Scene from "../renderer/scene/Scene";
import BDRFLutGenerator from "../renderer/texture/BDRFLutGenerator";
import DiffuseIBLGenerator from "../renderer/texture/DiffuseIBLGenerator";
import SpecularIBLGenerator from "../renderer/texture/SpecularIBLGenerator";
import TextureController from "../renderer/texture/TextureController";
import TextureLoader from "../renderer/texture/TextureLoader";
import { DebugStatType, RenderPassType } from "../renderer/types";
import { TextureDebugMeshType } from "../types";
import LineDebugDrawable from "./debug/LineDebugDrawable";
import TexturesDebugContainer from "./debug/textures-debug/TexturesDebugContainer";
import DebugStatsContainer from "./debug/timings-debug/DebugStatsContainer";
import LightingSystem from "./lighting/LightingSystem";
import Skybox from "./meshes/Skybox";
import BlitRenderPass from "./render-passes/BlitRenderPass";
import { BloomDownscaleRenderPass } from "./render-passes/BloomDownscaleRenderPass";
import BloomUpscaleRenderPass from "./render-passes/BloomUpscaleRenderPass";
import DebugBoundsPass from "./render-passes/DebugBoundsPass";
import DirectionalAmbientLightRenderPass from "./render-passes/DirectionalAmbientLightRenderPass";
import DirectionalShadowRenderPass from "./render-passes/DirectionalShadowRenderPass";
import GBufferRenderPass from "./render-passes/GBufferRenderPass";
import HiZCopyDepthComputePass from "./render-passes/HiZCopyDepthComputePass";
import HiZDepthComputePass from "./render-passes/HiZDepthComputePass";
import PointLightsMaskPass from "./render-passes/PointLightsMaskPass";
import PointLightsNonCulledRenderPass from "./render-passes/PointLightsNonCulledRenderPass";
import PointLightsRenderPass from "./render-passes/PointLightsRenderPass";
import ReflectionComputePass from "./render-passes/ReflectionComputePass";
import SSAOBlurRenderPass from "./render-passes/SSAOBlurRenderPass";
import SSAORenderPass from "./render-passes/SSAORenderPass";
import SkyboxRenderPass from "./render-passes/SkyboxRenderPass";
import TAAResolveRenderPass from "./render-passes/TAAResolveRenderPass";
import TransparentRenderPass from "./render-passes/TransparentRenderPass";
import MaterialCache from "./utils/MaterialCache";

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
		});

		return new Renderer();
	};

	public mainCamera: PerspectiveCamera;
	public debugCamera: PerspectiveCamera;
	public mainCameraCtrl: CameraFlyController;

	private curveMoveLine: LineDebugDrawable;
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
	private timingDebugContainer: DebugStatsContainer;

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

	public set ssaoEnabled(v: boolean) {
		(
			this.renderPassComposer.getPass(
				RenderPassType.DirectionalAmbientLighting,
			) as DirectionalAmbientLightRenderPass
		).ssaoMixFactor = v ? 1 : 0;
	}

	public set ssaoKernelSize(v: number) {
		(
			this.renderPassComposer.getPass(RenderPassType.SSAO) as SSAORenderPass
		).kernelSize = v;
	}

	public set ssaoRadius(v: number) {
		(
			this.renderPassComposer.getPass(RenderPassType.SSAO) as SSAORenderPass
		).radius = v;
	}

	public set ssaoStrength(v: number) {
		(
			this.renderPassComposer.getPass(RenderPassType.SSAO) as SSAORenderPass
		).strength = v;
	}

	public set enableTAA(v: boolean) {
		this.mainCamera.shouldJitter = v;
	}

	public set debugGBuffer(v: boolean) {
		v
			? this.texturesDebugContainer.reveal()
			: this.texturesDebugContainer.hide();
		if (v) {
			this.texturesDebugContainer.scrollIntoGbufferSection();
		}
	}

	public set debugShadowMap(v: boolean) {
		v
			? this.texturesDebugContainer.reveal()
			: this.texturesDebugContainer.hide();
		if (v) {
			this.texturesDebugContainer.scrollToShadowSection();
		}
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

	public set render2ndFloorPoints(v: boolean) {
		this.lightingManager.render2ndFloorParticles = v;
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

	public set bloomEnabled(v: boolean) {
		this.renderPassComposer.getPass(RenderPassType.BloomDownsample).enabled = v;
		this.renderPassComposer.getPass(RenderPassType.BloomUpsample).enabled = v;
		(
			this.renderPassComposer.getPass(RenderPassType.Blit) as BlitRenderPass
		).bloomEnabled = v;
	}

	public set bloomFilterRadius(v: number) {
		(
			this.renderPassComposer.getPass(
				RenderPassType.BloomUpsample,
			) as BloomUpscaleRenderPass
		).bloomFilterRadius = v;
	}

	public set debugBoundingBoxes(v: boolean) {
		(
			this.renderPassComposer.getPass(
				RenderPassType.DebugBounds,
			) as DebugBoundsPass
		).enabled = v;
	}

	public set debugMovementCurve(v: boolean) {
		this.curveMoveLine.visible = v;
	}

	public toggleStatsVisibility() {
		this.timingDebugContainer.toggleVisibility();
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
			SECOND_FLOOR_PARTICLES_CATMULL_CURVE_POINT_POSITIONS,
			true,
		);
		const movementCurvePoints = curve.getPoints(240);
		// this.curveMoveLine = new LineDebugDrawable(movementCurvePoints);
		// this.curveMoveLine.visible = false;
		// this.scene.addChild(this.curveMoveLine);

		this.lightingManager = new LightingSystem(movementCurvePoints);
		this.scene.lightingManager = this.lightingManager;

		this.texturesDebugContainer = new TexturesDebugContainer();
		this.timingDebugContainer = new DebugStatsContainer();

		this.scene.skybox = new Skybox();

		const sponzaModel = new GLTFModel("/sponza/Sponza.gltf");
		this.scene.addChild(sponzaModel);
		sponzaModel.setPositionY(2).updateWorldMatrix();

		Promise.all([
			TextureLoader.load6SeparateHDRFacesAsCubeMapTexture(
				ENVIRONMENT_CUBE_TEXTURE_FACE_URLS,
				512,
				true,
				"Skybox Faces",
			),
			sponzaModel.load(),
		]).then(([environmentTexture]) => {
			this.envDiffuseTexture = DiffuseIBLGenerator.encode(environmentTexture);
			this.envSpecularTexture = SpecularIBLGenerator.encode(
				environmentTexture,
				256,
			);
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

			VRAMUsageTracker.removeTextureBytes(environmentTexture);
			environmentTexture.destroy();

			sponzaModel
				.setMaterial(MaterialCache.defaultGLTFTexturedDeferredMaterial)
				.setMaterial(
					MaterialCache.defaultGLTFShadowMaterial,
					RenderPassType.Shadow,
				);
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

		const bloomDownscaleRenderPass = new BloomDownscaleRenderPass(width, height)
			.addInputTexture(RENDER_PASS_TAA_RESOLVE_TEXTURE)
			.addOutputTexture(RENDER_PASS_BLOOM_TEXTURE);

		const bloomUpscaleRenderPass = new BloomUpscaleRenderPass(width, height)
			.addInputTexture(RENDER_PASS_BLOOM_TEXTURE)
			.addOutputTexture(RENDER_PASS_BLOOM_TEXTURE);

		// const debugBBoxesPass = new DebugBoundsPass(width, height)
		// 	.addInputTextures([
		// 		RENDER_PASS_TAA_RESOLVE_TEXTURE,
		// 		RENDER_PASS_DEPTH_STENCIL_TEXTURE,
		// 	])
		// 	.addOutputTexture(RENDER_PASS_TAA_RESOLVE_TEXTURE)
		// 	.setScene(this.scene)
		// 	.setCamera(this.mainCamera);

		// debugBBoxesPass.enabled = false;

		const blitRenderPass = new BlitRenderPass(width, height).addInputTextures([
			RENDER_PASS_BLOOM_TEXTURE,
			RENDER_PASS_TAA_RESOLVE_TEXTURE,
		]);

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
			.addPass(bloomDownscaleRenderPass)
			.addPass(bloomUpscaleRenderPass)
			// .addPass(debugBBoxesPass)
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
		RenderingContext.deltaTimeMs = this.enableAnimation
			? Math.min(deltaDiff, 0.5)
			: 0;
		const jsPerfStartTime = performance.now();

		this.debugCamera.onFrameStart();
		this.mainCamera.onFrameStart();

		const commandEncoder = RenderingContext.device.createCommandEncoder({
			label: "Frame Command Encoder",
		});

		this.lightingManager.update(commandEncoder);
		this.renderPassComposer.render(commandEncoder);

		this.texturesDebugContainer.setTextureGBufferSection(
			TextureDebugMeshType.Albedo,
			this.renderPassComposer.getTexture(
				RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
			),
		);
		this.texturesDebugContainer.setTextureGBufferSection(
			TextureDebugMeshType.Normal,
			this.renderPassComposer.getTexture(
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
			),
		);
		this.texturesDebugContainer.setTextureGBufferSection(
			TextureDebugMeshType.Metallic,
			this.renderPassComposer.getTexture(
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
			),
		);
		this.texturesDebugContainer.setTextureGBufferSection(
			TextureDebugMeshType.Roughness,
			this.renderPassComposer.getTexture(
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
			),
		);
		this.texturesDebugContainer.setTextureGBufferSection(
			TextureDebugMeshType.AO,
			this.renderPassComposer.getTexture(RENDER_PASS_SSAO_BLUR_TEXTURE),
		);
		this.texturesDebugContainer.setTextureGBufferSection(
			TextureDebugMeshType.Reflectance,
			this.renderPassComposer.getTexture(
				RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
			),
		);
		this.texturesDebugContainer.setTextureGBufferSection(
			TextureDebugMeshType.Depth,
			this.renderPassComposer.getTexture(RENDER_PASS_DEPTH_STENCIL_TEXTURE),
		);
		this.texturesDebugContainer.setTextureGBufferSection(
			TextureDebugMeshType.Velocity,
			this.renderPassComposer.getTexture(RENDER_PASS_VELOCITY_TEXTURE),
		);
		this.texturesDebugContainer.shadowDebugSection.setTextureFor(
			TextureDebugMeshType.ShadowDepthCascade0,
			this.renderPassComposer.getTexture(
				RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE,
			),
		);
		this.texturesDebugContainer.shadowDebugSection.setTextureFor(
			TextureDebugMeshType.ShadowDepthCascade1,
			this.renderPassComposer.getTexture(
				RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE,
			),
		);
		this.texturesDebugContainer.render(commandEncoder);

		RenderingContext.device.queue.submit([commandEncoder.finish()]);

		this.renderPassComposer.onFrameEnd();
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
			(blitRenderPassTimings[1] - gbufferRenderPassTimings[0]) / 1_000_000;

		this.cpuAverage.addSample(jsPerfTime);
		this.fpsDisplayAverage.addSample(1 / deltaDiff);
		this.gpuAverage.addSample(totalGPUTime);

		const cpuAverageStat = this.cpuAverage.get();
		const fpsAverageStat = this.fpsDisplayAverage.get();
		const gpuAverageStat = this.gpuAverage.get();

		this.timingDebugContainer
			.setDisplayValue(
				DebugStatType.CPUTotal,
				cpuAverageStat !== 0 ? `${cpuAverageStat.toFixed(1)}ms` : "N/A",
			)
			.setDisplayValue(
				DebugStatType.GPUTotal,
				gpuAverageStat > 0 ? `${gpuAverageStat.toFixed(1)}ms` : "N/A",
			)
			.setDisplayValue(
				DebugStatType.FPS,
				fpsAverageStat !== 0 ? `${fpsAverageStat.toFixed(1)}ms` : "N/A",
			)
			.setDisplayValue(DebugStatType.VRAM, VRAMUsageTracker.getFormattedSize())
			.setDisplayValue(
				DebugStatType.VisibleMeshes,
				`${this.scene.visibleNodesCount} / ${this.scene.nodesCount}`,
			)
			.setDisplayValue(
				DebugStatType.LightsCount,
				this.lightingManager.lightsCount.toString(),
			);

		RenderingContext.frameIndex++;
	}
}
