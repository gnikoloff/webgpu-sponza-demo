import { load } from "@loaders.gl/core";
import {
	GLTFLoader,
	GLTFPostprocessed,
	postProcessGLTF,
} from "@loaders.gl/gltf";
import { quat, vec3 } from "wgpu-matrix";
import {
	GLTFBufferViewPostprocessed,
	GLTFMaterialPostprocessed,
	GLTFSamplerPostprocessed,
	GLTFTexturePostprocessed,
} from "@loaders.gl/gltf/dist/lib/types/gltf-postprocessed-schema";

import Transform from "./Transform";
import GLTFGeometry from "../geometry/GLTFGeometry";
import Drawable from "./Drawable";
import Material from "../material/Material";
import TextureLoader from "../texture/TextureLoader";
import { PBR_TEXTURES_LOCATIONS } from "../core/RendererBindings";
import SamplerController from "../texture/SamplerController";
import { RenderPassType, TextureLocation } from "../types";
import RenderingContext from "../core/RenderingContext";

const GL_ELEMENT_ARRAY_BUFFER = 34963;
const GL_ARRAY_BUFFER = 34962;

// hacky - we need to select the floor only to apply reflectance on
const SPONZA_FLOOR_TEX_ID = "5823059166183034438";

export default class GLTFModel extends Transform {
	private nodeMaterialIds: Map<string, Drawable[]> = new Map([]);
	private gpuSamplers: Map<string, GPUSampler> = new Map();
	private gpuTextures: Map<string, Promise<GPUTexture>> = new Map();
	private gpuBuffers: Map<string, GPUBuffer> = new Map();

	constructor(public url: string) {
		super();
		this.updateWorldMatrix();
	}

	public setMaterial(
		material: Material,
		renderPassType = RenderPassType.Deferred,
	): this {
		this.traverse((node) => {
			if (node instanceof Drawable) {
				node.setMaterial(material, renderPassType);
			}
		});
		return this;
	}

	public setIsReflective(v: boolean): this {
		this.traverse((node) => {
			if (node instanceof Drawable) {
				node.materialProps.isReflective = v;
			}
		});
		return this;
	}

	public setTextureForAll(
		texture: GPUTexture,
		location: TextureLocation = 1,
	): this {
		this.traverse((node) => {
			if (node instanceof Drawable) {
				node.setTexture(texture, location);
			}
		});
		return this;
	}

	public setSampler(sampler: GPUSampler): this {
		this.traverse((node) => {
			if (node instanceof Drawable) {
				node.setSampler(sampler);
			}
		});
		return this;
	}

	public setTextureFor(
		nodeName: string,
		texture: GPUTexture,
		location: TextureLocation = 1,
	): this {
		const node = this.findChildByLabel(nodeName);
		if (!(node instanceof Drawable)) {
			console.error("Found child is not instance of a Drawable");
			return;
		}

		node.setTexture(texture, location);
		return this;
	}

	public async load() {
		const gltfWithBuffers = await load(this.url, GLTFLoader);
		const gltfDefinition = postProcessGLTF(gltfWithBuffers);

		this.initGPUTexturesFrom(gltfDefinition.textures);
		this.initGPUSamplersFrom(gltfDefinition.samplers);
		this.initGPUBuffersFrom(gltfDefinition.bufferViews);
		this.initMaterialsFrom(gltfDefinition.materials);
		this.initNodesFrom(gltfDefinition);
	}

	private async initMaterialsFrom(materials: GLTFMaterialPostprocessed[]) {
		for (const material of materials) {
			if (
				material.pbrMetallicRoughness &&
				material.pbrMetallicRoughness.baseColorTexture
			) {
				const texture = await this.gpuTextures.get(
					material.pbrMetallicRoughness.baseColorTexture.texture.id,
				);
				const nodesForThisMaterial = this.nodeMaterialIds.get(material.id);
				for (const node of nodesForThisMaterial) {
					node.setTexture(texture, PBR_TEXTURES_LOCATIONS.Albedo);
				}

				if (material.pbrMetallicRoughness.metallicRoughnessTexture) {
					const texture = await this.gpuTextures.get(
						material.pbrMetallicRoughness.metallicRoughnessTexture.texture.id,
					);
					const nodesForThisMaterial = this.nodeMaterialIds.get(material.id);
					for (const node of nodesForThisMaterial) {
						node.setTexture(texture, PBR_TEXTURES_LOCATIONS.MetallicRoughness);
					}
				}
			}

			if (material.normalTexture) {
				const texture = await this.gpuTextures.get(
					material.normalTexture.texture.id,
				);
				const nodesForThisMaterial = this.nodeMaterialIds.get(material.id);
				for (const node of nodesForThisMaterial) {
					node.setTexture(texture, PBR_TEXTURES_LOCATIONS.Normal);
				}
			}
		}
	}

