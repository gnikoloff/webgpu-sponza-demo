import CameraController from "../renderer/camera/CameraController";
import PerspectiveCamera from "../renderer/camera/PerspectiveCamera";
import {
	BIND_GROUP_LOCATIONS,
	MAIN_CAMERA_FAR,
	MAIN_CAMERA_NEAR,
	ORTHO_CAMERA_FAR,
	ORTHO_CAMERA_NEAR,
} from "./constants";
import Drawable from "../renderer/scene/Drawable";
import PipelineStates from "../renderer/core/PipelineStates";
import OrthographicCamera from "../renderer/camera/OrthographicCamera";
import TextureDebugMesh, {
	TextureDebugMeshType,
} from "./meshes/debug/TextureDebugMesh";
import GBufferRenderPass from "./render-passes/GBufferRenderPass";
import GBufferIntegratePass from "./render-passes/GBufferIntegratePass";
import GroundContainer from "./meshes/ground/GroundContainer";
import CubeGeometry from "../renderer/geometry/CubeGeometry";
import MaterialCache from "./utils/MaterialCache";
import Transform from "../renderer/scene/Transform";
import ReflectionComputePass from "./render-passes/ReflectionComputePass";
import BlitPass from "./render-passes/BlitPass";
import SphereGeometry from "../renderer/geometry/SphereGeometry";

export default class Renderer {
	public static $canvas: HTMLCanvasElement;
	public static canvasContext: GPUCanvasContext;
	public static device: GPUDevice;

	public static pixelFormat: GPUTextureFormat;
	public static readonly depthFormat: GPUTextureFormat = "depth32float";

	public orthoCamera: OrthographicCamera;
	public mainCamera: PerspectiveCamera;
	public mainCameraCtrl: CameraController;

	private rootTransform = new Transform();
	private ground: GroundContainer;
	private cube: Drawable;
	private sphere: Drawable;

	private debugNormalTextureMesh?: TextureDebugMesh;
	private debugReflectanceTextureMesh?: TextureDebugMesh;
	private debugColorTextureMesh?: TextureDebugMesh;
	private debugDepthTextureMesh?: TextureDebugMesh;

	private gbufferRenderPass: GBufferRenderPass;
	private gbufferIntegratePass: GBufferIntegratePass;
	private reflectionComputePass: ReflectionComputePass;
	private blitRenderPass: BlitPass;

	private orthoCameraBindGroup: GPUBindGroup;

	public static initialize = async (
		canvas: HTMLCanvasElement,
	): Promise<Renderer> => {
		const adapter = await navigator.gpu.requestAdapter();

		Renderer.$canvas = canvas;
		Renderer.canvasContext = canvas.getContext("webgpu") as GPUCanvasContext;

		Renderer.pixelFormat = adapter.features.has("bgra8unorm-storage")
			? navigator.gpu.getPreferredCanvasFormat()
			: "rgba8unorm";

		const bgra8UnormStorageFeature: GPUFeatureName = "bgra8unorm-storage";
		Renderer.device = await adapter.requestDevice({
			requiredFeatures:
				Renderer.pixelFormat === "bgra8unorm" ? [bgra8UnormStorageFeature] : [],
		});

		Renderer.canvasContext.configure({
			device: Renderer.device,
			format: Renderer.pixelFormat,
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
		});

		return new Renderer();
	};

	constructor() {
		this.mainCamera = new PerspectiveCamera(
			45,
			1,
			MAIN_CAMERA_NEAR,
			MAIN_CAMERA_FAR,
		);
		this.mainCamera.setPosition(0, 2, 4);
		this.mainCamera.setLookAt(0, 0, 0);
		this.mainCamera.updateViewMatrix();
		this.mainCameraCtrl = new CameraController(
			this.mainCamera,
			Renderer.$canvas,
			true,
		);
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

		this.rootTransform.updateWorldMatrix();

		this.ground = new GroundContainer();
		this.rootTransform.addChild(this.ground);

		this.cube = new Drawable(new CubeGeometry(1, 1, 1));
		this.cube.material = MaterialCache.defaultDeferredMaterial;
		this.cube.materialProps.isReflective = false;
		this.cube.materialProps.baseColor[1] = 1;

		this.sphere = new Drawable(new SphereGeometry());
		this.sphere.material = MaterialCache.defaultDeferredMaterial;
		this.sphere.materialProps.baseColor[0] = 1;
		// this.sphere.materialProps.isReflective = false;
		this.sphere
			.setScale(0.5, 0.5, 0.5)
			.setPositionX(2)
			.setPositionZ(1.2)
			.updateWorldMatrix();

		this.rootTransform.addChild(this.cube);
		this.rootTransform.addChild(this.sphere);
	}

