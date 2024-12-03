import { mat4 } from "wgpu-matrix";
import PipelineStates from "../../renderer/core/PipelineStates";
import { RenderPassType } from "../../renderer/core/RenderPass";
import Material from "../../renderer/material/Material";
import InstancedDrawable from "../../renderer/scene/InstancedDrawable";
import {
	FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN,
	getDefaultPBRFragmentShader,
} from "../shaders/FragmentShader";
import {
	VERTEX_SHADER_DEFAULT_ENTRY_FN,
	getVertexShader,
} from "../shaders/VertexShader";
import GeometryCache from "../utils/GeometryCache";
import MaterialCache, { GBUFFER_OUTPUT_TARGETS } from "../utils/MaterialCache";
import Renderer from "../Renderer";

export default class PBRSpheres extends InstancedDrawable {
	private static readonly AXIS_COUNT = 7;
	private static readonly AXIS_WIDTH = 7;

	constructor() {
		const instanceCount = PBRSpheres.AXIS_COUNT * PBRSpheres.AXIS_COUNT;

		super(GeometryCache.unitSphereGeometry, instanceCount);

		this.label = "PBR Instanced Spheres";

		const stencilDescriptor: GPUStencilFaceState = {
			compare: "always",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "replace",
		};
		const material = new Material({
			debugLabel: "PBR Instanced Spheres Material",
			vertexShaderSrc: getVertexShader({ isInstanced: true }),
			vertexShaderEntryFn: VERTEX_SHADER_DEFAULT_ENTRY_FN,
			fragmentShaderSrc: getDefaultPBRFragmentShader({
				hasPBRTexture: false,
				isInstanced: true,
			}),
			fragmentShaderEntryFn: FRAGMENT_SHADER_DEBUG_TEX_COORDS_ENTRY_FN,
			bindGroupLayouts: [
				PipelineStates.defaultCameraBindGroupLayout,
				PipelineStates.defaultModelBindGroupLayout,
				PipelineStates.defaultModelMaterialBindGroupLayout,
				PipelineStates.instancesBindGroupLayout,
			],
			depthStencilState: {
				format: Renderer.depthStencilFormat,
				depthWriteEnabled: true,
				depthCompare: "less",
				stencilReadMask: 0x0,
				stencilWriteMask: 0xff,
				stencilBack: stencilDescriptor,
				stencilFront: stencilDescriptor,
			},
			targets: GBUFFER_OUTPUT_TARGETS,
		});

		this.setMaterial(material, RenderPassType.Deferred);
		this.setMaterial(
			MaterialCache.defaultInstancedShadowMaterial,
			RenderPassType.Shadow,
		);

		this.materialProps.setColor(1, 1, 1);
		this.setPosition(0, 4, 0);

		this.materialProps.isReflective = false;

		let instanceOffset = 0;
		let translateMat = mat4.create();
		for (let y = 0; y < PBRSpheres.AXIS_COUNT; y++) {
			let yy =
				(y / PBRSpheres.AXIS_COUNT) * PBRSpheres.AXIS_WIDTH -
				PBRSpheres.AXIS_WIDTH * 0.375;
			for (let x = 0; x < PBRSpheres.AXIS_COUNT; x++) {
				let xx =
					(-x / PBRSpheres.AXIS_COUNT) * PBRSpheres.AXIS_WIDTH +
					PBRSpheres.AXIS_WIDTH * 0.375;

				let metallic = 1 - instanceOffset / instanceCount;
				let roughness = 1 - instanceOffset / instanceCount;

				mat4.translation(new Float32Array([xx, yy, 0]), translateMat);
				this.setMatrixAt(instanceOffset, mat4.clone(translateMat))
					.setMetallicAt(instanceOffset, metallic)
					.setRoughnessAt(instanceOffset, roughness);
				instanceOffset++;
			}
		}

		this.updateInstances();
		const s = 0.2;
		this.setScale(s, s, s).updateWorldMatrix();
	}
}
