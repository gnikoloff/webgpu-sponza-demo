import { Vec3, vec2, vec3 } from 'wgpu-matrix'
import RenderingContext from '../core/RenderingContext'
import VertexDescriptor from '../core/VertexDescriptor'
import BoundingBox from '../math/BoundingBox'
import VRAMUsageTracker from '../misc/VRAMUsageTracker'
import Face from './Face'

export default class Geometry {
  public faces: Face[] = []
  public boundingBox = new BoundingBox()

  public vertexBuffers: GPUBuffer[] = []
  public indexBuffer?: GPUBuffer

  public indexCount = 0

  public vertexBufferOffsets: Map<GPUBuffer, [number, number]> = new Map()
  public indexBufferOffsets: [number, number] = [0, 0]

  protected createBuffersWithTangentsManually(
    indexCount: number,
    vertices: Vec3[],
    normals: Vec3[],
    uvs: Vec3[],
    indices: Uint16Array
  ) {
    this.indexCount = indexCount

    const sdir = vec3.create()
    const tdir = vec3.create()

    const interleavedArray = new Float32Array(
      VertexDescriptor.itemsPerVertexDefaultLayout * indexCount
    )

    const tan1: Vec3[] = new Array(vertices.length)
      .fill(null)
      .map((_) => vec3.create())
    const tan2: Vec3[] = new Array(vertices.length)
      .fill(null)
      .map((_) => vec3.create())

    for (const face of this.faces) {
      handleFace(face)
    }

    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let minZ = Number.POSITIVE_INFINITY

    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let maxZ = Number.NEGATIVE_INFINITY

    for (let i = 0; i < indices.length; i += 3) {
      const idx0 = indices[i + 0]
      const idx1 = indices[i + 1]
      const idx2 = indices[i + 2]
      handleVertex(idx0)
      handleVertex(idx1)
      handleVertex(idx2)
    }

    this.boundingBox.setMinAABB(minX, minY, minZ)
    this.boundingBox.setMaxAABB(maxX, maxY, maxZ)

    function handleVertex(index: number) {
      const normal = normals[index]
      const position = vertices[index]
      const texCoord = uvs[index]
      const tangent = tan1[index]

      minX = Math.min(minX, position[0])
      minY = Math.min(minY, position[1])
      minZ = Math.min(minZ, position[2])

      maxX = Math.max(maxX, position[0])
      maxY = Math.max(maxY, position[1])
      maxZ = Math.max(maxZ, position[2])

      const t = vec3.normalize(
        vec3.sub(tangent, vec3.mulScalar(normal, vec3.dot(normal, tangent)))
      )
      const b = vec3.normalize(vec3.cross(normal, tangent))
      const handedness = vec3.dot(b, tan2[index]) < 0 ? -1 : 1
      // const vertexTangent = vec4.create(t[0], t[1], t[2], handedness);

      const startIndex = index * VertexDescriptor.itemsPerVertexDefaultLayout
      interleavedArray[startIndex + 0] = position[0]
      interleavedArray[startIndex + 1] = position[1]
      interleavedArray[startIndex + 2] = position[2]

      interleavedArray[startIndex + 3] = normal[0]
      interleavedArray[startIndex + 4] = normal[1]
      interleavedArray[startIndex + 5] = normal[2]

      interleavedArray[startIndex + 6] = texCoord[0]
      interleavedArray[startIndex + 7] = texCoord[1]

      interleavedArray[startIndex + 8] = t[0]
      interleavedArray[startIndex + 9] = t[1]
      interleavedArray[startIndex + 10] = t[2]
      interleavedArray[startIndex + 11] = handedness
    }

    function handleFace(face: Face) {
      const edge1 = vec3.sub(face.p1, face.p0)
      const edge2 = vec3.sub(face.p2, face.p0)
      const deltaUv1 = vec2.sub(face.texCoord1, face.texCoord0)
      const deltaUv2 = vec2.sub(face.texCoord2, face.texCoord0)
      const f = 1 / (deltaUv1[0] * deltaUv2[1] - deltaUv2[0] * deltaUv1[1])
      sdir[0] = f * (deltaUv2[1] * edge1[0] - deltaUv1[1] * edge2[0])
      sdir[1] = f * (deltaUv2[1] * edge1[1] - deltaUv1[1] * edge2[1])
      sdir[2] = f * (deltaUv2[1] * edge1[2] - deltaUv1[1] * edge2[2])

      tdir[0] = f * (-deltaUv2[0] * edge1[0] + deltaUv1[0] * edge2[0])
      tdir[1] = f * (-deltaUv2[0] * edge1[1] + deltaUv1[0] * edge2[1])
      tdir[2] = f * (-deltaUv2[0] * edge1[2] + deltaUv1[0] * edge2[2])

      vec3.normalize(sdir, sdir)
      vec3.normalize(tdir, tdir)

      vec3.add(tan1[face.indexV0], sdir, tan1[face.indexV0])
      vec3.add(tan1[face.indexV1], sdir, tan1[face.indexV1])
      vec3.add(tan1[face.indexV2], sdir, tan2[face.indexV2])

      vec3.add(tan2[face.indexV0], tdir, tan2[face.indexV0])
      vec3.add(tan2[face.indexV1], tdir, tan2[face.indexV1])
      vec3.add(tan2[face.indexV2], tdir, tan2[face.indexV2])
    }

    const vertexBuffer = RenderingContext.device.createBuffer({
      mappedAtCreation: true,
      size:
        indexCount *
        VertexDescriptor.itemsPerVertexDefaultLayout *
        Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.VERTEX,
      label: 'Mesh Interleaved Vertex GPUBuffer',
    })

    VRAMUsageTracker.addBufferBytes(vertexBuffer)

    const data = new Float32Array(vertexBuffer.getMappedRange())
    data.set(interleavedArray, 0)
    vertexBuffer.unmap()

    this.vertexBuffers.push(vertexBuffer)
    this.vertexBufferOffsets.set(vertexBuffer, [0, 0])

    this.indexBuffer = RenderingContext.device.createBuffer({
      mappedAtCreation: true,
      size: Uint16Array.BYTES_PER_ELEMENT * indices.length,
      usage: GPUBufferUsage.INDEX,
      label: 'Mesh Index GPUBuffer',
    })

    VRAMUsageTracker.addBufferBytes(this.indexBuffer)

    const indexData = new Uint16Array(this.indexBuffer.getMappedRange())
    indexData.set(indices)
    this.indexBuffer.unmap()
    this.indexBufferOffsets = [0, 0]
  }
}
