import { Vec2, vec2 } from "wgpu-matrix";
import Renderer from "../../app/Renderer";
import PipelineStates from "../core/PipelineStates";
import CopyTextureViewShaderUtils, {
	CopyTextureViewShaderUtilsEntryFn,
} from "../shader/CopyTextureViewShaderUtils";
import {
	GetMipComputeGeneratorShaderUtils,
	MipComputeGeneratorShaderEntryFn,
} from "../shader/MipComputeGeneratorShaderUtils";
import { HDRImageResult } from "./TextureLoader";
import { numMipLevelsForSize } from "../math/math";
import BaseUtilObject from "../core/BaseUtilObject";

function initBindGroup(
	nextMipLevel: number,
	textureMipViews: GPUTextureView[],
	layout: GPUBindGroupLayout,
): GPUBindGroup {
	const bindGroupEntries: GPUBindGroupEntry[] = [
		{
			binding: 0,
			resource: textureMipViews[nextMipLevel - 1],
		},
		{
			binding: 1,
			resource: textureMipViews[nextMipLevel],
		},
	];
	return Renderer.device.createBindGroup({
		label: "Mip Generator Input Bind Group",
		layout,
		entries: bindGroupEntries,
	});
}

export default class TextureController extends BaseUtilObject {
	public static generateMipsForCubeTexture = (
		texture: GPUTexture,
	): GPUTexture => {
		if (texture.depthOrArrayLayers != 6) {
			console.error("Need a cube texture");
			return;
		}

		const mipLevel = numMipLevelsForSize(texture.width, texture.height);

		const textureViewDescriptor: GPUTextureViewDescriptor = {
			baseMipLevel: 0,
			mipLevelCount: 1,
			baseArrayLayer: 0,
			arrayLayerCount: 1,
			dimension: "2d",
			format: texture.format,
		};

		const textureMipViewsForEachFace: GPUTextureView[][] = [];
		const textureMipSizesForEachFace: Vec2[][] = [];

		for (let face = 0; face < 6; face++) {
			const texMipViewForFace: GPUTextureView[] = [];
			const texMipSizeForFace: Vec2[] = [
				vec2.create(texture.width, texture.height),
			];
			for (let level = 0; level < mipLevel; level++) {
				let levelLabel = `MIP Level ${level}`;
				textureViewDescriptor.label = levelLabel;
				textureViewDescriptor.baseArrayLayer = face;
				textureViewDescriptor.baseMipLevel = level;
				texMipViewForFace.push(texture.createView(textureViewDescriptor));
				if (level > 0) {
					const prevSize = texMipSizeForFace[level - 1];
					const currSize = vec2.divScalar(prevSize, 2);
					texMipSizeForFace.push(currSize);
				}
			}
			textureMipViewsForEachFace.push(texMipViewForFace);
			textureMipSizesForEachFace.push(texMipSizeForFace);
		}

		const inputBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				texture: {
					viewDimension: "2d",
				},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				storageTexture: {
					access: "write-only",
					format: texture.format,
					viewDimension: "2d",
				},
			},
		];

		const inputBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Mip Generator CubeTexture Input Bind Group Layout",
			entries: inputBindGroupLayoutEntries,
		});
		const computeMipComputePSO = PipelineStates.createComputePipeline({
			label: "Compute Mip ComputePSO",
			layout: Renderer.device.createPipelineLayout({
				label: "Compute Mip ComputePSO CubeTexture Layout",
				bindGroupLayouts: [inputBindGroupLayout],
			}),
			compute: {
				entryPoint: MipComputeGeneratorShaderEntryFn,
				module: PipelineStates.createShaderModule(
					GetMipComputeGeneratorShaderUtils(texture.format),
				),
			},
		});

		const commandEncoder = Renderer.device.createCommandEncoder({
			label: `Mip Generate Command Encoder}`,
		});
		const computePass = commandEncoder.beginComputePass();
		computePass.setPipeline(computeMipComputePSO);

		for (let face = 0; face < 6; face++) {
			const textureMipSizes = textureMipSizesForEachFace[face];
			const textureMipViews = textureMipViewsForEachFace[face];
			for (let nextLevel = 1; nextLevel < textureMipSizes.length; nextLevel++) {
				const invocationCountX = textureMipSizes[nextLevel][0];
				const invocationCountY = textureMipSizes[nextLevel][1];
				const workgroupSizePerDim = 8;
				const workgroupCountX =
					(invocationCountX + workgroupSizePerDim - 1) / workgroupSizePerDim;
				const workgroupCountY =
					(invocationCountY + workgroupSizePerDim - 1) / workgroupSizePerDim;

				const bindGroup = initBindGroup(
					nextLevel,
					textureMipViews,
					inputBindGroupLayout,
				);
				computePass.setBindGroup(0, bindGroup);
				computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1);
			}
		}
		computePass.end();

		Renderer.device.queue.submit([commandEncoder.finish()]);
	};

	public static generateMipsFor2DTextureWithRenderPSO = () => {};

	public static generateMipsFor2DTextureWithComputePSO = (
		texture: GPUTexture,
		debugLabel = "Mipmapped 2D Texture",
	) => {
		const mipLevelCount = numMipLevelsForSize(texture.width, texture.height);

		const textureViewDescriptor: GPUTextureViewDescriptor = {
			aspect: "all",
			baseMipLevel: 0,
			mipLevelCount: 1,
			baseArrayLayer: 0,
			arrayLayerCount: 1,
			dimension: "2d",
			format: texture.format,
		};
		const inputBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				texture: {
					viewDimension: "2d",
				},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				storageTexture: {
					access: "write-only",
					format: texture.format,
					viewDimension: "2d",
				},
			},
		];

		const inputBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Mip Generator Input Bind Group Layout",
			entries: inputBindGroupLayoutEntries,
		});

		const computeMipComputePSO = PipelineStates.createComputePipeline({
			label: "Compute Mip ComputePSO",
			layout: Renderer.device.createPipelineLayout({
				label: "Compute Mip ComputePSO Layout",
				bindGroupLayouts: [inputBindGroupLayout],
			}),
			compute: {
				entryPoint: MipComputeGeneratorShaderEntryFn,
				module: PipelineStates.createShaderModule(
					GetMipComputeGeneratorShaderUtils(),
				),
			},
		});

		const textureMipViews: GPUTextureView[] = [];
		const textureMipSizes: Vec2[] = [
			vec2.create(texture.width, texture.height),
		];

		for (let level = 0; level < mipLevelCount; level++) {
			let levelLabel = `MIP Level ${level}`;
			textureViewDescriptor.label = levelLabel;
			textureViewDescriptor.baseMipLevel = level;
			textureMipViews.push(texture.createView(textureViewDescriptor));
			if (level > 0) {
				const prevSize = textureMipSizes[level - 1];

				const currSize = vec2.divScalar(prevSize, 2);
				textureMipSizes.push(currSize);
			}
		}

		const commandEncoder = Renderer.device.createCommandEncoder({
			label: `Mip Generate Command Encoder for ${debugLabel}`,
		});
		const computePass = commandEncoder.beginComputePass();
		computePass.setPipeline(computeMipComputePSO);
		for (let nextLevel = 1; nextLevel < textureMipSizes.length; nextLevel++) {
			const invocationCountX = textureMipSizes[nextLevel][0];
			const invocationCountY = textureMipSizes[nextLevel][1];
			const workgroupSizePerDim = 8;

			const workgroupCountX =
				(invocationCountX + workgroupSizePerDim - 1) / workgroupSizePerDim;
			const workgroupCountY =
				(invocationCountY + workgroupSizePerDim - 1) / workgroupSizePerDim;

			const bindGroup = initBindGroup(
				nextLevel,
				textureMipViews,
				inputBindGroupLayout,
			);
			computePass.setBindGroup(0, bindGroup);
			computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1);
		}
		computePass.end();

		Renderer.device.queue.submit([commandEncoder.finish()]);
	};

	public static copyTextureView(
		computeCopyPass: GPUComputePassEncoder,
		inTextureView: GPUTextureView,
		outTextureView: GPUTextureView,
		origTexWidth: number,
		texWidth: number,
		texHeight: number,
		inTextureBindingLayout: GPUTextureBindingLayout = {
			viewDimension: "2d",
			sampleType: "unfilterable-float",
		},
		outTextureBindingLayout: GPUStorageTextureBindingLayout = {
			access: "write-only",
			format: "rgba16float",
			viewDimension: "2d",
		},
	) {
		const inOutTextureScaleFactorBuffer = Renderer.device.createBuffer({
			label: "Copy Texture View Compute Tex Scale Factor Buffer",
			size: Uint32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.UNIFORM,
			mappedAtCreation: true,
		});

		const scaleMultiplier = origTexWidth / texWidth;

		new Uint32Array(inOutTextureScaleFactorBuffer.getMappedRange()).set(
			new Uint32Array([scaleMultiplier]),
		);
		inOutTextureScaleFactorBuffer.unmap();

		const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				texture: inTextureBindingLayout,
			},
			{
				binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				storageTexture: outTextureBindingLayout,
			},
			{
				binding: 2,
				visibility: GPUShaderStage.COMPUTE,
				buffer: {},
			},
		];

		const bindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Copy Texture View Compute Bind Group Layout",
			entries: bindGroupLayoutEntries,
		});

		const entries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: inTextureView,
			},
			{
				binding: 1,
				resource: outTextureView,
			},
			{
				binding: 2,
				resource: {
					buffer: inOutTextureScaleFactorBuffer,
				},
			},
		];

		const bindGroup = Renderer.device.createBindGroup({
			layout: bindGroupLayout,
			entries,
		});

		const pipelineLayout = Renderer.device.createPipelineLayout({
			label: "Copy Texture View Compute PSO Layout",
			bindGroupLayouts: [bindGroupLayout],
		});

		const copyTextureComputePSO = PipelineStates.createComputePipeline({
			label: "Copy Texture View Compute PSO",
			layout: pipelineLayout,
			compute: {
				module: PipelineStates.createShaderModule(CopyTextureViewShaderUtils),
				entryPoint: CopyTextureViewShaderUtilsEntryFn,
			},
		});

		computeCopyPass.setPipeline(copyTextureComputePSO);
		computeCopyPass.setBindGroup(0, bindGroup);
		computeCopyPass.dispatchWorkgroups(
			Math.ceil(texWidth / 8),
			Math.ceil(texHeight / 8),
			1,
		);
	}

	public static createHDRTexture = (
		hdrImage: HDRImageResult,
		usage = GPUTextureUsage.TEXTURE_BINDING,
		debugLabel = "HDR Texture",
	): GPUTexture => {
		const texture = Renderer.device.createTexture({
			label: debugLabel,
			format: "rgba16float",
			size: {
				width: hdrImage.width,
				height: hdrImage.height,
				depthOrArrayLayers: 1,
			},
			usage,
		});

		Renderer.device.queue.writeTexture(
			{ texture, mipLevel: 0 },
			hdrImage.rgbaHalfFloat,
			{
				offset: 0,
				bytesPerRow: hdrImage.width * Uint16Array.BYTES_PER_ELEMENT * 4,
			},
			{
				width: hdrImage.width,
				height: hdrImage.height,
				depthOrArrayLayers: 1,
			},
		);

		return texture;
	};
}
