import { mat4 } from 'wgpu-matrix'
import Camera from './Camera'

export default class OrthographicCamera extends Camera {
  public left: number
  public right: number
  public bottom: number
  public top: number

  constructor(
    left: number,
    right: number,
    top: number,
    bottom: number,
    near: number,
    far: number
  ) {
    super()
    this.left = left
    this.right = right
    this.top = top
    this.bottom = bottom
    this.near = near
    this.far = far
    this.updateProjectionMatrix()
  }

  public override onResize(w: number, h: number): void {
    super.onResize(w, h)
    this.left = 0
    this.right = w
    this.top = h
    this.bottom = 0
    this.updateProjectionMatrix()
  }

  public override updateProjectionMatrix(): this {
    mat4.ortho(
      this.left,
      this.right,
      this.bottom,
      this.top,
      this.near,
      this.far,
      this.projectionMatrix
    )
    super.updateProjectionMatrix()
    this.updateProjectionViewMatrix()
    return this
  }
}
