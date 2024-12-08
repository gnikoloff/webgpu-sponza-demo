import {
	StructuredView,
	makeShaderDataDefinitions,
	makeStructuredView,
} from "webgpu-utils";
import { Mat4, mat4, vec3, vec4 } from "wgpu-matrix";
import Camera from "../../renderer/camera/Camera";
import RenderPass, { RenderPassType } from "../../renderer/core/RenderPass";
import Transform from "../../renderer/scene/Transform";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";
import Renderer from "../Renderer";
import PipelineStates from "../../renderer/core/PipelineStates";

import DirectionalLight from "../../renderer/lighting/DirectionalLight";
import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import Scene from "../../renderer/scene/Scene";

export default class DirectionalShadowPass extends RenderPass {
	public static readonly TEXTURE_SIZE = 2048;
	public static readonly TEXTURE_CASCADES_COUNT = 2;
	public static readonly TEXTURE_CASCADE_FAR_DISTANCES: number[] = [6, 22, 200];

	public shadowTexture: GPUTexture;
	public shadowTextureViewCascade0: GPUTextureView;
	public shadowTextureViewCascade1: GPUTextureView;
	public shadowTextureViewCascadesAll: GPUTextureView;

	public shadowCascadesBuffer: GPUBuffer;
	private shadowCascadeView: StructuredView;

	private shadowCameraCascade0GPUBuffer: GPUBuffer;
	private shadowCameraCascade1GPUBuffer: GPUBuffer;

	private shadowCameraCascade0BindGroup: GPUBindGroup;
	private shadowCameraCascade1BindGroup: GPUBindGroup;

	private shadowCameraCascade0BufferUniformValues: StructuredView;
	private shadowCameraCascade1BufferUniformValues: StructuredView;