	private async initGPUTexturesFrom(textures: GLTFTexturePostprocessed[]) {
		for (const texture of textures) {
			const texPromise = TextureLoader.loadTextureFromData(
				texture.source.bufferView.data,
				"rgba8unorm",
				true,
				false,
				false,
				`GLTF Texture: ${texture.id}`,
			);
			this.gpuTextures.set(texture.id, texPromise);
		}
	}

	private initGPUSamplersFrom(samplers: GLTFSamplerPostprocessed[]) {
		for (const samplerInfo of samplers) {
			const sampler =
				SamplerController.getSamplerFromGltfSamplerDef(samplerInfo);
			this.gpuSamplers.set(samplerInfo.id, sampler);
		}
	}

	private initGPUBuffersFrom(buffViews: GLTFBufferViewPostprocessed[]) {
		for (let buffView of buffViews) {
			let usage: GPUBufferUsageFlags = 0;

			if (buffView.target === GL_ELEMENT_ARRAY_BUFFER) {
				usage |= GPUBufferUsage.INDEX;
			}

			if (buffView.target === GL_ARRAY_BUFFER) {
				usage |= GPUBufferUsage.VERTEX;
			}

			const alignedLength = Math.ceil(buffView.byteLength / 4) * 4;
			const gpuBuffer = RenderingContext.device.createBuffer({
				label: buffView.id,
				mappedAtCreation: true,
				size: alignedLength,
				usage,
			});
			new Uint8Array(gpuBuffer.getMappedRange()).set(
				new Uint8Array(
					buffView.buffer.arrayBuffer,
					buffView.byteOffset,
					buffView.byteLength,
				),
			);
			gpuBuffer.unmap();
			this.gpuBuffers.set(buffView.id, gpuBuffer);
		}
	}

	private initNodesFrom(gltf: GLTFPostprocessed) {
		for (const node of gltf.nodes) {
			const meshInfo = node.mesh;
			if (!meshInfo) {
				continue;
			}

			for (const primitive of node.mesh.primitives) {
				const geometry = new GLTFGeometry(primitive, this.gpuBuffers);
				const mesh = new Drawable(geometry);
				const nodePosition = vec3.create();
				const nodeScale = vec3.create(1, 1, 1);
				const nodeRotation = quat.identity();
				const nodesForMaterial =
					this.nodeMaterialIds.get(primitive.material.id) || [];
				nodesForMaterial.push(mesh);
				this.nodeMaterialIds.set(primitive.material.id, nodesForMaterial);

				if (
					primitive.material.pbrMetallicRoughness.baseColorTexture &&
					primitive.material.pbrMetallicRoughness.baseColorTexture.texture.source.uri.includes(
						SPONZA_FLOOR_TEX_ID,
					)
				) {
					mesh.materialProps.isReflective = true;
				} else {
					mesh.materialProps.isReflective = false;
				}
				mesh.label = node.name ?? node.id;

				const bboxMin = primitive.attributes?.POSITION?.min;
				if (bboxMin) {
					mesh.boundingBox.setMinAABBfromGLTF(bboxMin);
				}
				const bboxMax = primitive.attributes?.POSITION?.max;
				if (bboxMax) {
					mesh.boundingBox.setMaxAABBfromGLTF(bboxMax);
				}

				if (node.translation) {
					vec3.set(
						node.translation[0],
						node.translation[1],
						node.translation[2],
						nodePosition,
					);
				}

				if (node.scale) {
					vec3.set(node.scale[0], node.scale[1], node.scale[2], nodeScale);
				}

				if (node.rotation) {
					quat.set(
						node.rotation[0],
						node.rotation[1],
						node.rotation[2],
						node.rotation[3],
						nodeRotation,
					);
				}

				// mesh.isOpaque = !primitive.material.alphaCutoff;
				mesh.setCustomMatrixFromTRS(nodePosition, nodeRotation, nodeScale);
				mesh.sampler = this.gpuSamplers.get("sampler-0");
				this.addChild(mesh);
			}
		}
	}
}
