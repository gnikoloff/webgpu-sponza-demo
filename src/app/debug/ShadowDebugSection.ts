import DebugSection, { DebugSectionType } from "./DebugSection";
import DebugTextureCanvas, { TextureDebugMeshType } from "./DebugTextureCanvas";

export default class ShadowDebugSection extends DebugSection {
	constructor() {
		super(DebugSectionType.Shadow);

		const shadowCascade0Debug = new DebugTextureCanvas(
			TextureDebugMeshType.ShadowDepthCascade0,
		);
		shadowCascade0Debug.appendTo(this.$main);
		this.canvases.set(
			TextureDebugMeshType.ShadowDepthCascade0,
			shadowCascade0Debug,
		);

		const shadowCascade1Debug = new DebugTextureCanvas(
			TextureDebugMeshType.ShadowDepthCascade1,
		);
		shadowCascade1Debug.appendTo(this.$main);
		this.canvases.set(
			TextureDebugMeshType.ShadowDepthCascade1,
			shadowCascade1Debug,
		);
	}
}
