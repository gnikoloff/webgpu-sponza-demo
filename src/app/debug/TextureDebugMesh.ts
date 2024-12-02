import Drawable from "../../renderer/scene/Drawable";
import PipelineStates from "../../renderer/core/PipelineStates";
import Material from "../../renderer/material/Material";

import {
	FRAGMENT_SHADER_DEBUG_TEXTURE_ENTRY_FN,
	getDebugFragmentShader,
} from "../shaders/FragmentShader";

import GeometryCache from "../utils/GeometryCache";
import Renderer from "../Renderer";
import {
	VERTEX_SHADER_DEFAULT_ENTRY_FN,
	getVertexShader,
} from "../shaders/VertexShader";

export enum TextureDebugMeshType {
	Normal,
	MetallicRoughness,
	Reflectance,
	Albedo,
	Depth,
	Velocity,
	ShadowDepthCascade0,
	ShadowDepthCascade1,
	BDRF,
}

const textureTypeToDomId: Map<TextureDebugMeshType, string> = new Map([
	[TextureDebugMeshType.Normal, "normal-texture"],
	[TextureDebugMeshType.MetallicRoughness, "metallic-roughness-texture"],
	[TextureDebugMeshType.Reflectance, "reflectance-texture"],
	[TextureDebugMeshType.Albedo, "albedo-texture"],
	[TextureDebugMeshType.Depth, "depth-texture"],
	[TextureDebugMeshType.Velocity, "velocity-texture"],
	[TextureDebugMeshType.ShadowDepthCascade0, "shadow-depth-cascade-0"],
	[TextureDebugMeshType.ShadowDepthCascade1, "shadow-depth-cascade-1"],
	[TextureDebugMeshType.BDRF, "bdrf"],
]);

const textureTypeToDomHeading: Map<TextureDebugMeshType, string> = new Map([
	[TextureDebugMeshType.Normal, "Normal"],
	[TextureDebugMeshType.MetallicRoughness, "Metallic + Roughness"],
	[TextureDebugMeshType.Reflectance, "Reflectance"],
	[TextureDebugMeshType.Albedo, "Albedo"],
	[TextureDebugMeshType.Depth, "Depth"],
	[TextureDebugMeshType.Velocity, "Velocity"],
	[TextureDebugMeshType.ShadowDepthCascade0, "Shadow Depth Cascade 1"],
	[TextureDebugMeshType.ShadowDepthCascade1, "Shadow Depth Cascade 2"],
	[TextureDebugMeshType.BDRF, "BDRF"],
]);

export default class TextureDebugMesh extends Drawable {
	private static sampler: GPUSampler;

	private $domContainer: HTMLDivElement;

	private samplerTextureBindGroup: GPUBindGroup;

	constructor(type: TextureDebugMeshType, debugTextureView: GPUTextureView) {
		super(GeometryCache.defaultPlaneGeometry);

		const domContainerId = textureTypeToDomId.get(type);
		this.$domContainer = document.createElement("div");
		this.$domContainer.id = domContainerId;
		this.$domContainer.style.setProperty("position", "fixed");
		this.$domContainer.style.setProperty("display", "none");
		document.body.appendChild(this.$domContainer);

		const headlineText = textureTypeToDomHeading.get(type);
		const $headline = document.createElement("div");
		$headline.style.setProperty("position", "absolute");
		$headline.style.setProperty("top", "-24px");
		$headline.style.setProperty("left", "0");
		$headline.style.setProperty("width", "100%");
		$headline.style.setProperty("height", "24px");
		$headline.style.setProperty("display", "flex");
		$headline.style.setProperty("padding-left", "8px");
		$headline.style.setProperty("align-items", "center");
		$headline.style.setProperty("text-transform", "uppercase");
		$headline.style.setProperty("font-size", "11px");
		$headline.style.setProperty("background-color", "rgba(0, 0, 0, 0.5)");
		$headline.style.setProperty("color", "white");
		$headline.style.setProperty("user-select", "none");
		$headline.textContent = headlineText;
		this.$domContainer.appendChild($headline);

		if (!TextureDebugMesh.sampler) {
			TextureDebugMesh.sampler = Renderer.device.createSampler({
				magFilter: "nearest",
				minFilter: "nearest",
			});
		}

		const isDepthTexture =
			type === TextureDebugMeshType.Depth ||
			type === TextureDebugMeshType.ShadowDepthCascade0 ||
			type === TextureDebugMeshType.ShadowDepthCascade1;
		const samplerTextureBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {
					type: "filtering",
				},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: isDepthTexture ? "depth" : "float",
				},
			},
		];
		const samplerTextureBindGroupLayout = Renderer.device.createBindGroupLayout(
			{
				label: "TextureDebugMesh Sampler + Texture GPUBindGroupLayout",
				entries: samplerTextureBindGroupLayoutEntries,
			},
		);

		const samplerTextureBindGroupEntries = [
			{
				binding: 0,
				resource: TextureDebugMesh.sampler,
			},
			{
				binding: 1,
				resource: debugTextureView,
			},
		];

		this.samplerTextureBindGroup = Renderer.device.createBindGroup({
			layout: samplerTextureBindGroupLayout,
			entries: samplerTextureBindGroupEntries,
		});

		this.setMaterial(
			new Material({
				debugLabel: "Debug Material",
				vertexShaderSrc: getVertexShader(),
				vertexShaderEntryFn: VERTEX_SHADER_DEFAULT_ENTRY_FN,
				fragmentShaderSrc: getDebugFragmentShader(type),
				fragmentShaderEntryFn: FRAGMENT_SHADER_DEBUG_TEXTURE_ENTRY_FN,
				bindGroupLayouts: [
					PipelineStates.defaultCameraBindGroupLayout,
					PipelineStates.defaultModelBindGroupLayout,
					samplerTextureBindGroupLayout,
				],
				targets: [
					{
						format: Renderer.pixelFormat,
					},
				],
				depthStencilState: null,
			}),
		);
	}

	public override onVisibilityChange(v: boolean): void {
		this.$domContainer.style.setProperty("display", v ? "block" : "none");
	}

	override updateWorldMatrix(): boolean {
		const updated = super.updateWorldMatrix();
		const width = this.scale[0];
		const height = this.scale[1];
		const left = this.worldPosition[0] - width * 0.5;
		const bottom = this.worldPosition[1] - height * 0.5;
		this.$domContainer.style.setProperty("width", `${width}px`);
		this.$domContainer.style.setProperty("height", `${height}px`);

		this.$domContainer.style.setProperty("left", `${left}px`);
		this.$domContainer.style.setProperty("bottom", `${bottom}px`);
		return updated;
	}

	override preRender(renderEncoder: GPURenderPassEncoder): void {
		super.preRender(renderEncoder);

		renderEncoder.setBindGroup(2, this.samplerTextureBindGroup);
	}
}
