import { Vec2, Vec3, vec2, vec3 } from 'wgpu-matrix'
import Face from './Face'
import Geometry from './Geometry'

export default class SphereGeometry extends Geometry {
  constructor(
    public radius = 1,
    public widthSegments = 32,
    public heightSegments = 16,
    public phiStart = 0,
    public phiLength = Math.PI * 2,
    public thetaStart = 0,
    public thetaLength = Math.PI
  ) {
    super()

    widthSegments = Math.max(3, Math.floor(widthSegments))
    heightSegments = Math.max(2, Math.floor(heightSegments))

    const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI)

    let index = 0
    const grid = []

    const vertex = vec3.create()
    const normal = vec3.create()
    const uv = vec2.create()

    const vertices: Vec3[] = []
    const normals: Vec3[] = []
    const uvs: Vec2[] = []
    const indices = []

    for (let iy = 0; iy <= heightSegments; iy++) {
      const verticesRow = []

      const v = iy / heightSegments

      // special case for the poles

      let uOffset = 0

      if (iy === 0 && thetaStart === 0) {
        uOffset = 0.5 / widthSegments
      } else if (iy === heightSegments && thetaEnd === Math.PI) {
        uOffset = -0.5 / widthSegments
      }

      for (let ix = 0; ix <= widthSegments; ix++) {
        const u = ix / widthSegments

        // vertex

        vertex[0] =
          -radius *
          Math.cos(phiStart + u * phiLength) *
          Math.sin(thetaStart + v * thetaLength)
        vertex[1] = radius * Math.cos(thetaStart + v * thetaLength)
        vertex[2] =
          radius *
          Math.sin(phiStart + u * phiLength) *
          Math.sin(thetaStart + v * thetaLength)

        vertices.push(vec3.clone(vertex))
        // interleavedArray.push(vertex[0], vertex[1], vertex[2]);

        // normal

        vec3.copy(vertex, normal)
        vec3.normalize(normal, normal)
        normals.push(vec3.clone(normal))
        // interleavedArray.push(normal[0], normal[1], normal[2]);

        // uv
        uv[0] = u + uOffset
        uv[1] = 1 - v
        uvs.push(vec2.clone(uv))
        // interleavedArray.push(uvs[0], uvs[1]);

        verticesRow.push(index++)
      }

      grid.push(verticesRow)
    }

    // indices

    for (let iy = 0; iy < heightSegments; iy++) {
      for (let ix = 0; ix < widthSegments; ix++) {
        const a = grid[iy][ix + 1]
        const b = grid[iy][ix]
        const c = grid[iy + 1][ix]
        const d = grid[iy + 1][ix + 1]

        if (iy !== 0 || thetaStart > 0) {
          indices.push(a, b, d)

          const p0 = vertices[a]
          const p1 = vertices[b]
          const p2 = vertices[d]

          const n0 = normals[a]
          const n1 = normals[b]
          const n2 = normals[d]

          const texCoord0 = uvs[a]
          const texCoord1 = uvs[b]
          const texCoord2 = uvs[d]

          const face = new Face(
            a,
            b,
            d,
            p0,
            p1,
            p2,
            n0,
            n1,
            n2,
            texCoord0,
            texCoord1,
            texCoord2
          )
          this.faces.push(face)
        }
        if (iy !== heightSegments - 1 || thetaEnd < Math.PI)
          indices.push(b, c, d)

        const p0 = vertices[b]
        const p1 = vertices[c]
        const p2 = vertices[d]

        const n0 = normals[b]
        const n1 = normals[c]
        const n2 = normals[d]

        const texCoord0 = uvs[b]
        const texCoord1 = uvs[c]
        const texCoord2 = uvs[d]

        const face = new Face(
          b,
          c,
          d,
          p0,
          p1,
          p2,
          n0,
          n1,
          n2,
          texCoord0,
          texCoord1,
          texCoord2
        )
        this.faces.push(face)
      }
    }

    this.createBuffersWithTangentsManually(
      indices.length,
      // interleavedVertexArr: new Float32Array(interleavedArray),
      vertices,
      normals,
      uvs,
      new Uint16Array(indices)
    )
  }
}
