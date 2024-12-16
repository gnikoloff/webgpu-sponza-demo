import BaseUtilObject from "../core/BaseUtilObject";
import PipelineStates from "../core/PipelineStates";
import RenderingContext from "../core/RenderingContext";
import VRAMUsageTracker from "../misc/VRAMUsageTracker";
import SpecularIBLShaderUtils, {
	SpecularIBLShaderUtilsEntryFn,
} from "../shader/SpecularIBLShaderUtils";
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
	{
		binding: 4,
		buffer: {},
		visibility: GPUShaderStage.COMPUTE,
	},
];

export default class SpecularIBLGenerator extends BaseUtilObject {
	private static get computePSO(): GPUComputePipeline {
		if (_computePSO) {
			return _computePSO;
		}

		const computePSOBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "Specular IBL Compute PSO Bind Group Layout",
				entries: _computePSOBindGroupLayoutEntries,
			});

		_computePSO = PipelineStates.createComputePipeline({
			label: "Specular IBL Compute PSO",
			compute: {
				module: PipelineStates.createShaderModule(SpecularIBLShaderUtils),
				entryPoint: SpecularIBLShaderUtilsEntryFn,
			},
			layout: RenderingContext.device.createPipelineLayout({
				label: "Specular IBL Compute PSO",
				bindGroupLayouts: [computePSOBindGroupLayout],
			}),
		});

		return _computePSO;
	}

	public static encode = (inTexture: GPUTexture, outSize = 128): GPUTexture => {
		if (inTexture.depthOrArrayLayers !== 6) {
			console.error("Need cube texture as a source of IBL Specular");
			return;
		}

		if (inTexture.format !== "rgba16float") {
			console.error(
				"Only rgba16float cube textures supported for Specular IBL for now",
			);
			return;
		}

		const outTex = CubeTextureController.createEmptyCubeTexture(
			outSize,
			"Specular IBL Texture",
			true,
		);

		const inTextureSlice = inTexture.createView({
			dimension: "cube",
		});

		let levels = outTex.mipLevelCount;

		const inputBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: inTextureSlice,
			},
			{
				binding: 1,
				resource: null,
			},
			{
				binding: 2,
				resource: SamplerController.createSampler({
					minFilter: "linear",
					magFilter: "linear",
				}),
			},
			{
				binding: 3,
				resource: {
					buffer: null, // face index
				},
			},
			{
				binding: 4,
				resource: {
					buffer: null, // roughness
				},
			},
		];

		let commandEncoder = RenderingContext.device.createCommandEncoder({
			label: "Specular IBL Command Encoder",
		});
		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			commandEncoder.pushDebugGroup("Begin Specular IBL Generation");
		}

		let computePass = commandEncoder.beginComputePass({
			label: "Specular IBL Compute Pass",
		});

		computePass.setPipeline(SpecularIBLGenerator.computePSO);

		const computePSOBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "Specular IBL Compute PSO Bind Group Layout",
				entries: _computePSOBindGroupLayoutEntries,
			});

		let size = outSize;

		for (let level = 0; level < levels; level++) {
			const roughness = level / (levels - 1);

			const roughnessBuffer = RenderingContext.device.createBuffer({
				label: "Roughness Buffer",
				mappedAtCreation: true,
				size: Float32Array.BYTES_PER_ELEMENT,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			});

			VRAMUsageTracker.addBufferBytes(roughnessBuffer);

			new Float32Array(roughnessBuffer.getMappedRange()).set(
				new Float32Array([roughness]),
			);
			roughnessBuffer.unmap();

			inputBindGroupEntries[4].resource = {
				buffer: roughnessBuffer,
			};

			for (let face = 0; face < 6; face++) {
				const faceBuffer = RenderingContext.device.createBuffer({
					label: "Face Buffer",
					mappedAtCreation: true,
					size: Uint32Array.BYTES_PER_ELEMENT,
					usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
				});

				VRAMUsageTracker.addBufferBytes(faceBuffer);

				new Uint32Array(faceBuffer.getMappedRange()).set(
					new Uint32Array([face]),
				);
				faceBuffer.unmap();

				inputBindGroupEntries[1].resource = outTex.createView({
					format: outTex.format,
					dimension: "2d",
					baseMipLevel: level,
					mipLevelCount: 1,
					baseArrayLayer: face,
					arrayLayerCount: 1,
				});

				inputBindGroupEntries[3].resource = {
					buffer: faceBuffer,
				};

				const inputBindGroup = RenderingContext.device.createBindGroup({
					layout: computePSOBindGroupLayout,
					entries: inputBindGroupEntries,
				});

				const workgroupSizePerDim = 8;

				const workgroupCountX =
					(size + workgroupSizePerDim - 1) / workgroupSizePerDim;
				const workgroupCountY =
					(size + workgroupSizePerDim - 1) / workgroupSizePerDim;

				computePass.setBindGroup(0, inputBindGroup);
				computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1);
			}

			size /= 2;
		}

		computePass.end();
		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			commandEncoder.popDebugGroup();
		}
		RenderingContext.device.queue.submit([commandEncoder.finish()]);

		VRAMUsageTracker.addTextureBytes(outTex);

		return outTex;
	};
}
