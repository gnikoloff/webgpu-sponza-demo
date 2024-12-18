import BaseUtilObject from "../core/BaseUtilObject";
import PipelineStates from "../core/PipelineStates";
import RenderingContext from "../core/RenderingContext";
import VRAMUsageTracker from "../misc/VRAMUsageTracker";
import DiffuseIBLShaderUtils, {
	DiffuseIBLShaderEntryFn,
} from "../shader/DiffuseIBLShaderUtils";
import CubeTextureController from "./CubeTextureController";
import SamplerController from "./SamplerController";

let _computePSO: GPUComputePipeline;

const _computePSOBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
	{
		binding: 0,
		texture: {
			viewDimension: "cube",
			sampleType: "float",
		},
		visibility: GPUShaderStage.COMPUTE,
	},
	{
		binding: 1,
		storageTexture: {
			access: "write-only",
			format: "rgba16float",
			viewDimension: "2d",
		},
		visibility: GPUShaderStage.COMPUTE,
	},
	{
		binding: 2,
		sampler: {},
		visibility: GPUShaderStage.COMPUTE,
	},
	{
		binding: 3,
		buffer: {},
		visibility: GPUShaderStage.COMPUTE,
	},
];

export default class DiffuseIBLGenerator extends BaseUtilObject {
	private static get computePSO(): GPUComputePipeline {
		if (_computePSO) {
			return _computePSO;
		}

		const computePSOBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "Diffuse IBL Compute PSO Bind Group Layout",
				entries: _computePSOBindGroupLayoutEntries,
			});

		_computePSO = PipelineStates.createComputePipeline({
			label: "Diffuse IBL Compute PSO",
			compute: {
				module: PipelineStates.createShaderModule(DiffuseIBLShaderUtils),
				entryPoint: DiffuseIBLShaderEntryFn,
			},
			layout: RenderingContext.device.createPipelineLayout({
				label: "Diffuse IBL Compute PSO Layout",
				bindGroupLayouts: [computePSOBindGroupLayout],
			}),
		});

		return _computePSO;
	}

	public static encode = (inTexture: GPUTexture, outSize = 32): GPUTexture => {
		if (inTexture.depthOrArrayLayers !== 6) {
			console.error("Need cube texture as a source for IBL Diffuse");
			return;
		}

		if (inTexture.format !== "rgba16float") {
			console.error(
				"Only rgba16float cube textures supported for Diffuse IBL for now",
			);
			return;
		}

		const outTex = CubeTextureController.createEmptyCubeTexture(
			outSize,
			"Diffuse IBL Texture",
			true,
		);

		const computePSOBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "Diffuse IBL Compute PSO Bind Group Layout",
				entries: _computePSOBindGroupLayoutEntries,
			});

		const inputBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: null,
			},
			{
				binding: 1,
				resource: null,
			},
			{
				binding: 2,
				resource: SamplerController.createSampler({
					addressModeU: "clamp-to-edge",
					addressModeV: "clamp-to-edge",
					minFilter: "linear",
					magFilter: "linear",
				}),
			},
			{
				binding: 3,
				resource: {
					buffer: null, //DiffuseIBLGenerator.faceIndexBuffer,
				},
			},
		];

		const commandEncoder = RenderingContext.device.createCommandEncoder({
			label: `Diffuse IBL Command Encoder`,
		});

		const diffuseIBLComputePass = commandEncoder.beginComputePass({
			label: "Diffuse IBL Compute Pass",
		});
		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			diffuseIBLComputePass.pushDebugGroup("Begin Diffuse IBL");
		}

		diffuseIBLComputePass.setPipeline(DiffuseIBLGenerator.computePSO);

		const inTextureSlice = inTexture.createView({
			dimension: "cube",
		});

		for (let i = 0; i < 6; i++) {
			const faceBuffer = RenderingContext.device.createBuffer({
				label: "Diffuse IBL Face GPUBuffer",
				size: Uint32Array.BYTES_PER_ELEMENT,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
				mappedAtCreation: true,
			});

			VRAMUsageTracker.addBufferBytes(faceBuffer);

			new Uint32Array(faceBuffer.getMappedRange()).set(new Uint32Array([i]));
			faceBuffer.unmap();

			const outTextureSlice = outTex.createView({
				format: outTex.format,
				dimension: "2d",
				baseMipLevel: 0,
				mipLevelCount: 1,
				baseArrayLayer: i,
				arrayLayerCount: 1,
			});

			inputBindGroupEntries[0].resource = inTextureSlice;
			inputBindGroupEntries[1].resource = outTextureSlice;
			inputBindGroupEntries[3].resource = {
				buffer: faceBuffer,
			};

			const inputBindGroup = RenderingContext.device.createBindGroup({
				layout: computePSOBindGroupLayout,
				entries: inputBindGroupEntries,
			});

			const workgroupSizePerDim = 8;

			const workgroupCountX =
				(outTex.width + workgroupSizePerDim - 1) / workgroupSizePerDim;
			const workgroupCountY =
				(outTex.height + workgroupSizePerDim - 1) / workgroupSizePerDim;

			diffuseIBLComputePass.setBindGroup(0, inputBindGroup);
			diffuseIBLComputePass.dispatchWorkgroups(
				workgroupCountX,
				workgroupCountY,
				1,
			);
		}

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			diffuseIBLComputePass.popDebugGroup();
		}
		diffuseIBLComputePass.end();
		RenderingContext.device.queue.submit([commandEncoder.finish()]);

		VRAMUsageTracker.addTextureBytes(outTex);

		return outTex;
	};
}
