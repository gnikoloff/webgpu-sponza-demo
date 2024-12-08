import DebugSection, { DebugSectionType } from "./DebugSection";
import DebugTextureCanvas, { TextureDebugMeshType } from "./DebugTextureCanvas";

export default class GBufferDebugSection extends DebugSection {
	constructor() {
		super(DebugSectionType.GBuffer);

		const albedoDebug = new DebugTextureCanvas(TextureDebugMeshType.Albedo);
		albedoDebug.appendTo(this.$main);
		this.canvases.set(TextureDebugMeshType.Albedo, albedoDebug);

		const normalDebug = new DebugTextureCanvas(TextureDebugMeshType.Normal);
		normalDebug.appendTo(this.$main);
		this.canvases.set(TextureDebugMeshType.Normal, normalDebug);

		const metallicDebug = new DebugTextureCanvas(TextureDebugMeshType.Metallic);
		metallicDebug.appendTo(this.$main);
		this.canvases.set(TextureDebugMeshType.Metallic, metallicDebug);

		const roughnessDebug = new DebugTextureCanvas(
			TextureDebugMeshType.Roughness,
		);
		roughnessDebug.appendTo(this.$main);
		this.canvases.set(TextureDebugMeshType.Roughness, roughnessDebug);

		const aoDebug = new DebugTextureCanvas(TextureDebugMeshType.AO);
		aoDebug.appendTo(this.$main);
		this.canvases.set(TextureDebugMeshType.AO, aoDebug);

		const reflectanceDebug = new DebugTextureCanvas(
			TextureDebugMeshType.Reflectance,
		);
		reflectanceDebug.appendTo(this.$main);
		this.canvases.set(TextureDebugMeshType.Reflectance, reflectanceDebug);

		const depthDebug = new DebugTextureCanvas(TextureDebugMeshType.Depth);
		depthDebug.appendTo(this.$main);
		this.canvases.set(TextureDebugMeshType.Depth, depthDebug);

		const velocityDebug = new DebugTextureCanvas(TextureDebugMeshType.Velocity);
		velocityDebug.appendTo(this.$main);
		this.canvases.set(TextureDebugMeshType.Velocity, velocityDebug);
	}
}
