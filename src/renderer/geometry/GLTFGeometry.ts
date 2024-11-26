import { load } from "@loaders.gl/core";
import { GLTFLoader, GLTFScenegraph } from "@loaders.gl/gltf";
import Geometry from "./Geometry";
import Renderer from "../../app/Renderer";

export default class GLTFGeometry extends Geometry {
	constructor(protected url: string) {
		super();

		this.load();
	}

	protected async load(): Promise<void> {
		const gltfWithBuffers = await load(this.url, GLTFLoader);
		const gltf = new GLTFScenegraph(gltfWithBuffers);
		const { sourceBuffers } = gltf;
		console.log(gltf);

		this.vertexBuffer = Renderer.device.createBuffer({
			label: `${this.url} GLTF Model`,
			size: sourceBuffers[0].byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		});
		const srcBuffer = sourceBuffers[0].arrayBuffer;

		Renderer.device.queue.writeBuffer(this.vertexBuffer, 0, srcBuffer);
	}
}
