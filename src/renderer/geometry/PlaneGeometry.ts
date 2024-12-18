import { Vec2, Vec3, vec2, vec3 } from 'wgpu-matrix'
import Face from './Face'
import Geometry from './Geometry'

export default class PlaneGeometry extends Geometry {
  constructor(
    public width = 1,
    public height = 1,
    public widthSegments = 1,
    public heightSegments = 1
  ) {
    super()

    const halfWidth = width * 0.5
    const halfHeight = height * 0.5

    const gridX1 = widthSegments + 1
    const gridY1 = heightSegments + 1

    const gridX = Math.floor(widthSegments)
    const gridY = Math.floor(heightSegments)

    const segmentWidth = width / widthSegments
    const segmentHeight = height / heightSegments

    const indices: number[] = []
    const vertices: Vec3[] = []
    const normals: Vec3[] = []
    const uvs: Vec2[] = []

    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segmentHeight - halfHeight

      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segmentWidth - halfWidth

        vertices.push(vec3.create(x, -y, 0))
        normals.push(vec3.create(0, 0, 1))
        uvs.push(vec2.create(ix / gridX, 1 - iy / gridY))
      }
    }

    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = ix + gridX1 * iy
        const b = ix + gridX1 * (iy + 1)
        const c = ix + 1 + gridX1 * (iy + 1)
        const d = ix + 1 + gridX1 * iy

        indices.push(a, b, d)

        const face0 = new Face(
          a,
          b,
          d,
          vertices[a],
          vertices[b],
          vertices[d],
          normals[a],
          normals[b],
          normals[d],
          uvs[a],
          uvs[b],
          uvs[d]
        )
        this.faces.push(face0)

        indices.push(b, c, d)

        const face1 = new Face(
          b,
          c,
          d,
          vertices[b],
          vertices[c],
          vertices[d],
          normals[b],
          normals[c],
          normals[d],
          uvs[b],
          uvs[c],
          uvs[d]
        )
        this.faces.push(face1)
      }
    }

    this.createBuffersWithTangentsManually(
      indices.length,
      vertices,
      normals,
      uvs,
      new Uint16Array(indices)
    )
  }
}
