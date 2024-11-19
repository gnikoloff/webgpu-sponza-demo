import { Renderer } from "../Renderer";

export interface CreateBuffersProps {
	vertexCount: number;
	interleavedVertexArr: Float32Array;
	indicesArr: Uint16Array;
}

export class Geometry {
	public vertexBuffer: GPUBuffer;
	public indexBuffer: GPUBuffer;
	public vertexCount = 0;

	protected createBuffers({
		vertexCount,
		interleavedVertexArr,
		indicesArr,
	}: CreateBuffersProps) {
		this.vertexCount = vertexCount;

		this.vertexBuffer = Renderer.device.createBuffer({
			mappedAtCreation: true,
			size: vertexCount * 8 * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.VERTEX,
			label: "Mesh Interleaved Vertex GPUBuffer",
		});
		const data = new Float32Array(this.vertexBuffer.getMappedRange());
		data.set(interleavedVertexArr, 0);
		this.vertexBuffer.unmap();

		this.indexBuffer = Renderer.device.createBuffer({
			mappedAtCreation: true,
			size: Uint16Array.BYTES_PER_ELEMENT * indicesArr.length,
			usage: GPUBufferUsage.INDEX,
			label: "Mesh Index GPUBuffer",
		});
		const indexData = new Uint16Array(this.indexBuffer.getMappedRange());
		indexData.set(indicesArr);
		this.indexBuffer.unmap();
	}
}
