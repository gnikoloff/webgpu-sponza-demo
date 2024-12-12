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
import GroundContainer from "./meshes/ground/GroundContainer";
import CubeGeometry from "../renderer/geometry/CubeGeometry";
import MaterialCache from "./utils/MaterialCache";
import ReflectionComputePass from "./render-passes/ReflectionComputePass";
import SphereGeometry from "../renderer/geometry/SphereGeometry";
import TAAResolveRenderPass from "./render-passes/TAAResolveRenderPass";
import PointLight from "../renderer/lighting/PointLight";
import DirectionalLight from "../renderer/lighting/DirectionalLight";
import DirectionalShadowRenderPass from "./render-passes/DirectionalShadowRenderPass";
import GLTFModel from "../renderer/scene/GLTFModel";
import TextureLoader from "../renderer/texture/TextureLoader";
import Skybox from "./meshes/Skybox";
import DiffuseIBLGenerator from "../renderer/texture/DiffuseIBLGenerator";
import TextureController from "../renderer/texture/TextureController";
import SpecularIBLGenerator from "../renderer/texture/SpecularIBLGenerator";
import BDRFLutGenerator from "../renderer/texture/BDRFLutGenerator";
import PBRSpheres from "./meshes/PBRSpheres";
import TexturesDebugContainer from "./debug/textures-debug/TexturesDebugContainer";
import { TextureDebugMeshType } from "./debug/textures-debug/DebugTextureCanvas";
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

		const supportsGPUTimestampQuery = false; //adapter.features.has("timestamp-query");

		if (supportsGPUTimestampQuery) {
			requiredFeatures.push("timestamp-query");
		}

		const supportsDepth32Stencil8Texture = adapter.features.has(
			"depth32float-stencil8",
		);

		if (supportsDepth32Stencil8Texture) {
			requiredFeatures.push("depth32float-stencil8");
		}
		// requiredFeatures.push("bgra8unorm-storage");

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

	private scene = new Scene();
	private cube: Drawable;
	private cube1: Drawable;
	private sphere: Drawable;

	private sceneDirectionalLight = new DirectionalLight();

	private renderPassComposer: RenderPassComposer;

	private cpuAverage = new RollingAverage();
	private gpuAverage = new RollingAverage();
	private fpsAverage = new RollingAverage();

	private texturesDebugContainer: TexturesDebugContainer;
	private timingDebugContainer: DebugTimingContainer;

	public autoRotateSun = false;
	public rotateAngle = Math.PI * 0.2;

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

		const pointLightsCount = 20;
		const pointLightsCircleStep = (Math.PI * 2) / pointLightsCount;
		const radiusStep = pointLightsCount / 4;
		for (let i = 0; i < pointLightsCount; i++) {
			const p = new PointLight();
			const r = i * radiusStep;
			p.setPosition(
				Math.cos(i * pointLightsCircleStep) * 2,
				3,
				Math.sin(i * pointLightsCircleStep) * 2,
			);
			p.intensity = 20;
			p.radius = 1;
			p.setColor(1, 1, 0);
			this.scene.addPointLight(p);
		}

		this.sceneDirectionalLight.setPosition(0, 100, 1);
		this.sceneDirectionalLight.setColor(0.2156, 0.2627, 0.3333);
		// this.sceneDirectionalLight.setColor(1, 1, 1);
		this.sceneDirectionalLight.intensity = 2;
		this.scene.addDirectionalLight(this.sceneDirectionalLight);

		this.scene.updateLightsBuffer();

		this.renderPassComposer = new RenderPassComposer();
		this.renderPassComposer.setScene(this.scene);

		const shadowRenderPass = new DirectionalShadowRenderPass(
			this.sceneDirectionalLight,
		)
			.addOutputTexture(RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE)
			.setCamera(this.mainCamera);

		const gbufferRenderPass = new GBufferRenderPass()
			.setCamera(this.mainCamera)
			.addOutputTextures([
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
				RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
				RENDER_PASS_VELOCITY_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			]);

		const ssaoRenderPass = new SSAORenderPass()
			.setCamera(this.mainCamera)
			.addInputTextures([
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			])
			.addOutputTexture(RENDER_PASS_SSAO_TEXTURE);

		const ssaoBlurRenderPass = new SSAOBlurRenderPass()
			.addInputTexture(RENDER_PASS_SSAO_TEXTURE)
			.addOutputTexture(RENDER_PASS_SSAO_BLUR_TEXTURE);

		const directionalAmbientLightRenderPass =
			new DirectionalAmbientLightRenderPass(
				shadowRenderPass.shadowCascadesBuffer,
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

		const pointLightsStencilMaskPass = new PointLightsMaskPass()
			.setCamera(this.mainCamera)
			.addInputTextures([RENDER_PASS_DEPTH_STENCIL_TEXTURE])
			.addOutputTexture(RENDER_PASS_DEPTH_STENCIL_TEXTURE)
			.setLightsBuffer(this.scene.lightsBuffer)
			.updateLightsMaskBindGroup();

		const pointLightsRenderPass = new PointLightsRenderPass()
			.setCamera(this.mainCamera)
			.addInputTextures([
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
				RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
				RENDER_PASS_SSAO_BLUR_TEXTURE,
				RENDER_PASS_LIGHTING_RESULT_TEXTURE,
			])
			.addOutputTexture(RENDER_PASS_LIGHTING_RESULT_TEXTURE);

		const transparentRenderPass = new TransparentRenderPass()
			.setCamera(this.mainCamera)
			.addInputTextures([
				RENDER_PASS_LIGHTING_RESULT_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			])
			.addOutputTextures([
				RENDER_PASS_LIGHTING_RESULT_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			]);

		const skyboxRenderPass = new SkyboxRenderPass()
			.setCamera(this.mainCamera)
			.addInputTextures([
				RENDER_PASS_LIGHTING_RESULT_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			])
			.addOutputTextures([
				RENDER_PASS_LIGHTING_RESULT_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			]);

		const hiZCopyDepthComputePass = new HiZCopyDepthComputePass()
			.addInputTexture(RENDER_PASS_DEPTH_STENCIL_TEXTURE)
			.addOutputTexture(RENDER_PASS_HI_Z_DEPTH_TEXTURE);

		const hiZDepthComputePass = new HiZDepthComputePass()
			.addInputTexture(RENDER_PASS_HI_Z_DEPTH_TEXTURE)
			.addOutputTexture(RENDER_PASS_HI_Z_DEPTH_TEXTURE);

		const reflectionsComputePass = new ReflectionComputePass()
			.setCamera(this.mainCamera)
			.addInputTextures([
				RENDER_PASS_LIGHTING_RESULT_TEXTURE,
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
				RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
				RENDER_PASS_HI_Z_DEPTH_TEXTURE,
			])
			.addOutputTexture(RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE);

		const taaResolveRenderPass = new TAAResolveRenderPass()
			.addInputTextures([
				RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE,
				RENDER_PASS_VELOCITY_TEXTURE,
			])
			.addOutputTexture(RENDER_PASS_TAA_RESOLVE_TEXTURE);

		const debugBBoxesPass = new DebugBoundsPass()
			.addInputTextures([
				RENDER_PASS_TAA_RESOLVE_TEXTURE,
				RENDER_PASS_DEPTH_STENCIL_TEXTURE,
			])
			.addOutputTexture(RENDER_PASS_TAA_RESOLVE_TEXTURE)
			.setScene(this.scene)
			.setCamera(this.mainCamera);

		debugBBoxesPass.enabled = false;

		const blitRenderPass = new BlitRenderPass().addInputTexture(
			RENDER_PASS_TAA_RESOLVE_TEXTURE,
		);

		// const ssrRenderPass = new ReflectionComputePass().addInputTexture(
		// 	RENDER_PASS_TAA_RESOLVE_TEXTURE,
		// );

		this.renderPassComposer
			.addPass(shadowRenderPass)
			.addPass(gbufferRenderPass)
			.addPass(ssaoRenderPass)
			.addPass(ssaoBlurRenderPass)
			.addPass(directionalAmbientLightRenderPass)
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

		// this.renderPassComposer.addPass(debugBBoxesPass);

		// this.mainCameraCtrl = new CameraOrbitController(
		// 	this.mainCamera,
		// 	RenderingContext.$canvas,
		// 	true,
		// );
		// this.mainCameraCtrl.setLookAt(0, 2, 0);
		// this.mainCameraCtrl.startTick();

		this.texturesDebugContainer = new TexturesDebugContainer();
		this.timingDebugContainer = new DebugTimingContainer();

		// this.ground = new GroundContainer();
		// this.scene.addChild(this.ground);

		this.cube = new Drawable(GeometryCache.unitCubeGeometry);
		this.cube.label = "Cube 1";

		this.cube.setPosition(0, 2, 0);
		this.cube.updateWorldMatrix();
		this.cube.setMaterial(
			MaterialCache.defaultDeferredPBRMaterial,
			RenderPassType.Deferred,
		);
		this.cube.setMaterial(
			MaterialCache.defaultShadowMaterial,
			RenderPassType.Shadow,
		);
		this.cube.materialProps.isReflective = false;
		this.cube.materialProps.metallic = 0.2;
		this.cube.materialProps.roughness = 0.7;
		this.cube.materialProps.setColor(0.6, 0.6, 0.6);
		this.scene.addChild(this.cube);

		this.cube1 = new Drawable(new CubeGeometry(1, 1, 1));
		this.cube1.label = "Cube 2";
		this.cube1.setMaterial(
			MaterialCache.defaultGLTFDeferredPBRMaterial,
			RenderPassType.Deferred,
		);
		this.cube1.setMaterial(
			MaterialCache.defaultGLTFShadowMaterial,
			RenderPassType.Shadow,
		);
		this.cube1.materialProps.isReflective = false;
		this.cube1.materialProps.setColor(0.1, 0.8, 0.2);
		this.cube1.setPosition(2, 8, 9).setScale(5, 0.1, 0.1);
		this.cube1.updateWorldMatrix();

		this.sphere = new Drawable(new SphereGeometry());
		this.sphere.label = "Sphere";
		this.sphere.setMaterial(
			MaterialCache.defaultDeferredPBRMaterial,
			RenderPassType.Deferred,
		);
		this.sphere.setMaterial(
			MaterialCache.defaultShadowMaterial,
			RenderPassType.Shadow,
		);
		this.sphere.materialProps.setColor(0.8, 0.3, 0.3);
		this.sphere.materialProps.metallic = 0.3;
		this.sphere.materialProps.roughness = 0.96;
		this.sphere.materialProps.isReflective = false;

		this.scene.addChild(this.sphere);

		// this.pbrSpheres = new PBRSpheres();
		// this.scene.addChild(this.pbrSpheres);

		// this.scene.addChild(this.cube);
		// this.scene.addChild(this.cube1);
		// this.scene.addChild(this.sphere);

		// this.shadowPass = new DirectionalShadowRenderPass(
		// 	this.scene,
		// 	this.sceneDirectionalLight,
		// );
		// this.shadowPass.setCamera(this.mainCamera);

		// this.environmentProbePass = new EnvironmentProbePass();

		this.scene.skybox = new Skybox();

		// TextureLoader.loadHDRImage("/cobblestone_street_night_2k.hdr").then();
		// TextureLoader.loadHDREnvironmentAsCubeMapTexture(
		// 	"/cobblestone_street_night_2k.hdr",
		// ).then((cubeTex) => {
		// 	this.skybox.setTexture(cubeTex);
		// });

		TextureLoader.load6SeparateHDRFacesAsCubeMapTexture(
			["/px.hdr", "/nx.hdr", "/py.hdr", "/ny.hdr", "/pz.hdr", "/nz.hdr"],
			512,
			true,
			"Skybox Faces",
		).then((texture) => {
			const diffuseTexture = DiffuseIBLGenerator.encode(texture);
			const specularTexture = SpecularIBLGenerator.encode(texture, 256);
			const bdrfLutTexture = BDRFLutGenerator.encode();

			TextureController.generateMipsForCubeTexture(diffuseTexture);
			this.scene.skybox.setTexture(diffuseTexture);

			const dirAmbientLightPass = this.renderPassComposer.getPass(
				RenderPassType.DirectionalAmbientLighting,
			) as DirectionalAmbientLightRenderPass;

			dirAmbientLightPass
				.setDiffuseIBLTexture(diffuseTexture)
				.setSpecularIBLTexture(specularTexture)
				.setBDRFLutTexture(bdrfLutTexture);
		});

		const a = new GLTFModel("/sponza/Sponza.gltf");
		this.scene.addChild(a);
		a.setPositionY(2) //.setRotationY(Math.PI * 0.5)
			.updateWorldMatrix();
		a.load().then(() => {
			// a.setIsReflective(false);
			a.setMaterial(MaterialCache.defaultGLTFTexturedDeferredMaterial);

			a.setMaterial(
				MaterialCache.defaultGLTFTransparentPBRMaterial,
				RenderPassType.Transparent,
			);
			a.setMaterial(
				MaterialCache.defaultGLTFShadowMaterial,
				RenderPassType.Shadow,
			);
		});

		// const mipTex = TextureLoader.generateMipsFor2DTextureWithComputePSO(
		// 	TextureLoader.dummyTexture,
		// 	"dummy tex mipmapped",
		// );
		// console.log({ mipTex });
	}

	public resize(w: number, h: number) {
		this.debugCamera.onResize(w, h);
		this.mainCamera.onResize(w, h);

		this.renderPassComposer.onResize(w, h);

		// if (!this.reflectionComputePass) {
		// 	this.reflectionComputePass = new ReflectionComputePass(this.scene);
		// }
		// this.reflectionComputePass.onResize(w, h);
	}

	public async renderFrame(elapsedTime: number) {
		const now = (elapsedTime - RenderingContext.elapsedTimeMs) * 0.001;
		const deltaDiff = now - RenderingContext.prevTimeMs;
		RenderingContext.prevTimeMs = now;
		RenderingContext.elapsedTimeMs += this.enableAnimation ? deltaDiff : 0;

		const jsPerfStartTime = performance.now();

		a.textContent = `Display Meshes: ${this.scene.visibleNodesCount} / ${this.scene.nodesCount}`;

		if (this.autoRotateSun) {
			this.rotateAngle += deltaDiff * 0.1;
			// this.sceneDirectionalLight.setPosition(
			// 	Math.cos(this.rotateAngle) * 3,
			// 	this.sceneDirectionalLight.position[1],
			// 	Math.sin(this.rotateAngle) * 3,
			// );
		}

		this.debugCamera.onFrameStart();
		this.mainCamera.onFrameStart();

		if (this.enableAnimation) {
			this.cube
				.setScale(0.5, 0.5, 0.5)
				.setRotationY(RenderingContext.elapsedTimeMs)
				.updateWorldMatrix();

			this.sphere
				.setScale(0.2, 0.2, 0.2)
				.setPositionX(Math.cos(RenderingContext.elapsedTimeMs) * 1)
				.setPositionZ(Math.sin(RenderingContext.elapsedTimeMs) * 1)
				.setPositionY(4)
				.updateWorldMatrix();
		}

		if (this.mainCamera.hasChangedSinceLastFrame) {
			this.scene.sortTransparentNodesFrom(this.mainCamera);
		}

		const commandEncoder = RenderingContext.device.createCommandEncoder({
			label: "Render Pass Composer Command Encoder",
		});

		this.renderPassComposer.render(commandEncoder);

		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Albedo,
			this.renderPassComposer.getTexture(
				RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
			),
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Normal,
			this.renderPassComposer.getTexture(
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
			),
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Metallic,
			this.renderPassComposer.getTexture(
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
			),
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Roughness,
			this.renderPassComposer.getTexture(
				RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
			),
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.AO,
			this.renderPassComposer.getTexture(RENDER_PASS_SSAO_BLUR_TEXTURE),
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Reflectance,
			this.renderPassComposer.getTexture(
				RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
			),
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Depth,
			this.renderPassComposer.getTexture(RENDER_PASS_DEPTH_STENCIL_TEXTURE),
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
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

		this.mainCamera.onFrameEnd();
		this.debugCamera.onFrameEnd();

		// const [gbufferRenderPassTimeOffsets, blitRenderPassTimeOffsets] =
		// 	await Promise.all([
		// 		this.renderPassComposer
		// 			.getPass(RenderPassType.Deferred)
		// 			.getStartAndEndTimings(),
		// 		this.renderPassComposer
		// 			.getPass(RenderPassType.Blit)
		// 			.getStartAndEndTimings(),
		// 	]);

		const jsPerfTime = performance.now() - jsPerfStartTime;

		const [
			gbufferRenderPassTimingResult,
			directionalAmbientLightRenderPassTimingResult,
			pointLightsStencilMaskPassTimingResult,
			pointLightsLightingTimingResult,
			ssaoRenderPassTimingResult,
			transparentRenderPassTimingResult,
			taaResolveRenderPassTimingResult,
			blitRenderPassTimingResult,
		] = await Promise.all([
			this.renderPassComposer
				.getPass(RenderPassType.Deferred)
				.getTimingResult(),
			this.renderPassComposer
				.getPass(RenderPassType.DirectionalAmbientLighting)
				.getTimingResult(),
			this.renderPassComposer
				.getPass(RenderPassType.PointLightsStencilMask)
				.getTimingResult(),
			this.renderPassComposer
				.getPass(RenderPassType.PointLightsLighting)
				.getTimingResult(),
			this.renderPassComposer.getPass(RenderPassType.SSAO).getTimingResult(),
			this.renderPassComposer
				.getPass(RenderPassType.Transparent)
				.getTimingResult(),
			this.renderPassComposer
				.getPass(RenderPassType.TAAResolve)
				.getTimingResult(),
			this.renderPassComposer.getPass(RenderPassType.Blit).getTimingResult(),
		]);

		const gbufferRenderPassTimings = gbufferRenderPassTimingResult.timings;
		const blitRenderPassTimings = blitRenderPassTimingResult.timings;
		const totalGPUTime =
			Math.abs(blitRenderPassTimings[1] - gbufferRenderPassTimings[0]) /
			1_000_000;

		this.cpuAverage.addSample(jsPerfTime);
		this.fpsAverage.addSample(1 / deltaDiff);
		this.gpuAverage.addSample(totalGPUTime);

		this.timingDebugContainer
			.setDisplayValue(DebugTimingType.CPUTotal, this.cpuAverage.get())
			.setDisplayValue(DebugTimingType.GPUTotal, this.gpuAverage.get())
			.setDisplayValue(DebugTimingType.FPS, this.fpsAverage.get())
			.setDisplayValue(
				DebugTimingType.DeferredRenderPass,
				gbufferRenderPassTimingResult.avgValue,
			)
			.setDisplayValue(
				DebugTimingType.DirectionalAmbientLightingRenderPass,
				directionalAmbientLightRenderPassTimingResult.avgValue,
			)
			.setDisplayValue(
				DebugTimingType.PointLightsStencilMask,
				pointLightsStencilMaskPassTimingResult.avgValue,
			)
			.setDisplayValue(
				DebugTimingType.PointLightsLighting,
				pointLightsLightingTimingResult.avgValue,
			)
			.setDisplayValue(
				DebugTimingType.SSAORenderPass,
				ssaoRenderPassTimingResult.avgValue,
			)
			.setDisplayValue(
				DebugTimingType.TransparentRenderPass,
				transparentRenderPassTimingResult.avgValue,
			)
			.setDisplayValue(
				DebugTimingType.BlitRenderPass,
				blitRenderPassTimingResult.avgValue,
			)
			.setDisplayValue(
				DebugTimingType.TAAResolveRenderPass,
				taaResolveRenderPassTimingResult.avgValue,
			);
	}
}
