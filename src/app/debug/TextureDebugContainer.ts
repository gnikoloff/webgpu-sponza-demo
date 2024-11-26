import Transform from "../../renderer/scene/Transform";
import TextureDebugMesh from "./TextureDebugMesh";

export default class TextureDebugContainer extends Transform {
	public override get visible(): boolean {
		return this._visible;
	}

	public override set visible(v: boolean) {
		this._visible = v;
		for (const debugMesh of this.debugMeshes) {
			debugMesh.visible = v;
		}
	}

	constructor(private debugMeshes: TextureDebugMesh[]) {
		super();
		for (const debugMesh of this.debugMeshes) {
			this.addChild(debugMesh);
		}
	}

	public updateWorldMatrix(): boolean {
		const updated = super.updateWorldMatrix();
		for (const debugMesh of this.debugMeshes) {
			debugMesh.updateWorldMatrix();
		}
		return updated;
	}

	public relayout(
		w: number,
		h: number,
		debugMeshWidth: number = Math.min(w * 0.175, 229),
		debugMeshHeight: number = Math.min(h * 0.175, 137),
	) {
		var offsetX = debugMeshWidth * 0.5 + 10;
		for (const debugMesh of this.debugMeshes) {
			const x = offsetX;
			const y = debugMeshHeight * 0.5 + 10;
			const z = 0;
			debugMesh
				.setPosition(x, y, z)
				.setScale(debugMeshWidth, debugMeshHeight, 1)
				.updateWorldMatrix();
			offsetX += debugMeshWidth + 1;
		}
	}

	public override render(renderEncoder: GPURenderPassEncoder): void {
		if (!this.visible) {
			return;
		}
		for (const debugMesh of this.debugMeshes) {
			debugMesh.render(renderEncoder);
		}
	}
}