	constructor(scene: Scene, private sceneDirectionalLight: DirectionalLight) {
		super(RenderPassType.Shadow, scene);
		this.type = RenderPassType.Shadow;

		this.shadowTexture = Renderer.device.createTexture({
			dimension: "2d",
			format: "depth32float",
			size: {
				width: DirectionalShadowPass.TEXTURE_SIZE,
				height: DirectionalShadowPass.TEXTURE_SIZE,
				depthOrArrayLayers: DirectionalShadowPass.TEXTURE_CASCADES_COUNT,
			},
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			mipLevelCount: 1,

			sampleCount: 1,
			label: "Shadow Map Texture",
		});
		this.shadowTextureViewCascade0 = this.shadowTexture.createView({
			baseArrayLayer: 0,
			arrayLayerCount: 1,
			dimension: "2d",
		});
		this.shadowTextureViewCascade1 = this.shadowTexture.createView({
			baseArrayLayer: 1,
			arrayLayerCount: 1,
			dimension: "2d",
		});
		this.shadowTextureViewCascadesAll = this.shadowTexture.createView();

		const cameraShaderDefs = makeShaderDataDefinitions(
			SHADER_CHUNKS.CameraUniform,
		);
		this.shadowCameraCascade0BufferUniformValues = makeStructuredView(
			cameraShaderDefs.structs.CameraUniform,
		);
		this.shadowCameraCascade1BufferUniformValues = makeStructuredView(
			cameraShaderDefs.structs.CameraUniform,
		);

		this.shadowCameraCascade0GPUBuffer = Renderer.device.createBuffer({
			label: "Shadow Camera GPU Buffer Cascade #0",
			size: this.shadowCameraCascade0BufferUniformValues.arrayBuffer.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.shadowCameraCascade1GPUBuffer = Renderer.device.createBuffer({
			label: "Shadow Camera GPU Buffer Cascade #1",
			size: this.shadowCameraCascade1BufferUniformValues.arrayBuffer.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.shadowCameraCascade0BindGroup = Renderer.device.createBindGroup({
			label: "Shadow Camera Bind Group Cascade #0",
			layout: PipelineStates.defaultCameraBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.shadowCameraCascade0GPUBuffer,
					},
				},
			],
		});

		this.shadowCameraCascade1BindGroup = Renderer.device.createBindGroup({
			label: "Shadow Camera Bind Group Cascade #1",
			layout: PipelineStates.defaultCameraBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.shadowCameraCascade1GPUBuffer,
					},
				},
			],
		});

		const lightCascadeShaderDefs = makeShaderDataDefinitions(
			SHADER_CHUNKS.ShadowCascade,
		);
		this.shadowCascadeView = makeStructuredView(
			lightCascadeShaderDefs.structs.ShadowCascade,
		);

		this.shadowCascadesBuffer = Renderer.device.createBuffer({
			label: "Directional Shadow Cascade ProjView Matrices",
			size:
				(DirectionalShadowPass.TEXTURE_CASCADES_COUNT + 1) *
				this.shadowCascadeView.arrayBuffer.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
	}

	public override setCamera(camera: Camera): void {
		this.camera = camera;
	}

	private getLightSpaceMatrix(): Mat4 {
		const frustumCorners = this.camera.frustumCornersWorldSpace;
		let center = vec3.create(0, 0, 0);
		for (let i = 0; i < frustumCorners.length; i++) {
			const corner = frustumCorners[i];
			vec3.add(center, corner, center);
		}
		vec3.divScalar(center, frustumCorners.length, center);

		let shadowCamPos = vec3.create();
		let lightPos = vec3.create();
		vec3.normalize(this.sceneDirectionalLight.position, lightPos);
		vec3.add(center, lightPos, shadowCamPos);

		// console.log("------");
		// console.log(shadowCamPos);
		// console.log(center);

		let viewMatrix = mat4.create();
		mat4.lookAt(shadowCamPos, center, Camera.UP_VECTOR, viewMatrix);

		let minX = Number.MAX_VALUE;
		let maxX = -minX;
		let minY = Number.MAX_VALUE;
		let maxY = -minY;
		let minZ = Number.MAX_VALUE;
		let maxZ = -minZ;

		for (let i = 0; i < frustumCorners.length; i++) {
			const corner = frustumCorners[i];
			const trf = vec4.create();
			vec3.transformMat4(corner, viewMatrix, trf);
			minX = Math.min(minX, trf[0]);
			maxX = Math.max(maxX, trf[0]);
			minY = Math.min(minY, trf[1]);
			maxY = Math.max(maxY, trf[1]);
			minZ = Math.min(minZ, trf[2]);
			maxZ = Math.max(maxZ, trf[2]);
		}

		let zMult = 10;
		if (minZ < 0) {
			minZ *= zMult;
		} else {
			minZ /= zMult;
		}

		if (maxZ < 0) {
			maxZ /= zMult;
		} else {
			maxZ *= zMult;
		}
		// console.log({ minZ, maxZ });

		const projectionMatrix = mat4.create();
		mat4.ortho(minX, maxX, minY, maxY, minZ, maxZ, projectionMatrix);

		const outMatrix = mat4.create();
		mat4.mul(projectionMatrix, viewMatrix, outMatrix);

		return outMatrix;
	}

	public render(commandEncoder: GPUCommandEncoder): void {
		Renderer.activeRenderPass = this.type;

		const oldCameraNear = this.camera.near;
		const oldCameraFar = this.camera.far;

		// Render Cascade #0
		this.camera.near = 0.1;
		this.camera.far = DirectionalShadowPass.TEXTURE_CASCADE_FAR_DISTANCES[0];
		this.camera.updateProjectionMatrix();
		const lightSpaceMatCascade0 = this.getLightSpaceMatrix();
		this.shadowCascadeView.set({
			projViewMatrix: lightSpaceMatCascade0,
			distance: this.camera.far,
		});
		Renderer.device.queue.writeBuffer(
			this.shadowCascadesBuffer,
			0,
			this.shadowCascadeView.arrayBuffer,
		);
		this.shadowCameraCascade0BufferUniformValues.set({
			projectionViewMatrix: lightSpaceMatCascade0,
		});

		Renderer.device.queue.writeBuffer(
			this.shadowCameraCascade0GPUBuffer,
			0,
			this.shadowCameraCascade0BufferUniformValues.arrayBuffer,
		);

		const renderPassDescriptorCascade0: GPURenderPassDescriptor = {
			colorAttachments: [],
			depthStencilAttachment: {
				view: this.shadowTextureViewCascade0,
				depthClearValue: 1,
				depthLoadOp: "clear",
				depthStoreOp: "store",
			},
			label: "Shadow Render Pass Cascade #0",
		};
		const renderPassEncoderCascade0 = commandEncoder.beginRenderPass(
			renderPassDescriptorCascade0,
		);

		renderPassEncoderCascade0.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.shadowCameraCascade0BindGroup,
		);
		renderPassEncoderCascade0.pushDebugGroup("Render Shadow Cascade #0");

		this.scene.renderOpaqueNodes(renderPassEncoderCascade0);
		this.scene.renderTransparentNodes(renderPassEncoderCascade0);

		renderPassEncoderCascade0.popDebugGroup();
		renderPassEncoderCascade0.end();

		// Render Cascade #1

		this.camera.near = DirectionalShadowPass.TEXTURE_CASCADE_FAR_DISTANCES[0];
		this.camera.far = DirectionalShadowPass.TEXTURE_CASCADE_FAR_DISTANCES[1];
		this.camera.updateProjectionMatrix();

		const lightSpaceMatCascade1 = this.getLightSpaceMatrix();
		this.shadowCascadeView.set({
			projViewMatrix: lightSpaceMatCascade1,
			distance: this.camera.far,
		});
		Renderer.device.queue.writeBuffer(
			this.shadowCascadesBuffer,
			this.shadowCascadeView.arrayBuffer.byteLength * 1,
			this.shadowCascadeView.arrayBuffer,
		);
		this.shadowCameraCascade1BufferUniformValues.set({
			projectionViewMatrix: lightSpaceMatCascade1,
		});

		Renderer.device.queue.writeBuffer(
			this.shadowCameraCascade1GPUBuffer,
			0,
			this.shadowCameraCascade1BufferUniformValues.arrayBuffer,
		);

		const renderPassDescriptorCascade1: GPURenderPassDescriptor = {
			colorAttachments: [],
			depthStencilAttachment: {
				view: this.shadowTextureViewCascade1,
				depthClearValue: 1,
				depthLoadOp: "clear",
				depthStoreOp: "store",
			},
			label: "Shadow Render Pass Cascade #1",
		};
		const renderPassEncoderCascade1 = commandEncoder.beginRenderPass(
			renderPassDescriptorCascade1,
		);
		renderPassEncoderCascade1.pushDebugGroup("Render Shadow Cascade #1");

		renderPassEncoderCascade1.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.shadowCameraCascade1BindGroup,
		);

		this.scene.renderOpaqueNodes(renderPassEncoderCascade1);
		this.scene.renderTransparentNodes(renderPassEncoderCascade1);

		renderPassEncoderCascade1.popDebugGroup();
		renderPassEncoderCascade1.end();

		this.camera.near = DirectionalShadowPass.TEXTURE_CASCADE_FAR_DISTANCES[1];
		this.camera.far = DirectionalShadowPass.TEXTURE_CASCADE_FAR_DISTANCES[2];
		this.camera.updateProjectionMatrix();
		const lightSpaceMatCascade2 = this.getLightSpaceMatrix();

		this.shadowCascadeView.set({
			projViewMatrix: lightSpaceMatCascade2,
			distance: this.camera.far,
		});
		Renderer.device.queue.writeBuffer(
			this.shadowCascadesBuffer,
			this.shadowCascadeView.arrayBuffer.byteLength * 2,
			this.shadowCascadeView.arrayBuffer,
		);

		// Reset camera properties
		this.camera.near = oldCameraNear;
		this.camera.far = oldCameraFar;
		this.camera.updateProjectionMatrix();
	}
}
