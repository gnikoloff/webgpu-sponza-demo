import { Mat4, mat4, vec3 } from "wgpu-matrix";
import PerspectiveCamera from "../../renderer/camera/PerspectiveCamera";
import RenderPass from "../../renderer/core/RenderPass";
import Transform from "../../renderer/scene/Transform";

import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import {
	SKYBOX_CUBEMAP_CAMERA_LOOK_ATS,
	SKYBOX_CUBEMAP_CAMERA_UPS,
} from "../../renderer/math/math";
import { RenderPassType } from "../../renderer/types";
import RenderingContext from "../../renderer/core/RenderingContext";
import VRAMUsageTracker from "../../renderer/misc/VRAMUsageTracker";

export default class EnvironmentProbePass extends RenderPass {
	private static readonly ENVIRONMENT_TEXTURE_SIZE = 512;

	public cubeTexture: GPUTexture;

	private cameraViewProjMatrixBuffer: GPUBuffer;
	private cameraCurrentFaceRenderBuffer: GPUBuffer;
	private cameraViewProjectionMatrix: Mat4[] = [];

	public setPosition(x: number, y: number, z: number) {
		this.camera.setPosition(x, y, z);
		for (let i = 0; i < 6; i++) {
			const lookAt = vec3.add(
				this.camera.position,
				SKYBOX_CUBEMAP_CAMERA_LOOK_ATS[i],
			);
			const viewMatrix = mat4.lookAt(
				this.camera.position,
				lookAt,
				SKYBOX_CUBEMAP_CAMERA_UPS[i],
			);
			const projViewMatrix = mat4.mul(this.camera.projectionMatrix, viewMatrix);
			mat4.copy(projViewMatrix, this.cameraViewProjectionMatrix[i]);

			RenderingContext.device.queue.writeBuffer(
				this.cameraViewProjMatrixBuffer,
				i * 16 * Float32Array.BYTES_PER_ELEMENT,
				this.cameraViewProjectionMatrix[i],
			);
		}
	}

	constructor() {
		super();
		this.type = RenderPassType.EnvironmentCube;

		this.cubeTexture = RenderingContext.device.createTexture({
			label: "Environment Cube Texture",
			dimension: "2d",
			size: {
				width: EnvironmentProbePass.ENVIRONMENT_TEXTURE_SIZE,
				height: EnvironmentProbePass.ENVIRONMENT_TEXTURE_SIZE,
				depthOrArrayLayers: 6,
			},
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			format: "rgba8unorm",
		});

		this.camera = new PerspectiveCamera(Math.PI * 0.5, 1, 0.1, 10);
		this.camera.updateProjectionMatrix();
		this.camera.setPosition(0, 0, 0);

		for (let i = 0; i < 6; i++) {
			this.cameraViewProjectionMatrix.push(mat4.identity());
		}

		this.cameraViewProjMatrixBuffer = RenderingContext.device.createBuffer({
			label: "Environment Probe Camera ProjView Matrix Buffer",
			size: 16 * 6 * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
		});

		VRAMUsageTracker.addBufferBytes(this.cameraViewProjMatrixBuffer);

		this.cameraCurrentFaceRenderBuffer = RenderingContext.device.createBuffer({
			label: "Environment Probe Camera Current Face Index Buffer",
			size: Uint32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
		});

		VRAMUsageTracker.addBufferBytes(this.cameraCurrentFaceRenderBuffer);

		const cameraBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				buffer: {
					type: "read-only-storage",
				},
				visibility: GPUShaderStage.VERTEX,
			},
			{
				binding: 1,
				buffer: {
					type: "uniform",
				},
				visibility: GPUShaderStage.VERTEX,
			},
		];
		const cameraBindGroupLayout = RenderingContext.device.createBindGroupLayout(
			{
				label: "Environment Probe Camera Bind Group Layout",
				entries: cameraBindGroupLayoutEntries,
			},
		);

		const cameraBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: {
					buffer: this.cameraViewProjMatrixBuffer,
				},
			},
			{
				binding: 1,
				resource: {
					buffer: this.cameraCurrentFaceRenderBuffer,
				},
			},
		];
		this.cameraBindGroup = RenderingContext.device.createBindGroup({
			label: "Environment Probe Camera Bind Group",
			layout: cameraBindGroupLayout,
			entries: cameraBindGroupEntries,
		});
	}

	public override render(commandEncoder: GPUCommandEncoder, scene: Transform) {
		// RenderingContext.activeRenderPass = this.type;

		const colorAttachments: GPURenderPassColorAttachment[] = [
			{
				loadOp: "load",
				storeOp: "store",
				view: null,
			},
		];

		for (let i = 0; i < 6; i++) {
			colorAttachments[0].view = this.cubeTexture.createView({
				dimension: "2d",
				baseArrayLayer: i,
				arrayLayerCount: 1,
			});

			const renderPassDescriptor: GPURenderPassDescriptor = {
				label: `Draw Face ${i} Render Pass`,
				colorAttachments,
			};

			RenderingContext.device.queue.writeBuffer(
				this.cameraCurrentFaceRenderBuffer,
				0,
				new Uint32Array([i]),
			);

			const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);

			renderPass.setBindGroup(
				BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
				this.cameraBindGroup,
			);

			scene.render(renderPass);

			renderPass.end();
		}
	}
}
