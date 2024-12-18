import LineDebugDrawable from '../../app/debug/LineDebugDrawable'
import Camera from '../camera/Camera'
import LightingManager from '../lighting/LightingManager'
import { placeholderFunc } from '../types'
import Drawable from './Drawable'
import Node from './Node'

export default class Scene extends Node {
  public skybox: Drawable

  public debugMeshes: Node[] = []
  public opaqueMeshes: Drawable[] = []
  public transparentMeshes: Drawable[] = []
  public lightingManager: LightingManager

  private culledOpaqueMeshes: Drawable[] = []
  private culledTransparentMeshes: Drawable[] = []

  private nonCulledTransparentCount = 0
  private nonCulledOpaqueCount = 0

  private onGraphChangedCallbacks: placeholderFunc[] = []

  public get nodesCount(): number {
    return this.opaqueMeshes.length + this.transparentMeshes.length
  }

  public get visibleNodesCount(): number {
    return this.nonCulledOpaqueCount + this.nonCulledTransparentCount
  }

  public addOnGraphChangedCallback(v: placeholderFunc) {
    this.onGraphChangedCallbacks.push(v)
  }

  public renderDebugMeshes(renderPassEncoder: GPURenderPassEncoder) {
    for (const debugMesh of this.debugMeshes) {
      debugMesh.render(renderPassEncoder)
    }
  }

  public renderOpaqueNodes(
    renderPassEncoder: GPURenderPassEncoder,
    camera?: Camera
  ) {
    if (!camera) {
      for (const mesh of this.opaqueMeshes) {
        mesh.render(renderPassEncoder)
      }
      return
    }

    const nonCulledCount = camera.cullMeshes(
      this.opaqueMeshes,
      this.culledOpaqueMeshes
    )

    this.nonCulledOpaqueCount = nonCulledCount

    for (let i = 0; i < nonCulledCount; i++) {
      this.culledOpaqueMeshes[i].render(renderPassEncoder)
    }
  }

  public renderTransparentNodes(
    renderPassEncoder: GPURenderPassEncoder,
    camera?: Camera
  ) {
    if (!camera) {
      for (const mesh of this.transparentMeshes) {
        mesh.render(renderPassEncoder)
      }
      return
    }
    const nonCulledCount = camera.cullMeshes(
      this.transparentMeshes,
      this.culledTransparentMeshes
    )

    this.nonCulledTransparentCount = nonCulledCount

    for (let i = 0; i < nonCulledCount; i++) {
      this.culledTransparentMeshes[i].render(renderPassEncoder)
    }
  }

  protected override onChildAdd(child: Node): void {
    if (child instanceof Drawable) {
      if (child.isOpaque) {
        this.opaqueMeshes.push(child)
        this.culledOpaqueMeshes.push(child)
      } else {
        this.transparentMeshes.push(child)
        this.culledTransparentMeshes.push(child)
      }
    }

    if (child instanceof LineDebugDrawable) {
      this.debugMeshes.push(child)
    }

    for (const callback of this.onGraphChangedCallbacks) {
      callback()
    }
  }

  protected override onChildRemove(child: Node): void {
    super.onChildRemove(child)

    const filterOut = ({ id }: Node) => id !== child.id

    if (child instanceof Drawable) {
      if (child.isOpaque) {
        this.opaqueMeshes = this.opaqueMeshes.filter(filterOut)
        this.culledOpaqueMeshes = this.culledOpaqueMeshes.filter(filterOut)
      } else {
        this.transparentMeshes = this.transparentMeshes.filter(filterOut)
        this.culledTransparentMeshes =
          this.culledTransparentMeshes.filter(filterOut)
      }
    }

    for (const callback of this.onGraphChangedCallbacks) {
      callback()
    }
  }
}
