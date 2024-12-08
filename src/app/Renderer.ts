import PerspectiveCamera from "../renderer/camera/PerspectiveCamera";
import {
	MAIN_CAMERA_FAR,
	MAIN_CAMERA_NEAR,
	ORTHO_CAMERA_FAR,
	ORTHO_CAMERA_NEAR,
} from "./constants";
import Drawable from "../renderer/scene/Drawable";
import PipelineStates from "../renderer/core/PipelineStates";
import OrthographicCamera from "../renderer/camera/OrthographicCamera";

import GBufferRenderPass from "./render-passes/GBufferRenderPass";
import GBufferIntegratePass from "./render-passes/LightingPass/GBufferIntegratePass";
import GroundContainer from "./meshes/ground/GroundContainer";
import CubeGeometry from "../renderer/geometry/CubeGeometry";
import MaterialCache from "./utils/MaterialCache";
import Transform from "../renderer/scene/Transform";
import ReflectionComputePass from "./render-passes/ReflectionComputePass";
import SphereGeometry from "../renderer/geometry/SphereGeometry";
import TAAResolvePass from "./render-passes/TAAResolvePass";
import PointLight from "../renderer/lighting/PointLight";
import Light from "../renderer/lighting/Light";
import DirectionalLight from "../renderer/lighting/DirectionalLight";
import DirectionalShadowPass from "./render-passes/DirectionalShadowPass";
import GLTFModel from "../renderer/scene/GLTFModel";
import { BIND_GROUP_LOCATIONS } from "../renderer/core/RendererBindings";
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
import DebugBoundsPass from "./render-passes/DebugBoundsPass";
import CameraFlyController from "../renderer/camera/CameraFlyController";
import SSAORenderPass from "./render-passes/SSAORenderPass/SSAORenderPass";
import RollingAverage from "../renderer/debug/RollingAverage";
import TimingDebugContainer from "./debug/timings-debug/TimingDebugContainer";
import { RenderPassType } from "../renderer/types";
// import EnvironmentProbePass from "./render-passes/EnvironmentProbePass";

const a = document.getElementById("a");
export default class Renderer {
	public static $canvas: HTMLCanvasElement;
	public static canvasContext: GPUCanvasContext;
	public static device: GPUDevice;
	public static supportsGPUTimestampQuery: boolean;
	public static elapsedTimeMs = 0;

	public static activeRenderPass?: RenderPassType;

	private static prevTimeMs = 0;

	public static pixelFormat: GPUTextureFormat;
	public static readonly depthStencilFormat: GPUTextureFormat =
		"depth32float-stencil8";

	public static initialize = async (
		canvas: HTMLCanvasElement,
	): Promise<Renderer> => {
		const adapter = await navigator.gpu.requestAdapter();

		Renderer.$canvas = canvas;
		Renderer.canvasContext = canvas.getContext("webgpu") as GPUCanvasContext;

		Renderer.pixelFormat = navigator.gpu.getPreferredCanvasFormat();

		const requiredFeatures: GPUFeatureName[] = [];

		const supportsGPUTimestampQuery = adapter.features.has("timestamp-query");

		if (supportsGPUTimestampQuery) {
			requiredFeatures.push("timestamp-query");
		}

		const supportsDepth32Stencil8Texture = adapter.features.has(
			"depth32float-stencil8",
		);

		if (supportsDepth32Stencil8Texture) {
			requiredFeatures.push("depth32float-stencil8");
		}
		requiredFeatures.push("bgra8unorm-storage");
		console.log(requiredFeatures);
		Renderer.device = await adapter.requestDevice({
			requiredFeatures,
		});

		Renderer.supportsGPUTimestampQuery = supportsGPUTimestampQuery;

		Renderer.canvasContext.configure({
			device: Renderer.device,
			format: Renderer.pixelFormat,
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
			alphaMode: "premultiplied",
		});

		return new Renderer();
	};

	public orthoCamera: OrthographicCamera;
	public mainCamera: PerspectiveCamera;
	public debugCamera: PerspectiveCamera;
	// public mainCameraCtrl: CameraOrbitController;
	public mainCameraCtrl: CameraFlyController;

	public debugBoundingBoxes = false;

	private scene = new Scene();
	private skybox: Skybox;
	private ground: GroundContainer;
	private cube: Drawable;
	private cube1: Drawable;
	private sphere: Drawable;
	private pbrSpheres: PBRSpheres;

