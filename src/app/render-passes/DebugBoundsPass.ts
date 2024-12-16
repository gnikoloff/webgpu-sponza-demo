import PipelineStates from "../../renderer/core/PipelineStates";
import RenderPass from "../../renderer/core/RenderPass";
import { BIND_GROUP_LOCATIONS } from "../../renderer/core/RendererBindings";
import RenderingContext from "../../renderer/core/RenderingContext";
import BoundingBox from "../../renderer/math/BoundingBox";
import VRAMUsageTracker from "../../renderer/misc/VRAMUsageTracker";
import Drawable from "../../renderer/scene/Drawable";
import Scene from "../../renderer/scene/Scene";
import DebugBoundingBoxesShaderUtils, {
	DebugBoundingBoxesFragmentShaderEntryFn,
	DebugBoundingBoxesVertexShaderEntryFn,
} from "../../renderer/shader/DebugBoundingBoxesShaderUtils";
import { RenderPassType } from "../../renderer/types";

export default class DebugBoundsPass extends RenderPass {
	private renderPSO: GPURenderPipeline;

	private linesDebugBindGroupLayout: GPUBindGroupLayout;
	private linesDebugBindGroup: GPUBindGroup;

	private scene!: Scene;
	private worldBBoxesBuffer!: GPUBuffer;
	private worldBBoxes: Map<string, BoundingBox> = new Map();

	constructor(width: number, height: number) {
		super(RenderPassType.DebugBounds, width, height);

		const shaderModule = PipelineStates.createShaderModule(
			DebugBoundingBoxesShaderUtils,
		);

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

		this.linesDebugBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "Debug Bounding Boxes Bind Group Layout",
				entries: linesBindGroupLayoutEntries,
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
			layout: RenderingContext.device.createPipelineLayout({
				label: "Debug Bounding Boxes Render PSO Layout",
				bindGroupLayouts: [
					PipelineStates.defaultCameraBindGroupLayout,
					this.linesDebugBindGroupLayout,
				],
			}),
			depthStencil: {
				format: RenderingContext.depthStencilFormat,
				depthWriteEnabled: false,
				depthCompare: "less",
			},
			primitive: {
				topology: "line-list",
			},
		});
	}

	public setScene(scene: Scene): this {
		if (this.scene) {
			return;
		}
		this.scene = scene;

		this.scene.addOnGraphChangedCallback(() => {
			let newNodesAdded = false;
			this.scene.traverse((node) => {
				if (this.worldBBoxes.has(node.id)) {
					return;
				}
				newNodesAdded = true;

				if (node instanceof Drawable) {
					if (node.worldBoundingBox.getArea() > 0) {
						this.worldBBoxes.set(node.id, node.worldBoundingBox);
					}
				}
			});

			if (newNodesAdded && this.worldBBoxesBuffer) {
				VRAMUsageTracker.removeBufferBytes(this.worldBBoxesBuffer);
				this.worldBBoxesBuffer.destroy();
			}

			this.worldBBoxesBuffer = RenderingContext.device.createBuffer({
				label: "Debug World Bounding Boxes GPUBuffer",
				size: Float32Array.BYTES_PER_ELEMENT * 8 * this.worldBBoxes.size,
				mappedAtCreation: true,
				usage: GPUBufferUsage.STORAGE,
			});

			VRAMUsageTracker.addBufferBytes(this.worldBBoxesBuffer);

			const worldBBoxesBuffContents = new Float32Array(
				this.worldBBoxesBuffer.getMappedRange(),
			);
			let i = 0;
			for (const bbox of this.worldBBoxes.values()) {
				worldBBoxesBuffContents[i * 8 + 0] = bbox.min[0];
				worldBBoxesBuffContents[i * 8 + 1] = bbox.min[1];
				worldBBoxesBuffContents[i * 8 + 2] = bbox.min[2];

				worldBBoxesBuffContents[i * 8 + 4] = bbox.max[0];
				worldBBoxesBuffContents[i * 8 + 5] = bbox.max[1];
				worldBBoxesBuffContents[i * 8 + 6] = bbox.max[2];
				i++;
			}
			this.worldBBoxesBuffer.unmap();

			const linesBindGroupEntries: GPUBindGroupEntry[] = [
				{
					binding: 0,
					resource: {
						buffer: this.worldBBoxesBuffer,
					},
				},
			];
			this.linesDebugBindGroup = RenderingContext.device.createBindGroup({
				label: "Debug Bounding Boxes Bind Group",
				entries: linesBindGroupEntries,
				layout: this.linesDebugBindGroupLayout,
			});
		});

		return this;
	}

	protected override createRenderPassDescriptor(): GPURenderPassDescriptor {
		if (this.renderPassDescriptor) {
			return this.renderPassDescriptor;
		}
		const renderPassColorAttachments: GPURenderPassColorAttachment[] = [
			{
				view: this.inputTextureViews[0],
				loadOp: "load",
				storeOp: "store",
			},
		];
		this.renderPassDescriptor = {
			label: `Debug Bounding Boxes Render Pass`,
			colorAttachments: renderPassColorAttachments,
			depthStencilAttachment: {
				view: this.inputTextureViews[1],
				depthReadOnly: true,
				stencilReadOnly: true,
			},
		};
		return this.renderPassDescriptor;
	}

	public override render(
		commandEncoder: GPUCommandEncoder,
		_scene: Scene,
		inputs: GPUTexture[],
	): GPUTexture[] {
		if (!this.inputTextureViews.length) {
			this.inputTextureViews.push(inputs[0].createView());
			this.inputTextureViews.push(inputs[1].createView());
		}

		const renderPassEncoder = commandEncoder.beginRenderPass(
			this.createRenderPassDescriptor(),
		);

		RenderingContext.setActiveRenderPass(this.type, renderPassEncoder);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPassEncoder.pushDebugGroup("Render Bounding Boxes");
		}

		renderPassEncoder.setPipeline(this.renderPSO);
		renderPassEncoder.setBindGroup(
			BIND_GROUP_LOCATIONS.CameraPlusOptionalLights,
			this.cameraBindGroup,
		);
		renderPassEncoder.setBindGroup(1, this.linesDebugBindGroup);

		renderPassEncoder.draw(2, this.scene.nodesCount * 12);

		if (RenderingContext.ENABLE_DEBUG_GROUPS) {
			renderPassEncoder.popDebugGroup();
		}
		renderPassEncoder.end();

		this.postRender(commandEncoder);

		return [inputs[0]];
	}
}
