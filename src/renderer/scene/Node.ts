import { Mat4, Quat, Vec3, mat3, mat4, quat, vec3 } from 'wgpu-matrix'
import { MAT4x4_IDENTITY_MATRIX, QUATERNION_COMP_ORDER } from '../math/math'
import { UUIDString } from '../types'

export default class Node {
  private _position = vec3.fromValues(0, 0, 0)
  private _rotation = vec3.fromValues(0, 0, 0)
  private _scale = vec3.fromValues(1, 1, 1)
  private _worldPosition = vec3.create()

  protected translateMatrix = mat4.identity()
  protected scaleMatrix = mat4.identity()
  protected rotationMatrix = mat4.identity()
  protected cachedMatrix = mat4.create()
  protected worldMatrix = mat4.identity()
  protected normalMatrix = mat3.create()
  protected quaternion = quat.create()
  protected prevFrameModelMatrix = mat4.create()
  private _customMatrix?: Mat4
  protected matrixNeedsUpdate = true

  public id: UUIDString = crypto.randomUUID()
  public label = 'Object'

  public parent?: Node
  public children: Node[] = []

  protected _visible = true
  public get visible(): boolean {
    return this._visible
  }
  public set visible(v: boolean) {
    this.onVisibilityChange(v)
    this._visible = v
  }

  public get modelMatrix(): Float32Array {
    return this.worldMatrix
  }

  public setCustomMatrix(v: Mat4) {
    this._customMatrix = v
    this.matrixNeedsUpdate = true
  }

  public setCustomMatrixFromTRS(
    translation: Vec3,
    rotation: Quat,
    scale: Vec3
  ) {
    const modelMatrix = mat4.scaling(scale)
    const rotateMat = mat4.fromQuat(rotation)
    const translateMat = mat4.translation(translation)
    mat4.mul(modelMatrix, rotateMat, modelMatrix)
    mat4.mul(modelMatrix, translateMat)

    this.setCustomMatrix(modelMatrix)
  }

  private updateNormalMatrix() {
    mat3.fromMat4(this.worldMatrix, this.normalMatrix)
    mat3.inverse(this.normalMatrix, this.normalMatrix)
    mat3.transpose(this.normalMatrix, this.normalMatrix)
  }

  public updateWorldMatrix(): boolean {
    const parentMatrix = this.parent?.worldMatrix ?? MAT4x4_IDENTITY_MATRIX
    if (!this.matrixNeedsUpdate) {
      mat4.mul(parentMatrix, this.cachedMatrix, this.worldMatrix)
      mat4.copy(this.worldMatrix, this.prevFrameModelMatrix)
      this.updateNormalMatrix()
      return false
    }

    if (this._customMatrix) {
      mat4.copy(this._customMatrix, this.cachedMatrix)
    } else {
      mat4.identity(this.scaleMatrix)
      mat4.scale(this.scaleMatrix, this.scale, this.scaleMatrix)
      this.quaternion = quat.fromEuler(
        this.rotation[0],
        this.rotation[1],
        this.rotation[2],
        QUATERNION_COMP_ORDER
      )
      mat4.fromQuat(this.quaternion, this.rotationMatrix)
      mat4.identity(this.translateMatrix)
      mat4.translate(this.translateMatrix, this.position, this.translateMatrix)

      mat4.mul(this.scaleMatrix, this.rotationMatrix, this.cachedMatrix)
      mat4.mul(this.translateMatrix, this.cachedMatrix, this.cachedMatrix)
    }

    mat4.mul(parentMatrix, this.cachedMatrix, this.worldMatrix)
    mat4.copy(this.worldMatrix, this.prevFrameModelMatrix)
    this.updateNormalMatrix()

    this.matrixNeedsUpdate = false

    return true
  }

  public onVisibilityChange(_v: boolean) {
    // ...
  }

  public addChild(child: Node) {
    child.parent = this
    this.children.push(child)
    child.updateWorldMatrix()
    this.onChildAdd(child)
  }

  public removeChild(child: Node) {
    this.children = this.children.filter(({ id }) => id != child.id)
    child.parent = null
    this.onChildRemove(child)
  }

  protected onChildAdd(child: Node) {
    this.parent?.onChildAdd(child)
  }

  protected onChildRemove(child: Node) {
    this.parent?.onChildRemove(child)
  }

