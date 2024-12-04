import Camera from "../../renderer/camera/Camera";
import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass, { RenderPassType } from "../../renderer/core/RenderPass";
import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import BoundingBox from "../../renderer/math/BoundingBox";
import Drawable from "../../renderer/scene/Drawable";
import Scene from "../../renderer/scene/Scene";
import DebugBoundingBoxesShaderUtils, {
	DebugBoundingBoxesFragmentShaderEntryFn,
	DebugBoundingBoxesVertexShaderEntryFn,
} from "../../renderer/shader/DebugBoundingBoxesShaderUtils";
import Renderer from "../Renderer";

export default class DebugBoundsPass extends RenderPass {
	public inPlaceTextureView: GPUTextureView;
	public inPlaceDepthStencilTextureView: GPUTextureView;

	private renderPSO: GPURenderPipeline;

	private linesDebugBindGroupLayout: GPUBindGroupLayout;
	private linesDebugBindGroup: GPUBindGroup;

	constructor(scene: Scene) {
		super(RenderPassType.DebugBounds, scene);

		const shaderModule = PipelineStates.createShaderModule(
			DebugBoundingBoxesShaderUtils,
		);

		const worldBBoxes: BoundingBox[] = [];
		console.log("----");
		scene.traverse((node) => {
			if (node instanceof Drawable) {
				if (node.worldBoundingBox.getArea() > 0) {
					worldBBoxes.push(node.worldBoundingBox);
				}
			}
		});

		const worldBBoxesBuffer = Renderer.device.createBuffer({
			label: "Debug World Bounding Boxes GPUBuffer",
			size: Float32Array.BYTES_PER_ELEMENT * 8 * worldBBoxes.length,
			mappedAtCreation: true,
			usage: GPUBufferUsage.STORAGE,
		});
		const worldBBoxesBuffContents = new Float32Array(
			worldBBoxesBuffer.getMappedRange(),
		);
		for (let i = 0; i < worldBBoxes.length; i++) {
			const bbox = worldBBoxes[i];
			worldBBoxesBuffContents[i * 8 + 0] = bbox.min[0];
			worldBBoxesBuffContents[i * 8 + 1] = bbox.min[1];
			worldBBoxesBuffContents[i * 8 + 2] = bbox.min[2];

			worldBBoxesBuffContents[i * 8 + 4] = bbox.max[0];
			worldBBoxesBuffContents[i * 8 + 5] = bbox.max[1];
			worldBBoxesBuffContents[i * 8 + 6] = bbox.max[2];
		}
		worldBBoxesBuffer.unmap();

		const targets: GPUColorTargetState[] = [
			{
				format: "rgba16float",
			},
		];

		const linesBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX,
				buffer: {
					type: "read-only-storage",
				},
			},
		];
		const linesBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: {
					buffer: worldBBoxesBuffer,
				},
			},
		];

		this.linesDebugBindGroupLayout = Renderer.device.createBindGroupLayout({
			label: "Debug Bounding Boxes Bind Group Layout",
			entries: linesBindGroupLayoutEntries,
		});
		this.linesDebugBindGroup = Renderer.device.createBindGroup({
			label: "Debug Bounding Boxes Bind Group",
			entries: linesBindGroupEntries,
			layout: this.linesDebugBindGroupLayout,
		});

		this.renderPSO = PipelineStates.createRenderPipeline({
			label: "Debug Bounding Boxes Render PSO",
			vertex: {
				module: shaderModule,
				entryPoint: DebugBoundingBoxesVertexShaderEntryFn,
			},
			fragment: {
				module: shaderModule,
				entryPoint: DebugBoundingBoxesFragmentShaderEntryFn,
				targets,
			},
			layout: Renderer.device.createPipelineLayout({
				label: "Debug Bounding Boxes Render PSO Layout",
				bindGroupLayouts: [
					PipelineStates.defaultCameraBindGroupLayout,
					this.linesDebugBindGroupLayout,
				],
			}),
			depthStencil: {
				format: Renderer.depthStencilFormat,
				depthWriteEnabled: false,
				depthCompare: "less",
			},
			primitive: {
				topology: "line-list",
			},
		});
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.inPlaceTextureView,
				loadOp: "load",
				storeOp: "store",
			},
		];
		return {
			label: `Debug Bounding Boxes Render Pass`,
			colorAttachments: renderPassColorAttachments,
			depthStencilAttachment: {
				view: this.inPlaceDepthStencilTextureView,
				depthReadOnly: true,
				stencilReadOnly: true,
			},
		};
	}

	public override render(commandEncoder: GPUCommandEncoder): void {
		Renderer.activeRenderPass = this.type;

		const renderPassEncoder = commandEncoder.beginRenderPass(
			this.createRenderPassDescriptor(),
		);
		renderPassEncoder.pushDebugGroup("Render Bounding Boxes");

		renderPassEncoder.setPipeline(this.renderPSO);
		renderPassEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.cameraBindGroup,
		);
		renderPassEncoder.setBindGroup(1, this.linesDebugBindGroup);

		renderPassEncoder.draw(2, this.scene.nodesCount * 12);

		renderPassEncoder.popDebugGroup();
		renderPassEncoder.end();
	}
}
