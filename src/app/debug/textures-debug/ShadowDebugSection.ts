import { TextureDebugMeshType } from "../../../types";
import DebugTextureCanvas from "./DebugTextureCanvas";
import TexturesDebugSection, { DebugSectionType } from "./TexturesDebugSection";

export default class ShadowDebugSection extends TexturesDebugSection {
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

		const momentsShadowCascade0Debug = new DebugTextureCanvas(
			TextureDebugMeshType.DepthMomentsCascade0,
		);
		momentsShadowCascade0Debug.appendTo(this.$main);
		this.canvases.set(
			TextureDebugMeshType.DepthMomentsCascade0,
			momentsShadowCascade0Debug,
		);

		const shadowCascade1Debug = new DebugTextureCanvas(
			TextureDebugMeshType.ShadowDepthCascade1,
		);
		shadowCascade1Debug.appendTo(this.$main);
		this.canvases.set(
			TextureDebugMeshType.ShadowDepthCascade1,
			shadowCascade1Debug,
		);

		const momentsShadowCascade1Debug = new DebugTextureCanvas(
			TextureDebugMeshType.DepthMomentsCascade1,
		);
		momentsShadowCascade1Debug.appendTo(this.$main);
		this.canvases.set(
			TextureDebugMeshType.DepthMomentsCascade1,
			momentsShadowCascade1Debug,
		);
	}
}