	public resize(w: number, h: number) {
		const aspect = w / h;
		this.mainCamera.aspect = aspect;
		this.mainCamera.updateProjectionMatrix();

		this.orthoCamera.left = 0;
		this.orthoCamera.right = w;
		this.orthoCamera.top = h;
		this.orthoCamera.bottom = 0;
		this.orthoCamera.updateProjectionMatrix();

		const debugMeshWidth = w * 0.2;
		const debugMeshHeight = h * 0.2;

		if (!this.gbufferRenderPass) {
			this.gbufferRenderPass = new GBufferRenderPass();
			this.gbufferRenderPass.setCamera(this.mainCamera);
		}
		this.gbufferRenderPass.resize(w, h);
		if (!this.gbufferIntegratePass) {
			this.gbufferIntegratePass = new GBufferIntegratePass(
				this.gbufferRenderPass.normalReflectanceTextureView,
				this.gbufferRenderPass.colorTextureView,
			);
		}
		this.gbufferIntegratePass.resize(w, h);

		if (!this.reflectionComputePass) {
			this.reflectionComputePass = new ReflectionComputePass(
				this.gbufferIntegratePass.outTexture,
			);
		}
		this.reflectionComputePass.resize(w, h);

		if (!this.blitRenderPass) {
			this.blitRenderPass = new BlitPass(this.reflectionComputePass.texture);
		}

		this.debugReflectanceTextureMesh = new TextureDebugMesh(
			TextureDebugMeshType.Reflectance,
			this.gbufferRenderPass.normalReflectanceTextureView,
		);

		this.debugNormalTextureMesh = new TextureDebugMesh(
			TextureDebugMeshType.Normal,
			this.gbufferRenderPass.normalReflectanceTextureView,
		);

		this.debugColorTextureMesh = new TextureDebugMesh(
			TextureDebugMeshType.Albedo,
			this.gbufferRenderPass.colorTextureView,
		);

		this.debugDepthTextureMesh = new TextureDebugMesh(
			TextureDebugMeshType.Depth,
			this.gbufferRenderPass.depthTextureView,
		);

		var offsetX = debugMeshWidth * 0.5 + 10;

		this.debugNormalTextureMesh
			.setPosition(offsetX, debugMeshHeight * 0.5 + 10, 0)
			.setScale(debugMeshWidth, debugMeshHeight, 1)
			.updateWorldMatrix();

		offsetX += debugMeshWidth;

		this.debugReflectanceTextureMesh
			.setPosition(offsetX, debugMeshHeight * 0.5 + 10, 0)
			.setScale(debugMeshWidth, debugMeshHeight, 1)
			.updateWorldMatrix();

		offsetX += debugMeshWidth;

		this.debugColorTextureMesh
			.setPosition(offsetX, debugMeshHeight * 0.5 + 10, 0)
			.setScale(debugMeshWidth, debugMeshHeight, 1)
			.updateWorldMatrix();

		offsetX += debugMeshWidth;

		this.debugDepthTextureMesh
			.setPosition(offsetX, debugMeshHeight * 0.5 + 10, 0)
			.setScale(debugMeshWidth, debugMeshHeight, 1)
			.updateWorldMatrix();
	}

	public renderFrame(elapsedTime: number, deltaTime: number) {
		const device = Renderer.device;

		const x = Math.cos(elapsedTime) * 1;
		const y = Math.sin(elapsedTime) * 1;

		// console.log({ x, y });

		this.mainCamera.update();
		this.orthoCamera.update();

		this.cube.setPositionY(0.5).setRotationY(elapsedTime).updateWorldMatrix();

		const commandEncoder = device.createCommandEncoder();
		const textureView = Renderer.canvasContext.getCurrentTexture().createView();

		this.gbufferRenderPass.render(commandEncoder, this.rootTransform);
		// this.gbufferIntegratePass.outOutTextureView = textureView;
		this.gbufferIntegratePass.render(commandEncoder);

		this.reflectionComputePass.computeReflections(commandEncoder, textureView);

		// this.blitRenderPass.renderFrame(commandEncoder, textureView);

		const hudRenderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: textureView,
				loadOp: "load",
				storeOp: "store",
			},
		];

		const hudRenderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: hudRenderPassColorAttachments,
			depthStencilAttachment: undefined,
			label: "HUD Render Pass",
		};
		const hudRenderEncoder = commandEncoder.beginRenderPass(
			hudRenderPassDescriptor,
		);

		hudRenderEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.Camera,
			this.orthoCameraBindGroup,
		);

		this.debugNormalTextureMesh?.render(hudRenderEncoder);
		this.debugColorTextureMesh?.render(hudRenderEncoder);
		this.debugReflectanceTextureMesh?.render(hudRenderEncoder);
		this.debugDepthTextureMesh?.render(hudRenderEncoder);

		hudRenderEncoder.end();

		device.queue.submit([commandEncoder.finish()]);
	}
}
