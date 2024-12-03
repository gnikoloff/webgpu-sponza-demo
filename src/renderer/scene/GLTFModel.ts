import { load } from "@loaders.gl/core";
import {
	GLTFLoader,
	GLTFPostprocessed,
	postProcessGLTF,
} from "@loaders.gl/gltf";
import { quat, vec3 } from "wgpu-matrix";

import Transform from "./Transform";
import GLTFGeometry from "../geometry/GLTFGeometry";
import Drawable from "./Drawable";
import { RenderPassType } from "../core/RenderPass";
import Material from "../material/Material";
import TextureLoader from "../texture/TextureLoader";
import {
	PBR_TEXTURES_LOCATIONS,
	TextureLocation,
} from "../core/RendererBindings";
import SamplerController from "../texture/SamplerController";

export default class GLTFModel extends Transform {
	private texturesToLoad: Map<TextureLocation, Promise<GPUTexture>> = new Map();
	private gltfDefinition: GLTFPostprocessed;
	private nodeMaterialIds: Map<string, Drawable[]> = new Map([]);

	public getAlbedoTexture(): Promise<GPUTexture> {
		return this.getTexture(PBR_TEXTURES_LOCATIONS.Albedo);
	}

	public getNormalTexture(): Promise<GPUTexture> {
		return this.getTexture(PBR_TEXTURES_LOCATIONS.Normal);
	}

	public getTexture(location: TextureLocation): Promise<GPUTexture> {
		return this.texturesToLoad.get(location);
	}

	constructor(public url: string) {
		super();
		this.updateWorldMatrix();
	}

	public setMaterial(
		material: Material,
		forRenderPassType: RenderPassType = RenderPassType.Deferred,
	) {
		this.traverse((node) => {
			if (node instanceof Drawable) {
				node.setMaterial(material, forRenderPassType);
			}
		});
	}

	public setIsReflective(v: boolean) {
		this.traverse((node) => {
			if (node instanceof Drawable) {
				node.materialProps.isReflective = v;
			}
		});
	}

	public setTextureForAll(texture: GPUTexture, location: TextureLocation = 1) {
		this.traverse((node) => {
			if (node instanceof Drawable) {
				node.setTexture(texture, location);
			}
		});
	}

	public setSampler(sampler: GPUSampler) {
		this.traverse((node) => {
			if (node instanceof Drawable) {
				node.setSampler(sampler);
			}
		});
	}

	public setTextureFor(
		nodeName: string,
		texture: GPUTexture,
		location: TextureLocation = 1,
	) {
		const node = this.findChildByLabel(nodeName);
		if (!node) {
			console.error(`Could not find a child node with label: ${nodeName}`);
			return;
		}
		if (!(node instanceof Drawable)) {
			console.error("Found child is not instance of a Drawable");
			return;
		}

		node.setTexture(texture, location);
	}

	public async load() {
		const gltfWithBuffers = await load(this.url, GLTFLoader);
		this.gltfDefinition = postProcessGLTF(gltfWithBuffers);

		// const sampler = this.gltfDefinition.samplers[0];

		this.loadTextures().then((tex) => console.log(tex));
		this.createNodesFrom(this.gltfDefinition);
	}

