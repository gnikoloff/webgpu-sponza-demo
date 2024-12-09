import { mat4, vec3 } from "wgpu-matrix";
import {
	SKYBOX_CUBEMAP_CAMERA_LOOK_ATS,
	SKYBOX_CUBEMAP_CAMERA_UPS,
	numMipLevelsForSize,
} from "../math/math";
import HDRToCubeMapShaderUtils, {
	HDRToCubeMapShaderUtilsEntryFragmentFn,
	HDRToCubeMapShaderUtilsEntryVertexFn,
} from "../shader/HDRToCubeMapShaderUtils";

import Drawable from "../scene/Drawable";
import PipelineStates from "../core/PipelineStates";
import CubeGeometry from "../geometry/CubeGeometry";
import SamplerController from "./SamplerController";
import PerspectiveCamera from "../camera/PerspectiveCamera";
import TextureController from "./TextureController";
import BaseUtilObject from "../core/BaseUtilObject";
import VertexDescriptor from "../core/VertexDescriptor";
import RenderingContext from "../core/RenderingContext";

let _emptyCubeTexCounters = 0;

export default class CubeTextureController extends BaseUtilObject {
	public static createEmptyCubeTexture(
		faceSize: number,
		debugLabel = `Cube Texture ${_emptyCubeTexCounters++}`,
		hasMips = false,
		format: GPUTextureFormat = "rgba16float",
		usage = GPUTextureUsage.RENDER_ATTACHMENT |
			GPUTextureUsage.TEXTURE_BINDING |
			GPUTextureUsage.STORAGE_BINDING |
			GPUTextureUsage.COPY_DST,
	): GPUTexture {
		const texDesc: GPUTextureDescriptor = {
			label: debugLabel,
			dimension: "2d",
			size: {
				width: faceSize,
				height: faceSize,
				depthOrArrayLayers: 6,
			},
			usage,
			format,
		};

		if (hasMips) {
			texDesc.mipLevelCount = numMipLevelsForSize(faceSize, faceSize);
		}

		return RenderingContext.device.createTexture(texDesc);
	}

	public static cubeTextureFromIndividualHDRTextures = (
		faceTextures: GPUTexture[],
		debugLabel = "Environment Cube Texture From Individual HDR Textures",
		outTextureSize = 512,
		hasMips = false,
	): GPUTexture => {
		const cubeTexture = CubeTextureController.createEmptyCubeTexture(
			outTextureSize,
			debugLabel,
			hasMips,
		);

		const commandEncoder = RenderingContext.device.createCommandEncoder();
		commandEncoder.pushDebugGroup("Texture View Copy");
		const computeCopyPass = commandEncoder.beginComputePass();

		let size = outTextureSize;

		for (let face = 0; face < 6; face++) {
			TextureController.copyTextureView(
				computeCopyPass,
				faceTextures[face].createView({}),
				cubeTexture.createView({
					baseArrayLayer: face,
					arrayLayerCount: 1,
					baseMipLevel: 0,
					mipLevelCount: 1,
					dimension: "2d",
				}),
				outTextureSize,
				size,
				size,
			);
		}

		computeCopyPass.end();

		commandEncoder.popDebugGroup();
		RenderingContext.device.queue.submit([commandEncoder.finish()]);

		if (hasMips) {
			TextureController.generateMipsForCubeTexture(cubeTexture);
		}

		return cubeTexture;
	};