  public traverse(traverseFn: (node: Node) => void, recursive = true) {
    traverseFn(this)
    if (recursive) {
      for (const child of this.children) {
        child.traverse(traverseFn, recursive)
      }
    }
  }

  public findChild(traverseFn: (node: Node) => boolean): Node {
    const found = traverseFn(this)
    if (found) {
      return this
    }
    for (const child of this.children) {
      const found = child.findChild(traverseFn)
      if (found) {
        return child
      }
    }
  }

  public findChildByLabel(label: string): Node {
    return this.findChild(({ label: nodeLabel }) => label === nodeLabel)
  }

  public findChildById(id: UUIDString): Node {
    return this.findChild(({ id: nodeId }) => id === nodeId)
  }

  public preRender(_renderEncoder: GPURenderPassEncoder) {
    // noop
  }

  public onRender(_renderEncoder: GPURenderPassEncoder) {
    // noop
  }

  public postRender(_renderEncoder: GPURenderPassEncoder) {
    // noop
  }

  public render(renderEncoder: GPURenderPassEncoder) {
    if (!this.visible) {
      return
    }

    this.preRender(renderEncoder)
    this.onRender(renderEncoder)
    this.postRender(renderEncoder)
  }

  public get worldPosition(): Vec3 {
    return this.getWorldPosition()
  }

  public getWorldPosition(): Vec3 {
    this._worldPosition[0] = this.worldMatrix[12]
    this._worldPosition[1] = this.worldMatrix[13]
    this._worldPosition[2] = this.worldMatrix[14]
    return this._worldPosition
  }

  public setPositionAsVec3(xyz: Vec3): this {
    vec3.clone(xyz, this._position)
    this.matrixNeedsUpdate = true
    return this
  }

  public setPosition(x: number, y: number, z: number): this {
    this._position[0] = x
    this._position[1] = y
    this._position[2] = z
    this.matrixNeedsUpdate = true
    return this
  }

  public setPositionX(v: number): this {
    this._position[0] = v
    this.matrixNeedsUpdate = true
    return this
  }

  public setPositionY(v: number): this {
    this._position[1] = v
    this.matrixNeedsUpdate = true
    return this
  }

  public setPositionZ(v: number): this {
    this._position[2] = v
    this.matrixNeedsUpdate = true
    return this
  }

  public get position(): Float32Array {
    return this.getPosition()
  }

  public getPosition(): Float32Array {
    return this._position
  }

  public getPositionX(): number {
    return this._position[0]
  }

  public getPositionY(): number {
    return this._position[1]
  }

  public getPositionZ(): number {
    return this._position[2]
  }

  public setRotation(x: number, y: number, z: number): this {
    this._rotation[0] = x
    this._rotation[1] = y
    this._rotation[2] = z
    this.matrixNeedsUpdate = true
    return this
  }

  public setRotationX(v: number): this {
    this._rotation[0] = v
    this.matrixNeedsUpdate = true
    return this
  }

  public setRotationY(v: number): this {
    this._rotation[1] = v
    this.matrixNeedsUpdate = true
    return this
  }

  public setRotationZ(v: number): this {
    this._rotation[2] = v
    this.matrixNeedsUpdate = true
    return this
  }

  public get rotation(): Float32Array {
    return this.getRotation()
  }

  public getRotation(): Float32Array {
    return this._rotation
  }

  public getRotationX(): number {
    return this._rotation[0]
  }

  public getRotationY(): number {
    return this._rotation[1]
  }

  public getRotationZ(): number {
    return this._rotation[2]
  }

  public setScale(x: number, y: number, z: number): this {
    this._scale[0] = x
    this._scale[1] = y
    this._scale[2] = z
    this.matrixNeedsUpdate = true
    return this
  }

  public setScaleX(v: number): this {
    this._scale[0] = v

    this.matrixNeedsUpdate = true
    return this
  }

  public setScaleY(v: number): this {
    this._scale[1] = v
    this.matrixNeedsUpdate = true
    return this
  }

  public setScaleZ(v: number): this {
    this._scale[2] = v
    this.matrixNeedsUpdate = true
    return this
  }

  public get scale(): Float32Array {
    return this.getScale()
  }

  public getScale(): Float32Array {
    return this._scale
  }

  public getScaleX(): number {
    return this._scale[0]
  }

  public getScaleY(): number {
    return this._scale[1]
  }

  public getScaleZ(): number {
    return this._scale[2]
  }
}