	public async loadTextures(): Promise<GPUTexture[]> {
		const { gltfDefinition: gltf } = this;

		const loadPromises: Promise<GPUTexture>[] = [];

		const createTexture = async (
			textureSource: Uint8Array,
			showDebug = false,
		): Promise<GPUTexture> => {
			const blob = new Blob([textureSource], {
				type: "image/png",
			});
			const bitmap = await createImageBitmap(blob, {
				colorSpaceConversion: "none",
			});
			const tex = TextureLoader.loadTextureFromData(bitmap, true);

			const debugCavas = document.createElement("canvas");
			const ctx = debugCavas.getContext("2d");

			debugCavas.width = tex.width / 2;
			debugCavas.height = tex.height / 2;

			ctx.drawImage(bitmap, 0, 0);

			if (showDebug) {
				debugCavas.style.setProperty("position", "fixed");
				debugCavas.style.setProperty("z-index", "99");
				debugCavas.style.setProperty("left", "2rem");
				debugCavas.style.setProperty("bottom", "2rem");
				debugCavas.style.setProperty("width", `${tex.width * 0.1}px`);
				debugCavas.style.setProperty("height", `${tex.height * 0.1}px`);
				document.body.appendChild(debugCavas);
			}

			bitmap.close();
			return tex;
		};

		for (const material of gltf.materials) {
			if (
				material.pbrMetallicRoughness &&
				material.pbrMetallicRoughness.baseColorTexture &&
				material.pbrMetallicRoughness.baseColorTexture.texture.source &&
				material.pbrMetallicRoughness.baseColorTexture.texture.source
					.bufferView &&
				material.pbrMetallicRoughness.baseColorTexture.texture.source.bufferView
					.data
			) {
				this.texturesToLoad.set(
					PBR_TEXTURES_LOCATIONS.Albedo,
					createTexture(
						material.pbrMetallicRoughness.baseColorTexture.texture.source
							.bufferView.data,
						// true,
					).then((tex) => {
						const nodesForThisMaterial = this.nodeMaterialIds.get(material.id);
						for (const node of nodesForThisMaterial) {
							node.setTexture(tex, PBR_TEXTURES_LOCATIONS.Albedo);
						}

						return tex;
					}),
				);
			}

			if (
				material.pbrMetallicRoughness &&
				material.pbrMetallicRoughness.metallicRoughnessTexture &&
				material.pbrMetallicRoughness.metallicRoughnessTexture.texture.source &&
				material.pbrMetallicRoughness.metallicRoughnessTexture.texture.source
					.bufferView &&
				material.pbrMetallicRoughness.metallicRoughnessTexture.texture.source
					.bufferView.data
			) {
				this.texturesToLoad.set(
					PBR_TEXTURES_LOCATIONS.MetallicRoughness,
					createTexture(
						material.pbrMetallicRoughness.metallicRoughnessTexture.texture
							.source.bufferView.data,
						true,
					).then((tex) => {
						const nodesForThisMaterial = this.nodeMaterialIds.get(material.id);
						for (const node of nodesForThisMaterial) {
							node.setTexture(tex, PBR_TEXTURES_LOCATIONS.MetallicRoughness);
						}

						return tex;
					}),
				);
			}

			if (
				material.normalTexture &&
				material.normalTexture.texture.source &&
				material.normalTexture.texture.source.bufferView &&
				material.normalTexture.texture.source.bufferView.data
			) {
				this.texturesToLoad.set(
					PBR_TEXTURES_LOCATIONS.Normal,
					createTexture(
						material.normalTexture.texture.source.bufferView.data,
					).then((tex) => {
						const nodesForThisMaterial = this.nodeMaterialIds.get(material.id);
						for (const node of nodesForThisMaterial) {
							node.setTexture(tex, PBR_TEXTURES_LOCATIONS.Normal);
						}

						return tex;
					}),
				);
			}
		}
		return Promise.all(loadPromises);
	}

	private createNodesFrom(gltf: GLTFPostprocessed) {
		const samplers = gltf.samplers.map((samplerInfo) =>
			SamplerController.getSamplerFromGltfSamplerDef(samplerInfo),
		);

		for (const node of gltf.nodes) {
			const meshInfo = node.mesh;
			if (!meshInfo) {
				continue;
			}

			for (const primitive of node.mesh.primitives) {
				if (primitive.material.alphaCutoff) {
					this.nodeMaterialIds.set(primitive.material.id, []);
					continue;
				}
				const geometry = new GLTFGeometry(primitive);
				const mesh = new Drawable(geometry);
				const nodePosition = vec3.create();
				const nodeScale = vec3.create(1, 1, 1);
				const nodeRotation = quat.identity();

				const nodesForMaterial =
					this.nodeMaterialIds.get(primitive.material.id) || [];
				nodesForMaterial.push(mesh);
				this.nodeMaterialIds.set(primitive.material.id, nodesForMaterial);

				mesh.label = node.name ?? node.id;

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

				mesh.setCustomMatrixFromTRS(nodePosition, nodeRotation, nodeScale);
				mesh.sampler = samplers[0];
				this.addChild(mesh);
			}
		}
	}
}
