import {
	StructuredView,
	makeShaderDataDefinitions,
	makeStructuredView,
} from "webgpu-utils";
import { Mat4, mat4, vec3, vec4 } from "wgpu-matrix";
import Camera from "../../renderer/camera/Camera";
import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import { SHADER_CHUNKS } from "../../renderer/shader/chunks";

import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import RenderingContext from "../../renderer/core/RenderingContext";
import DirectionalLight from "../../renderer/lighting/DirectionalLight";
import VRAMUsageTracker from "../../renderer/misc/VRAMUsageTracker";
import Scene from "../../renderer/scene/Scene";
import { RenderPassType } from "../../renderer/types";

export default class DirectionalShadowRenderPass extends RenderPass {
	public static readonly TEXTURE_SIZE = 4098;
	public static readonly TEXTURE_CASCADES_COUNT = 2;
	public static readonly TEXTURE_CASCADE_FAR_DISTANCES: number[] = [6, 17, 200];

	private shadowTextureCascade0: GPUTextureView;
	private shadowTextureCascade1: GPUTextureView;

	public shadowCascadesBuffer: GPUBuffer;
	private shadowCascadeView: StructuredView;

	private shadowCameraCascade0GPUBuffer: GPUBuffer;
	private shadowCameraCascade1GPUBuffer: GPUBuffer;

	private shadowCameraCascade0BindGroup: GPUBindGroup;
	private shadowCameraCascade1BindGroup: GPUBindGroup;

	private shadowCameraCascade0BufferUniformValues: StructuredView;
	private shadowCameraCascade1BufferUniformValues: StructuredView;

	public set shadowMapSize(v: number) {
		const oldTexture = this.outTextures[0];
		this.outTextures[0] = RenderingContext.device.createTexture({
			label: "Directional Shadow Depth Texture",
			format: "depth32float",
			size: {
				width: v,
				height: v,
				depthOrArrayLayers: DirectionalShadowRenderPass.TEXTURE_CASCADES_COUNT,
			},
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		});

		this.shadowTextureCascade0 = this.outTextures[0].createView({
			baseArrayLayer: 0,
			arrayLayerCount: 1,
			dimension: "2d",
		});

		this.shadowTextureCascade1 = this.outTextures[0].createView({
			baseArrayLayer: 1,
			arrayLayerCount: 1,
			dimension: "2d",
		});

		VRAMUsageTracker.addTextureBytes(this.outTextures[0]);

		RenderingContext.device.queue.onSubmittedWorkDone().then(() => {
			VRAMUsageTracker.removeTextureBytes(oldTexture);
			oldTexture.destroy();
		});
	}

	public override destroy(): void {
		super.destroy();
		VRAMUsageTracker.removeBufferBytes(this.shadowCascadesBuffer);
		VRAMUsageTracker.removeBufferBytes(this.shadowCameraCascade0GPUBuffer);
		VRAMUsageTracker.removeBufferBytes(this.shadowCameraCascade1GPUBuffer);
		this.shadowCascadesBuffer.destroy();
		this.shadowCameraCascade0GPUBuffer.destroy();
		this.shadowCameraCascade1GPUBuffer.destroy();
	}

