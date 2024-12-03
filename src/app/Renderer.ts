import CameraController from "../renderer/camera/CameraController";
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
import { RenderPassType } from "../renderer/core/RenderPass";
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
import DebugContainer from "./debug/DebugContainer";
import { TextureDebugMeshType } from "./debug/DebugTextureCanvas";
// import EnvironmentProbePass from "./render-passes/EnvironmentProbePass";

export default class Renderer {
	public static $canvas: HTMLCanvasElement;
	public static canvasContext: GPUCanvasContext;
	public static device: GPUDevice;
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

		const depth32Stencil8RenderFeature: GPUFeatureName =
			"depth32float-stencil8";
		const bgra8UnormStorageFeature: GPUFeatureName = "bgra8unorm-storage";
		Renderer.device = await adapter.requestDevice({
			requiredFeatures:
				Renderer.pixelFormat === "bgra8unorm"
					? [bgra8UnormStorageFeature, depth32Stencil8RenderFeature]
					: [depth32Stencil8RenderFeature],
		});

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
	public mainCameraCtrl: CameraController;

	private rootTransform = new Transform();
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
	// private environmentProbePass: EnvironmentProbePass;

	private debugContainer: DebugContainer;

	private lights: Light[];

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
		v ? this.debugContainer.reveal() : this.debugContainer.hide();
	}

	private _debugShadowMap = false;
	public get debugShadowMap(): boolean {
		return this._debugShadowMap;
	}
	public set debugShadowMap(v: boolean) {
		this._debugShadowMap = v;
		v ? this.debugContainer.reveal() : this.debugContainer.hide();
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

	constructor() {
		// OBJLoader.loadObjFileContents("/Buda_b.obj").then((buda) => {
		// 	const model1 = new OBJDrawable(buda.models[0]);
		// 	const drawable1 = new Drawable(model1);
		// 	drawable1.setMaterial(MaterialCache.defaultDeferredMaterial);
		// 	drawable1.setPositionX(3).updateWorldMatrix();
		// 	drawable1.materialProps.isReflective = false;
		// 	drawable1.setMaterial(
		// 		MaterialCache.defaultShadowMaterial,
		// 		RenderPassType.Shadow,
		// 	);
		// 	drawable1.materialProps.setColor(1, 1, 1);
		// 	this.rootTransform.addChild(drawable1);
		// });

		// OBJLoader.loadObjFileContents("/Buda_2.obj").then((buda) => {
		// 	// debugger;
		// 	const model0 = new OBJDrawable(buda.models[0]);
		// 	const drawable = new Drawable(model0);
		// 	drawable.setMaterial(MaterialCache.defaultDeferredMaterial);
		// 	drawable.setMaterial(
		// 		MaterialCache.defaultShadowMaterial,
		// 		RenderPassType.Shadow,
		// 	);
		// 	drawable.setPositionX(3).updateWorldMatrix();
		// 	drawable.materialProps.setColor(1, 1, 1);
		// 	this.rootTransform.addChild(drawable);
		// });

		this.mainCamera = new PerspectiveCamera(
			45,
			1,
			MAIN_CAMERA_NEAR,
			MAIN_CAMERA_FAR,
		);
		this.mainCamera.shouldJitter = true;
		this.mainCamera.setPosition(-10, 2, 0);
		// this.mainCamera.setLookAt(0, 4, 0);
		this.mainCamera.updateViewMatrix();
		this.mainCameraCtrl = new CameraController(
			this.mainCamera,
			Renderer.$canvas,
			true,
		);
		this.mainCameraCtrl.setLookAt(0, 2, 0);
		this.mainCameraCtrl.startTick();

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

		this.debugContainer = new DebugContainer();

		this.rootTransform.updateWorldMatrix();

		this.ground = new GroundContainer();
		// this.rootTransform.addChild(this.ground);

		this.cube = new Drawable(new CubeGeometry(1, 1, 1));
		this.cube.label = "Cube 1";

		this.cube.setPosition(3, 3, 3);
		this.cube.setScale(0.3, 0.3, 0.3);
		this.cube.updateWorldMatrix();
		this.cube.setMaterial(
			MaterialCache.defaultDeferredMaterial,
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
			MaterialCache.defaultDeferredMaterial,
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
			MaterialCache.defaultDeferredMaterial,
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

		this.pbrSpheres = new PBRSpheres();
		this.rootTransform.addChild(this.pbrSpheres);

		// this.rootTransform.addChild(this.cube);
		// this.rootTransform.addChild(this.cube1);
		// this.rootTransform.addChild(this.sphere);

		const pointLights: PointLight[] = [];
		const pointLightsCount = 20;
		const pointLightsCircleStep = (Math.PI * 2) / pointLightsCount;
		const radiusStep = pointLightsCount / 4;
		for (let i = 0; i < pointLightsCount; i++) {
			const p = new PointLight();
			const r = i * radiusStep;
			p.setPosition(
				Math.cos(i * pointLightsCircleStep) * 2,
				1,
				Math.sin(i * pointLightsCircleStep) * 2,
			);
			p.intensity = 2;
			p.radius = 4;
			p.setColor(10, 10, 10);
			// pointLights.push(p);
		}

		this.sceneDirectionalLight.setPosition(0, 10, 0.1);
		this.sceneDirectionalLight.setColor(1, 1, 1);
		this.sceneDirectionalLight.intensity = 2;
		this.lights = [...pointLights, this.sceneDirectionalLight];

		this.shadowPass = new DirectionalShadowPass(this.sceneDirectionalLight);
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
		this.rootTransform.addChild(a);
		a.setPositionY(2).updateWorldMatrix();
		a.load().then(() => {
			a.setIsReflective(false);
			a.setMaterial(MaterialCache.defaultTexturedDeferredMaterial);
			a.setMaterial(MaterialCache.defaultShadowMaterial, RenderPassType.Shadow);
		});

		// const mipTex = TextureLoader.generateMipsFor2DTexture(
		// 	TextureLoader.dummyTexture,
		// 	"dummy tex mipmapped",
		// );
		// console.log({ mipTex });
	}

	public resize(w: number, h: number) {
		this.mainCamera.onResize(w, h);
		this.orthoCamera.onResize(w, h);

		if (!this.gbufferRenderPass) {
			this.gbufferRenderPass = new GBufferRenderPass();
			this.gbufferRenderPass.setCamera(this.mainCamera);
		}
		this.gbufferRenderPass.onResize(w, h);
		if (!this.gbufferIntegratePass) {
			this.gbufferIntegratePass = new GBufferIntegratePass(
				this.gbufferRenderPass.normalMetallicRoughnessTextureView,
				this.gbufferRenderPass.colorReflectanceTextureView,
				this.gbufferRenderPass.depthTextureView,
				this.gbufferRenderPass.depthStencilTextureView,
				this.shadowPass.shadowTextureViewCascadesAll,
				this.shadowPass.shadowCascadesBuffer,
			);
			this.gbufferIntegratePass.setCamera(this.mainCamera);
			this.gbufferIntegratePass.skybox = this.skybox;
		}
		this.gbufferIntegratePass.setLights(this.lights);
		this.gbufferIntegratePass.setCamera(this.mainCamera);
		this.gbufferIntegratePass.onResize(w, h);

		if (!this.taaResolvePass) {
			this.taaResolvePass = new TAAResolvePass(
				this.gbufferIntegratePass.outTextureView,
				this.gbufferRenderPass.velocityTextureView,
			);
		}
		this.taaResolvePass.onResize(w, h);

		if (!this.reflectionComputePass) {
			this.reflectionComputePass = new ReflectionComputePass();
		}
		this.reflectionComputePass.onResize(w, h);

		this.debugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Albedo,
			this.gbufferRenderPass.colorReflectanceTexture,
		);
		this.debugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Normal,
			this.gbufferRenderPass.normalMetallicRoughnessTexture,
		);
		this.debugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Metallic,
			this.gbufferRenderPass.normalMetallicRoughnessTexture,
		);
		this.debugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Roughness,
			this.gbufferRenderPass.normalMetallicRoughnessTexture,
		);
		this.debugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Reflectance,
			this.gbufferRenderPass.colorReflectanceTexture,
		);
		this.debugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Depth,
			this.gbufferRenderPass.depthStencilTexture,
		);
		this.debugContainer.gbufferDebugSection.setTextureFor(
			TextureDebugMeshType.Velocity,
			this.gbufferRenderPass.velocityTexture,
		);
		this.debugContainer.shadowDebugSection.setTextureFor(
			TextureDebugMeshType.ShadowDepthCascade0,
			this.shadowPass.shadowTexture,
		);
		this.debugContainer.shadowDebugSection.setTextureFor(
			TextureDebugMeshType.ShadowDepthCascade1,
			this.shadowPass.shadowTexture,
		);
	}

	public renderFrame(elapsedTime: number) {
		const now = (elapsedTime - Renderer.elapsedTimeMs) * 0.001;
		const deltaDiff = now - Renderer.prevTimeMs;
		Renderer.prevTimeMs = now;
		Renderer.elapsedTimeMs += this.enableAnimation ? deltaDiff : 0;

		const device = Renderer.device;

		this.gbufferIntegratePass.debugPointLights = this.debugPointLights;
		this.gbufferIntegratePass.setLights(this.lights);

		if (this.autoRotateSun) {
			this.rotateAngle += deltaDiff * 0.1;
			// this.sceneDirectionalLight.setPosition(
			// 	Math.cos(this.rotateAngle) * 3,
			// 	this.sceneDirectionalLight.position[1],
			// 	Math.sin(this.rotateAngle) * 3,
			// );
		}

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

		const commandEncoder = device.createCommandEncoder({
			label: "Render Loop Command Encoder",
		});

		// this.environmentProbePass.render(commandEncoder, this.skybox);
		this.shadowPass.render(commandEncoder, this.rootTransform);
		this.gbufferRenderPass.render(commandEncoder, this.rootTransform);
		this.gbufferIntegratePass.render(commandEncoder);
		if (this.enableTAA) {
			this.taaResolvePass.render(commandEncoder);
		}
		this.reflectionComputePass.computeReflections(
			commandEncoder,
			Renderer.canvasContext.getCurrentTexture(),
			this.enableTAA
				? this.taaResolvePass.outTextureView
				: this.gbufferIntegratePass.outTextureView,
		);

		const hudRenderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: Renderer.canvasContext.getCurrentTexture().createView(),
				loadOp: "load",
				storeOp: "store",
			},
		];

		this.debugContainer.render(commandEncoder);

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
			BIND_GROUP_LOCATIONS.Camera,
			this.orthoCameraBindGroup,
		);

		// this.bdrfLUTDebugTex?.render(hudRenderEncoder);

		hudRenderEncoder.popDebugGroup();
		hudRenderEncoder.end();

		device.queue.submit([commandEncoder.finish()]);

		this.mainCamera.onFrameEnd();
		this.orthoCamera.onFrameEnd();
	}
}
