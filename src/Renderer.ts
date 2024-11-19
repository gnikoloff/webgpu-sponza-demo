import CameraController from "./camera/CameraController";
import PerspectiveCamera from "./camera/PerspectiveCamera";
import {
	BIND_GROUP_LOCATIONS,
	MAIN_CAMERA_FAR,
	MAIN_CAMERA_NEAR,
} from "./constants";
import Drawable from "./core/Drawable";
import { PipelineStates } from "./core/PipelineStates";
import PlaneGeometry from "./geometry/PlaneGeometry";
import { Material } from "./material/Material";
import { SHADER_CHUNKS } from "./shaders/chunks";

export class Renderer {
	public static $canvas: HTMLCanvasElement;
	public static canvasContext: GPUCanvasContext;
	public static device: GPUDevice;

	public static pixelFormat: GPUTextureFormat;
	public static readonly depthFormat: GPUTextureFormat = "depth32float";

	public mainCamera: PerspectiveCamera;
	public mainCameraCtrl: CameraController;

	private drawable: Drawable;

	private depthTexture: GPUTexture;
	private depthTextureView: GPUTextureView;

	private cameraBindGroup: GPUBindGroup;

	public static initialize = async (
		canvas: HTMLCanvasElement,
	): Promise<Renderer> => {
		const adapter = await navigator.gpu.requestAdapter();

		Renderer.$canvas = canvas;
		Renderer.canvasContext = canvas.getContext("webgpu") as GPUCanvasContext;
		Renderer.device = await adapter.requestDevice({
			requiredLimits: {},
		});

		Renderer.pixelFormat = navigator.gpu.getPreferredCanvasFormat();
		Renderer.canvasContext.configure({
			device: Renderer.device,
			format: Renderer.pixelFormat,
		});

		return new Renderer();
	};

	constructor() {
		this.mainCamera = new PerspectiveCamera(
			70,
			1,
			MAIN_CAMERA_NEAR,
			MAIN_CAMERA_FAR,
		);
		this.mainCamera.setPosition(0, 0, 2);
		this.mainCamera.setLookAt(0, 0, 0);
		this.mainCamera.updateViewMatrix();
		this.mainCameraCtrl = new CameraController(
			this.mainCamera,
			Renderer.$canvas,
			true,
		);
		this.mainCameraCtrl.startTick();

		this.cameraBindGroup = Renderer.device.createBindGroup({
			label: "Main Camera Bind Group",
			layout: PipelineStates.defaultCameraBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.mainCamera.gpuBuffer,
					},
				},
			],
		});
		const material = new Material({
			debugLabel: "Material",
			vertexShaderSrc: /* wgsl */ `
        ${SHADER_CHUNKS.VertexInput}
        ${SHADER_CHUNKS.VertexOutput}
        ${SHADER_CHUNKS.ModelUniform}
        ${SHADER_CHUNKS.CameraUniform}

        @group(${BIND_GROUP_LOCATIONS.Camera}) @binding(0) var<uniform> camera: CameraUniform;
        @group(${BIND_GROUP_LOCATIONS.Model}) @binding(0) var<uniform> model: ModelUniform;
        
        @vertex
        fn vertexMain(in: VertexInput) -> VertexOutput {
          var out: VertexOutput;
          out.position = camera.projectionMatrix * camera.viewMatrix * in.position;
          out.uv = in.uv;
          return out;
        }
      `,
			vertexShaderEntryFn: "vertexMain",
			fragmentShaderSrc: /* wgsl */ `
        ${SHADER_CHUNKS.VertexOutput}

        @fragment
        fn fragmentMain(in: VertexOutput) -> @location(0) vec4<f32>  {
          // return vec4<f32>(in.uv, 0.0, 1.0);
          return vec4<f32>(1.0, 0.0, 0.0, 1.0);
        }
      `,
			fragmentShaderEntryFn: "fragmentMain",
			targets: [
				{
					format: Renderer.pixelFormat,
				},
			],
		});

		const geometry = new PlaneGeometry();
		const drawable = new Drawable(geometry);
		drawable.material = material;
		this.drawable = drawable;
	}

	public resize(w: number, h: number) {
		if (this.depthTexture) {
			this.depthTexture.destroy();
		}
		this.depthTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: Renderer.depthFormat,
			mipLevelCount: 1,
			sampleCount: 1,
			size: { width: w, height: h, depthOrArrayLayers: 1 },
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
			label: "Depth Texture",
		});
		this.depthTextureView = this.depthTexture.createView();

		this.mainCamera.aspect = w / h;
		this.mainCamera.updateProjectionMatrix();
	}

	public renderFrame(elapsedTime: number, deltaTime: number) {
		const device = Renderer.device;

		// const x = Math.cos(elapsedTime) * 0.0025;
		// const y = Math.sin(elapsedTime) * 0.0025;

		// this.drawable.setPositionX(x).setPositionY(y);
		// this.drawable.updateWorldMatrix();

		this.mainCamera.update();

		const commandEncoder = device.createCommandEncoder();
		const textureView = Renderer.canvasContext.getCurrentTexture().createView();

		const colorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: textureView,
				loadOp: "clear",
				clearValue: [0, 0, 0, 1],
				storeOp: "store",
			},
		];

		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments,
			depthStencilAttachment: {
				view: this.depthTextureView,
				depthLoadOp: "clear",
				depthStoreOp: "store",
				depthClearValue: 0,
			},
			label: "Main Render Pass",
		};
		const renderEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

		// renderEncoder.setVertexBuffer(
		// 	BIND_GROUP_LOCATIONS.Camera,
		// 	this.mainCamera.gpuBuffer,
		// );

		renderEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.Camera,
			this.cameraBindGroup,
		);

		this.drawable.render(renderEncoder);

		renderEncoder.end();
		device.queue.submit([commandEncoder.finish()]);
	}
}