	private sceneDirectionalLight = new DirectionalLight();

	// private bdrfLUTDebugTex?: TextureDebugMesh

	private gbufferRenderPass: GBufferRenderPass;
	private gbufferIntegratePass?: GBufferIntegratePass;
	private reflectionComputePass: ReflectionComputePass;
	private taaResolvePass: TAAResolvePass;
	private shadowPass: DirectionalShadowPass;
	private transparentPass: TransparentRenderPass;
	private ssaoPass: SSAORenderPass;
	private debugBBoxesPass: DebugBoundsPass;
	// private environmentProbePass: EnvironmentProbePass;

	private jsAverage = new RollingAverage();
	private fpsAverage = new RollingAverage();

	private texturesDebugContainer: TexturesDebugContainer;
	private timingDebugContainer: TimingDebugContainer;

	private orthoCameraBindGroup: GPUBindGroup;

	public autoRotateSun = false;
	public rotateAngle = Math.PI * 0.2;

	private _enableTAA = true;
	public get enableTAA(): boolean {
		return this._enableTAA;
	}
	public set enableTAA(v: boolean) {
		this._enableTAA = v;
		this.mainCamera.shouldJitter = v;
	}

	private _debugGBuffer = false;
	public get debugGBuffer(): boolean {
		return this._debugGBuffer;
	}
	public set debugGBuffer(v: boolean) {
		this._debugGBuffer = v;
		v
			? this.texturesDebugContainer.reveal()
			: this.texturesDebugContainer.hide();
	}

	private _debugShadowMap = false;
	public get debugShadowMap(): boolean {
		return this._debugShadowMap;
	}
	public set debugShadowMap(v: boolean) {
		this._debugShadowMap = v;
		v
			? this.texturesDebugContainer.reveal()
			: this.texturesDebugContainer.hide();
	}

	public get debugShadowCascadeIndex(): boolean {
		return this.gbufferIntegratePass.debugShadowCascadeIndex;
	}
	public set debugShadowCascadeIndex(v: boolean) {
		this.gbufferIntegratePass.debugShadowCascadeIndex = v;
	}

	public debugPointLights = false;

	private _enableAnimation = true;
	public get enableAnimation(): boolean {
		return this._enableAnimation;
	}
	public set enableAnimation(v: boolean) {
		this._enableAnimation = v;
	}

	private _toggleDebugCamera = false;
	public get toggleDebugCamera(): boolean {
		return this._toggleDebugCamera;
	}
	public set toggleDebugCamera(v: boolean) {
		this._toggleDebugCamera = v;
		// this.gbufferRenderPass.toggleDebugCamera(v);
		// this.gbufferIntegratePass.toggleDebugCamera(v);
		// this.transparentPass.toggleDebugCamera(v);
		// this.taaResolvePass.toggleDebugCamera(v);
	}