	constructor(
		private sceneDirectionalLight: DirectionalLight,
		width: number,
		height: number,
	) {
		super(RenderPassType.Shadow, width, height);
		this.type = RenderPassType.Shadow;

		this.renderPassDescriptor =
			this.augmentRenderPassDescriptorWithTimestampQuery({
				colorAttachments: [],
				depthStencilAttachment: {
					view: null,
					depthClearValue: 1,
					depthLoadOp: "clear",
					depthStoreOp: "store",
				},
				label: "Shadow Render Pass Cascade #0",
			});

		this.outTextures.push(
			RenderingContext.device.createTexture({
				label: "Directional Shadow Depth Texture",
				format: "depth32float",
				size: {
					width: DirectionalShadowRenderPass.TEXTURE_SIZE,
					height: DirectionalShadowRenderPass.TEXTURE_SIZE,
					depthOrArrayLayers:
						DirectionalShadowRenderPass.TEXTURE_CASCADES_COUNT,
				},
				usage:
					GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			}),
		);

		VRAMUsageTracker.addTextureBytes(this.outTextures[0]);

		this.shadowTextureCascade0 = this.outTextures[0].createView({
			baseArrayLayer: 0,
			arrayLayerCount: 1,
			dimension: "2d",
		});

		this.shadowTextureCascade1 = this.outTextures[0].createView({
			baseArrayLayer: 1,
			arrayLayerCount: 1,
			dimension: "2d",
		});

		const cameraShaderDefs = makeShaderDataDefinitions(SHADER_CHUNKS.Camera);
		this.shadowCameraCascade0BufferUniformValues = makeStructuredView(
			cameraShaderDefs.structs.Camera,
		);
		this.shadowCameraCascade1BufferUniformValues = makeStructuredView(
			cameraShaderDefs.structs.Camera,
		);

		this.shadowCameraCascade0GPUBuffer = RenderingContext.device.createBuffer({
			label: "Shadow Camera GPU Buffer Cascade #0",
			size: this.shadowCameraCascade0BufferUniformValues.arrayBuffer.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		VRAMUsageTracker.addBufferBytes(this.shadowCameraCascade0GPUBuffer);

		this.shadowCameraCascade1GPUBuffer = RenderingContext.device.createBuffer({
			label: "Shadow Camera GPU Buffer Cascade #1",
			size: this.shadowCameraCascade1BufferUniformValues.arrayBuffer.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		VRAMUsageTracker.addBufferBytes(this.shadowCameraCascade1GPUBuffer);

		this.shadowCameraCascade0BindGroup =
			RenderingContext.device.createBindGroup({
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

		this.shadowCameraCascade1BindGroup =
			RenderingContext.device.createBindGroup({
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

		this.shadowCascadesBuffer = RenderingContext.device.createBuffer({
			label: "Directional Shadow Cascade ProjView Matrices",
			size:
				DirectionalShadowRenderPass.TEXTURE_CASCADES_COUNT *
				this.shadowCascadeView.arrayBuffer.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		VRAMUsageTracker.addBufferBytes(this.shadowCascadesBuffer);
	}

	public override setCamera(camera: Camera): this {
		this.camera = camera;
		return this;
	}

	private getLightSpaceMatrix(): Mat4 {
		const frustumCorners = this.camera.frustumCornersWorldSpace;
		const center = vec3.create(0, 0, 0);
		for (let i = 0; i < frustumCorners.length; i++) {
			const corner = frustumCorners[i];
			vec3.add(center, corner, center);
		}
		vec3.divScalar(center, frustumCorners.length, center);

		const shadowCamPos = vec3.create();
		const lightPos = vec3.create();
		vec3.normalize(this.sceneDirectionalLight.position, lightPos);
		vec3.add(center, lightPos, shadowCamPos);

		const viewMatrix = mat4.create();
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

		// let zMult = 10;
		// if (minZ < 0) {
		// 	minZ *= zMult;
		// } else {
		// 	minZ /= zMult;
		// }

		// if (maxZ < 0) {
		// 	maxZ /= zMult;
		// } else {
		// 	maxZ *= zMult;
		// }

		const temp = -minZ;
		minZ = -maxZ;
		maxZ = temp;

		const mid = (maxZ - minZ) / 2;
		minZ -= mid * 5;
		maxZ += mid * 5;

		const projectionMatrix = mat4.create();
		mat4.ortho(minX, maxX, minY, maxY, minZ, maxZ, projectionMatrix);

		const outMatrix = mat4.create();
		mat4.mul(projectionMatrix, viewMatrix, outMatrix);

		return outMatrix;
	}

	public render(
		commandEncoder: GPUCommandEncoder,
		scene: Scene,
		_inputs: GPUTexture[],
	): GPUTexture[] {
		const oldCameraNear = this.camera.near;
		const oldCameraFar = this.camera.far;

		// Render Cascade #0
		this.camera.near = 0.1;
		this.camera.far =
			DirectionalShadowRenderPass.TEXTURE_CASCADE_FAR_DISTANCES[0];
		this.camera.updateProjectionMatrix();

		const lightSpaceMatCascade0 = this.getLightSpaceMatrix();

		this.shadowCascadeView.set({
			projViewMatrix: lightSpaceMatCascade0,
			distance: this.camera.far,
		});
		RenderingContext.device.queue.writeBuffer(
			this.shadowCascadesBuffer,
			0,
			this.shadowCascadeView.arrayBuffer,
		);
		this.shadowCameraCascade0BufferUniformValues.set({
			projectionViewMatrix: lightSpaceMatCascade0,
		});

		RenderingContext.device.queue.writeBuffer(
			this.shadowCameraCascade0GPUBuffer,
			0,
			this.shadowCameraCascade0BufferUniformValues.arrayBuffer,
		);

		this.renderPassDescriptor.depthStencilAttachment.view =
			this.shadowTextureCascade0;
		this.renderPassDescriptor.label = "Shadow Render Pass Cascade #0";

		const renderPassEncoderCascade0 = commandEncoder.beginRenderPass(
			this.renderPassDescriptor,
		);

		RenderingContext.setActiveRenderPass(this.type, renderPassEncoderCascade0);

		renderPassEncoderCascade0.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.shadowCameraCascade0BindGroup,
		);
		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPassEncoderCascade0.pushDebugGroup("Render Shadow Cascade #0");
		}

		scene.renderOpaqueNodes(renderPassEncoderCascade0);
		scene.renderTransparentNodes(renderPassEncoderCascade0);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPassEncoderCascade0.popDebugGroup();
		}
		renderPassEncoderCascade0.end();

		// Render Cascade #1
		this.camera.near =
			DirectionalShadowRenderPass.TEXTURE_CASCADE_FAR_DISTANCES[0];
		this.camera.far =
			DirectionalShadowRenderPass.TEXTURE_CASCADE_FAR_DISTANCES[1];
		this.camera.updateProjectionMatrix();

		const lightSpaceMatCascade1 = this.getLightSpaceMatrix();
		this.shadowCascadeView.set({
			projViewMatrix: lightSpaceMatCascade1,
			distance: this.camera.far,
		});
		RenderingContext.device.queue.writeBuffer(
			this.shadowCascadesBuffer,
			this.shadowCascadeView.arrayBuffer.byteLength * 1,
			this.shadowCascadeView.arrayBuffer,
		);
		this.shadowCameraCascade1BufferUniformValues.set({
			projectionViewMatrix: lightSpaceMatCascade1,
		});

		RenderingContext.device.queue.writeBuffer(
			this.shadowCameraCascade1GPUBuffer,
			0,
			this.shadowCameraCascade1BufferUniformValues.arrayBuffer,
		);

		this.renderPassDescriptor.depthStencilAttachment.view =
			this.shadowTextureCascade1;
		this.renderPassDescriptor.label = "Shadow Render Pass Cascade #1";

		const renderPassEncoderCascade1 = commandEncoder.beginRenderPass(
			this.renderPassDescriptor,
		);

		RenderingContext.setActiveRenderPass(this.type, renderPassEncoderCascade1);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPassEncoderCascade1.pushDebugGroup("Render Shadow Cascade #1");
		}

		renderPassEncoderCascade1.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.shadowCameraCascade1BindGroup,
		);

		scene.renderOpaqueNodes(renderPassEncoderCascade1);
		scene.renderTransparentNodes(renderPassEncoderCascade1);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPassEncoderCascade1.popDebugGroup();
		}
		renderPassEncoderCascade1.end();

		// Reset camera properties
		this.camera.near = oldCameraNear;
		this.camera.far = oldCameraFar;
		this.camera.updateProjectionMatrix();

		this.postRender(commandEncoder);

		return this.outTextures;
	}
}