	public static cubeTextureFromHDR = (
		hdrTexture: GPUTexture,
		outTextureSize = 512,
	): GPUTexture => {
		const cubeTexture = RenderingContext.device.createTexture({
			label: "Environment Cube Texture",
			dimension: "2d",
			size: {
				width: outTextureSize,
				height: outTextureSize,
				depthOrArrayLayers: 6,
			},
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT |
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.STORAGE_BINDING,
			format: "rgba8unorm",
		});

		const camera = new PerspectiveCamera(Math.PI * 0.5, 1, 0.1, 10);
		camera.updateProjectionMatrix();

		const cameraViewProjMatrixBuffer = RenderingContext.device.createBuffer({
			label: "HDR -> CubeMap Camera ProjView Matrix Buffer",
			size: 16 * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
		});

		const cameraBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				buffer: {
					type: "uniform",
				},
				visibility: GPUShaderStage.VERTEX,
			},
			{
				binding: 1,
				texture: {
					sampleType: "unfilterable-float",
				},
				visibility: GPUShaderStage.FRAGMENT,
			},
			{
				binding: 2,
				sampler: {
					type: "non-filtering",
				},
				visibility: GPUShaderStage.FRAGMENT,
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
					buffer: cameraViewProjMatrixBuffer,
				},
			},
			{
				binding: 1,
				resource: hdrTexture.createView(),
			},
			{
				binding: 2,
				resource: SamplerController.createSampler({}),
			},
		];
		const cameraBindGroup = RenderingContext.device.createBindGroup({
			label: "Environment Probe Camera Bind Group",
			layout: cameraBindGroupLayout,
			entries: cameraBindGroupEntries,
		});

		const commandEncoder = RenderingContext.device.createCommandEncoder({
			label: "HDR Environment to Cube Map Command Encoder",
		});

		const colorAttachments: GPURenderPassColorAttachment[] = [
			{
				loadOp: "load",
				storeOp: "store",
				view: null,
			},
		];

		const renderTargets: GPUColorTargetState[] = [
			{
				format: "rgba8unorm",
			},
		];
		const renderPSO = PipelineStates.createRenderPipeline({
			label: "HDR To CubeMap Render PSO",
			layout: RenderingContext.device.createPipelineLayout({
				bindGroupLayouts: [cameraBindGroupLayout],
			}),
			vertex: {
				module: PipelineStates.createShaderModule(HDRToCubeMapShaderUtils),
				entryPoint: HDRToCubeMapShaderUtilsEntryVertexFn,
				buffers: VertexDescriptor.defaultLayout,
			},
			fragment: {
				module: PipelineStates.createShaderModule(HDRToCubeMapShaderUtils),
				entryPoint: HDRToCubeMapShaderUtilsEntryFragmentFn,
				targets: renderTargets,
			},
			primitive: {
				cullMode: "none",
			},
		});

		const cubeGeometry = new CubeGeometry();

		for (let i = 0; i < 6; i++) {
			colorAttachments[0].view = cubeTexture.createView({
				dimension: "2d",
				baseArrayLayer: i,
				arrayLayerCount: 1,
			});

			const lookAt = vec3.add(
				camera.position,
				SKYBOX_CUBEMAP_CAMERA_LOOK_ATS[i],
			);
			const viewMatrix = mat4.lookAt(
				camera.position,
				lookAt,
				SKYBOX_CUBEMAP_CAMERA_UPS[i],
			);
			const projViewMatrix = mat4.mul(camera.projectionMatrix, viewMatrix);

			RenderingContext.device.queue.writeBuffer(
				cameraViewProjMatrixBuffer,
				0,
				projViewMatrix,
			);

			const renderPassDescriptor: GPURenderPassDescriptor = {
				label: `Draw Face ${i} Render Pass`,
				colorAttachments,
			};

			const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);

			renderPass.setPipeline(renderPSO);
			renderPass.setBindGroup(0, cameraBindGroup);
			renderPass.setIndexBuffer(
				cubeGeometry.indexBuffer,
				Drawable.INDEX_FORMAT,
			);
			renderPass.setVertexBuffer(0, cubeGeometry.vertexBuffer);
			renderPass.drawIndexed(cubeGeometry.indexCount);

			renderPass.end();
		}

		RenderingContext.device.queue.submit([commandEncoder.finish()]);

		return cubeTexture;
	};
}