	constructor() {
		// OBJLoader.loadObjFileContents("/Buda_b.obj").then((buda) => {
		// 	const model1 = new OBJDrawable(buda.models[0]);
		// 	const drawable1 = new Drawable(model1);
		// 	drawable1.setMaterial(MaterialCache.defaultDeferredPBRMaterial);
		// 	drawable1.setPositionX(3).updateWorldMatrix();
		// 	drawable1.materialProps.isReflective = false;
		// 	drawable1.setMaterial(
		// 		MaterialCache.defaultShadowMaterial,
		// 		RenderPassType.Shadow,
		// 	);
		// 	drawable1.materialProps.setColor(1, 1, 1);
		// 	this.scene.addChild(drawable1);
		// });

		// OBJLoader.loadObjFileContents("/Buda_2.obj").then((buda) => {
		// 	// debugger;
		// 	const model0 = new OBJDrawable(buda.models[0]);
		// 	const drawable = new Drawable(model0);
		// 	drawable.setMaterial(MaterialCache.defaultDeferredPBRMaterial);
		// 	drawable.setMaterial(
		// 		MaterialCache.defaultShadowMaterial,
		// 		RenderPassType.Shadow,
		// 	);
		// 	drawable.setPositionX(3).updateWorldMatrix();
		// 	drawable.materialProps.setColor(1, 1, 1);
		// 	this.scene.addChild(drawable);
		// });

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

		// this.mainCameraCtrl = new CameraOrbitController(
		// 	this.mainCamera,
		// 	Renderer.$canvas,
		// 	true,
		// );
		// this.mainCameraCtrl.setLookAt(0, 2, 0);
		// this.mainCameraCtrl.startTick();

		this.mainCameraCtrl = new CameraFlyController(
			this.mainCamera,
			// Renderer.$canvas,
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

		this.orthoCamera = new OrthographicCamera(
			0,
			1,
			1,
			0,
			ORTHO_CAMERA_NEAR,
			ORTHO_CAMERA_FAR,
		);
		this.orthoCamera.setPosition(0, 0, 1);
		this.orthoCamera.setLookAt(0, 0, 0);
		this.orthoCamera.updateViewMatrix();

		this.orthoCameraBindGroup = Renderer.device.createBindGroup({
			label: "Ortho Camera Bind Group",
			layout: PipelineStates.defaultCameraBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.orthoCamera.gpuBuffer,
					},
				},
			],
		});

		this.texturesDebugContainer = new TexturesDebugContainer();
		this.timingDebugContainer = new TimingDebugContainer();

		// this.ground = new GroundContainer();
		// this.scene.addChild(this.ground);

		this.cube = new Drawable(new CubeGeometry(1, 1, 1));
		this.cube.label = "Cube 1";

		this.cube.setPosition(3, 3, 3);
		this.cube.setScale(0.3, 0.3, 0.3);
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
		this.cube.materialProps.metallic = 0.9;
		this.cube.materialProps.roughness = 0.2;
		this.cube.materialProps.setColor(0.6, 0.6, 0.6);

		this.cube1 = new Drawable(new CubeGeometry(1, 1, 1));
		this.cube1.label = "Cube 2";
		this.cube1.setMaterial(
			MaterialCache.defaultDeferredPBRMaterial,
			RenderPassType.Deferred,
		);
		this.cube1.setMaterial(
			MaterialCache.defaultShadowMaterial,
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
		this.sphere.materialProps.metallic = 1;
		this.sphere.materialProps.roughness = 0.96;
		this.sphere
			.setScale(0.5, 0.5, 0.5)
			.setPositionX(2)
			.setPositionZ(1.2)
			.updateWorldMatrix();

		// this.pbrSpheres = new PBRSpheres();
		// this.scene.addChild(this.pbrSpheres);

		// this.scene.addChild(this.cube);
		// this.scene.addChild(this.cube1);
		// this.scene.addChild(this.sphere);

		const pointLightsCount = 20;
		const pointLightsCircleStep = (Math.PI * 2) / pointLightsCount;
		const radiusStep = pointLightsCount / 4;
		for (let i = 0; i < pointLightsCount; i++) {
			const p = new PointLight();
			const r = i * radiusStep;
			p.setPosition(
				Math.cos(i * pointLightsCircleStep) * 2,
				0,
				Math.sin(i * pointLightsCircleStep) * 2,
			);
			p.intensity = 2;
			p.radius = 3;
			p.setColor(1, 1, 1);
			// this.scene.addPointLight(p);
		}

		this.sceneDirectionalLight.setPosition(0, 100, 0);
		this.sceneDirectionalLight.setColor(1, 1, 1);
		this.sceneDirectionalLight.intensity = 1;
		this.scene.addDirectionalLight(this.sceneDirectionalLight);

		this.scene.updateLightsBuffer();

		this.shadowPass = new DirectionalShadowPass(
			this.scene,
			this.sceneDirectionalLight,
		);
		this.shadowPass.setCamera(this.mainCamera);

		// this.environmentProbePass = new EnvironmentProbePass();

		this.skybox = new Skybox();

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
			this.skybox.setTexture(diffuseTexture);

			this.gbufferIntegratePass
				.setDiffuseIBLTexture(diffuseTexture)
				.setSpecularIBLTexture(specularTexture)
				.setBDRFLutTexture(bdrfLutTexture);
		});

		const a = new GLTFModel("/sponza/Sponza.gltf");
		this.scene.addChild(a);
		a.setPositionY(2) //.setRotationY(Math.PI * 0.5)
			.updateWorldMatrix();
		a.load().then(() => {
			if (!this.debugBBoxesPass) {
				this.debugBBoxesPass = new DebugBoundsPass(this.scene);
			}
			this.debugBBoxesPass.setCamera(this.mainCamera);
			this.debugBBoxesPass.inPlaceTextureView =
				this.transparentPass.inPlaceTextureView;
			this.debugBBoxesPass.inPlaceDepthStencilTextureView =
				this.transparentPass.inPlaceDepthStencilTextureView;
			// a.setIsReflective(false);
			a.setMaterial(MaterialCache.defaultTexturedDeferredMaterial);

			a.setMaterial(
				MaterialCache.defaultTransparentPBRMaterial,
				RenderPassType.Transparent,
			);
			a.setMaterial(MaterialCache.defaultShadowMaterial, RenderPassType.Shadow);
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
		this.orthoCamera.onResize(w, h);

		if (!this.gbufferRenderPass) {
			this.gbufferRenderPass = new GBufferRenderPass(this.scene);
			this.gbufferRenderPass.setCamera(this.mainCamera);
			this.gbufferRenderPass.setDebugCamera(this.debugCamera);
		}
		this.gbufferRenderPass.onResize(w, h);

		if (!this.ssaoPass) {
			this.ssaoPass = new SSAORenderPass(
				this.scene,
				this.gbufferRenderPass.normalMetallicRoughnessTextureView,
				this.gbufferRenderPass.depthTextureView,
			);
		}
		this.ssaoPass.setCamera(this.mainCamera);
		this.ssaoPass.onResize(w, h);

		if (!this.gbufferIntegratePass) {
			this.gbufferIntegratePass = new GBufferIntegratePass(
				this.scene,
				this.gbufferRenderPass.normalMetallicRoughnessTextureView,
				this.gbufferRenderPass.colorReflectanceTextureView,
				this.gbufferRenderPass.depthTextureView,
				this.gbufferRenderPass.depthStencilTextureView,
				this.ssaoPass.outTextureView,
				this.shadowPass.shadowTextureViewCascadesAll,
				this.shadowPass.shadowCascadesBuffer,
			);
			this.gbufferIntegratePass.setCamera(this.mainCamera);
			this.gbufferIntegratePass.setDebugCamera(this.debugCamera);
			this.gbufferIntegratePass.skybox = this.skybox;
		}
		// this.gbufferIntegratePass.setLights(this.lights);
		this.gbufferIntegratePass.setCamera(this.mainCamera);
		this.gbufferIntegratePass.setDebugCamera(this.debugCamera);
		this.gbufferIntegratePass.onResize(w, h);

		if (!this.transparentPass) {
			this.transparentPass = new TransparentRenderPass(this.scene);
		}
		this.transparentPass.setCamera(this.mainCamera);
		this.transparentPass.setDebugCamera(this.debugCamera);
		this.transparentPass.inPlaceDepthStencilTextureView =
			this.gbufferRenderPass.depthStencilTextureView;
		this.transparentPass.inPlaceTextureView =
			this.gbufferIntegratePass.outTextureView;

		if (!this.taaResolvePass) {
			this.taaResolvePass = new TAAResolvePass(
				this.scene,
				this.transparentPass.inPlaceTextureView,
				this.gbufferRenderPass.velocityTextureView,
			);
		}
		this.taaResolvePass.onResize(w, h);
		this.taaResolvePass.setDebugCamera(this.debugCamera);

		if (!this.reflectionComputePass) {
			this.reflectionComputePass = new ReflectionComputePass(this.scene);
		}
		this.reflectionComputePass.onResize(w, h);

		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Albedo,
			this.gbufferRenderPass.colorReflectanceTexture,
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Normal,
			this.gbufferRenderPass.normalMetallicRoughnessTexture,
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Metallic,
			this.gbufferRenderPass.normalMetallicRoughnessTexture,
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Roughness,
			this.gbufferRenderPass.normalMetallicRoughnessTexture,
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.AO,
			this.ssaoPass.outTexture,
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Reflectance,
			this.gbufferRenderPass.colorReflectanceTexture,
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Depth,
			this.gbufferRenderPass.depthStencilTexture,
		);
		this.texturesDebugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Velocity,
			this.gbufferRenderPass.velocityTexture,
		);
		this.texturesDebugContainer.shadowDebugSection.setTextureFor(
			TextureDebugMeshType.ShadowDepthCascade0,
			this.shadowPass.shadowTexture,
		);
		this.texturesDebugContainer.shadowDebugSection.setTextureFor(
			TextureDebugMeshType.ShadowDepthCascade1,
			this.shadowPass.shadowTexture,
		);
	}

	public async renderFrame(elapsedTime: number) {
		const now = (elapsedTime - Renderer.elapsedTimeMs) * 0.001;
		const deltaDiff = now - Renderer.prevTimeMs;
		Renderer.prevTimeMs = now;
		Renderer.elapsedTimeMs += this.enableAnimation ? deltaDiff : 0;

		const jsPerfStartTime = performance.now();

		a.textContent = `Display Meshes: ${this.scene.visibleNodesCount} / ${this.scene.nodesCount}`;

		const device = Renderer.device;

		this.gbufferIntegratePass.debugPointLights = this.debugPointLights;

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
		this.orthoCamera.onFrameStart();

		if (this.enableAnimation) {
			this.cube
				.setScale(1, 1, 1)
				.setRotationY(Renderer.elapsedTimeMs)
				.updateWorldMatrix();

			this.sphere
				.setScale(1, 1, 1)
				.setPositionX(Math.cos(Renderer.elapsedTimeMs) * 2.75)
				.setPositionZ(Math.sin(Renderer.elapsedTimeMs) * 2.75)
				.updateWorldMatrix();
		}

		if (this.mainCamera.hasChangedSinceLastFrame) {
			this.scene.sortTransparentNodesFrom(this.mainCamera);
		}

		const commandEncoder = device.createCommandEncoder({
			label: "Render Loop Command Encoder",
		});

		// this.environmentProbePass.render(commandEncoder, this.skybox);
		this.shadowPass.render(commandEncoder);
		this.gbufferRenderPass.render(commandEncoder);
		this.ssaoPass.render(commandEncoder);
		this.gbufferIntegratePass.render(commandEncoder);
		this.transparentPass.render(commandEncoder);
		if (this.enableTAA) {
			this.taaResolvePass.render(commandEncoder);
		}
		if (this.debugBBoxesPass) {
			this.debugBBoxesPass.inPlaceTextureView =
				this.taaResolvePass.outTextureView;
			if (this.debugBoundingBoxes) {
				this.debugBBoxesPass.render(commandEncoder);
			}
		}
		this.reflectionComputePass.computeReflections(
			commandEncoder,
			Renderer.canvasContext.getCurrentTexture(),
			this.enableTAA
				? this.debugBBoxesPass?.inPlaceTextureView ||
						this.taaResolvePass.outTextureView
				: this.gbufferIntegratePass.outTextureView,
		);

		const hudRenderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: Renderer.canvasContext.getCurrentTexture().createView(),
				loadOp: "load",
				storeOp: "store",
			},
		];

		this.texturesDebugContainer.render(commandEncoder);

		const hudRenderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: hudRenderPassColorAttachments,
			depthStencilAttachment: undefined,
			label: "HUD Render Pass",
		};
		const hudRenderEncoder = commandEncoder.beginRenderPass(
			hudRenderPassDescriptor,
		);
		hudRenderEncoder.pushDebugGroup("Render HUD");

		hudRenderEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.orthoCameraBindGroup,
		);

		// this.bdrfLUTDebugTex?.render(hudRenderEncoder);

		hudRenderEncoder.popDebugGroup();
		hudRenderEncoder.end();

		device.queue.submit([commandEncoder.finish()]);

		this.debugCamera.onFrameEnd();
		this.mainCamera.onFrameEnd();
		this.orthoCamera.onFrameEnd();

		const jsPerfTime = performance.now() - jsPerfStartTime;
		this.jsAverage.addSample(jsPerfTime);
		this.fpsAverage.addSample(1 / deltaDiff);

		if (Renderer.supportsGPUTimestampQuery) {
			const [gBufferRenderPassTimeResult, ssaoRenderPassTimeResult] =
				await Promise.all([
					this.gbufferRenderPass.getResult(),
					this.ssaoPass.getResult(),
				]);
			this.timingDebugContainer.$root.innerHTML = `
        FPS: ${this.fpsAverage.get().toFixed(1)}ms<br/>
        JS: ${this.jsAverage.get().toFixed(1)}ms<br/>
        G-Buffer Render Pass: ${gBufferRenderPassTimeResult.toFixed(1)}ms<br/>
        SSAO Render Pass: ${ssaoRenderPassTimeResult.toFixed(1)}ms<br/>
        Total GPU Time: ${(
					(gBufferRenderPassTimeResult + ssaoRenderPassTimeResult) /
					1
				).toFixed(1)}
      `;
		}
	}
}
