import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils'
import { Vec3, vec3 } from 'wgpu-matrix'
import { SHADER_CHUNKS } from '../../renderer/shader/chunks'
import { ILightParticle } from '../../types'

const particleShaderDefs = makeShaderDataDefinitions(SHADER_CHUNKS.Particle)
const particleStorageView = makeStructuredView(
  particleShaderDefs.structs.Particle
)
export default class LightParticle {
  public static readonly STRUCT_BYTE_SIZE =
    particleStorageView.arrayBuffer.byteLength
  public static readonly STRUCT_FLOATS_COUNT =
    LightParticle.STRUCT_BYTE_SIZE / Float32Array.BYTES_PER_ELEMENT

  public static readonly RADIUS_OFFSET =
    particleStorageView.views.radius.byteOffset / Float32Array.BYTES_PER_ELEMENT
  public static readonly POSITION_OFFSET =
    particleStorageView.views.position.byteOffset /
    Float32Array.BYTES_PER_ELEMENT
  public static readonly ORIG_POSITION_OFFSET =
    particleStorageView.views.origPosition.byteOffset /
    Float32Array.BYTES_PER_ELEMENT
  public static readonly VELOCITY_OFFSET =
    particleStorageView.views.velocity.byteOffset /
    Float32Array.BYTES_PER_ELEMENT
  public static readonly LIFE_OFFSET =
    particleStorageView.views.life.byteOffset / Float32Array.BYTES_PER_ELEMENT
  public static readonly LIFE_SPEED_OFFSET =
    particleStorageView.views.lifeSpeed.byteOffset /
    Float32Array.BYTES_PER_ELEMENT

  public radius: number
  public position: Vec3
  public origPosition: Vec3
  public velocity: Vec3
  public lifeSpeed: number
  public life: number

  constructor(
    { radius, position, velocity, lifeSpeed, life }: ILightParticle = {
      radius: 1,
      position: vec3.create(0, 3, 0),
      velocity: vec3.create(0, 1, 0),
      lifeSpeed: 1,
      life: 0,
    }
  ) {
    this.radius = radius
    this.position = position
    this.origPosition = position
    this.velocity = velocity
    this.lifeSpeed = lifeSpeed
    this.life = life
  }
}
