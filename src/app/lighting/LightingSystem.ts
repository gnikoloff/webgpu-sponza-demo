import { Vec3, vec3 } from 'wgpu-matrix'
import PipelineStates from '../../renderer/core/PipelineStates'
import RenderingContext from '../../renderer/core/RenderingContext'
import DirectionalLight from '../../renderer/lighting/DirectionalLight'
import Light from '../../renderer/lighting/Light'
import LightingManager from '../../renderer/lighting/LightingManager'
import PointLight from '../../renderer/lighting/PointLight'
import Drawable from '../../renderer/scene/Drawable'
import LightParticle from './LightParticle'

import CameraFaceCulledPointLight from '../../renderer/lighting/CameraFaceCulledPointLight'
import VRAMUsageTracker from '../../renderer/misc/VRAMUsageTracker'
import { SUN_LOAD_START_INTENSITY, SUN_LOAD_START_POSITION } from '../constants'
import {
  PARTICLES_RENDER_SHADER_SRC,
  PARTICLES_SHADER_FRAGMENT_ENTRY_FN,
  PARTICLES_SHADER_VERTEX_ENTRY_FN,
} from '../shaders/PointLightsRenderShader'
import {
  POINT_LIGHTS_SHADER_COMPUTE_ENTRY_FN,
  POINT_LIGHTS_UPDATE_SHADER_SRC,
} from '../shaders/PointLightsUpdateShader'

const MAIN_LAMP_POINT_LIGHT_POSITIONS: Vec3[] = [
  vec3.create(3.9, 3, 0.9),
  vec3.create(3.9, 3, -1.5),
  vec3.create(-4.95, 3, 0.9),
  vec3.create(-4.95, 3, -1.5),
]

const FIRE_PARTICLE_EMITTER_POSITIONS: Vec3[] = [
  vec3.create(3.9, 3, 1.15),
  vec3.create(3.9, 3, -1.75),
  vec3.create(-4.95, 3, 1.15),
  vec3.create(-4.95, 3, -1.75),
]

const FIRE_PARTICLE_COLOR = vec3.scale(vec3.create(1, 0.01, 0.01), 10)

export default class LightingSystem extends LightingManager {
  private static readonly COMPUTE_WORKGROUP_SIZE_X = 64
  private static readonly COMPUTE_WORKGROUP_SIZE_Y = 1

  private static readonly MAIN_FIRE_LIGHT_RADIUS = 3
  private static readonly MAIN_FIRE_LIGHT_INTENSITY = 0.3

  private static readonly PARTICLES_PER_FIRE = 64
  private static readonly PARTICLES_PER_CURVE = 150
  private static readonly PARTICLES_PER_CORRIDOR = 32

  private particlesGPUBuffer!: GPUBuffer
  private particles: LightParticle[] = []
  private particlesLength: number

  private mainFireLights: CameraFaceCulledPointLight[] = []

  private computePSO: GPUComputePipeline
  private renderPSO: GPURenderPipeline
  private computeBindGroup: GPUBindGroup
  private renderBindGroup: GPUBindGroup
  private particleIndexBuffer: GPUBuffer
  private particleSimSettingsBuffer: GPUBuffer
  private fireParticlesRevealBuffer: GPUBuffer
  private particlesSimSettingsArr = new Float32Array(2).fill(0)

  public mainDirLight: DirectionalLight
  public render2ndFloorParticles = true

  private uploadMainDirLightToGPU() {
    RenderingContext.device.queue.writeBuffer(
      this.gpuBuffer,
      0,
      this.mainDirLight.lightsStorageView.arrayBuffer
    )
  }

  public set sunIntensity(v: number) {
    this.mainDirLight.intensity = v
    this.uploadMainDirLightToGPU()
  }

  public set sunPositionX(v: number) {
    this.mainDirLight.setPositionX(v)
    this.uploadMainDirLightToGPU()
  }

  public set sunPositionY(v: number) {
    this.mainDirLight.setPositionY(v)
    this.uploadMainDirLightToGPU()
  }

  public set sunPositionZ(v: number) {
    this.mainDirLight.setPositionZ(v)
    this.uploadMainDirLightToGPU()
  }

  public addParticleLight(
    v: Light,
    pRadius = 0.05,
    pLife = 0,
    pLifeSpeed = Math.random() * 1.5 + 0.35,
    pVelocity = vec3.create(0, 0.5, 0)
  ): this {
    super.addLight(v)

    const p = new LightParticle({
      radius: pRadius,
      position: v.position,
      velocity: pVelocity,
      lifeSpeed: pLifeSpeed,
      life: pLife,
    })
    this.particles.push(p)

    return this
  }

  public updateParticlesBuffer() {
    if (this.particlesGPUBuffer) {
      VRAMUsageTracker.removeBufferBytes(this.particlesGPUBuffer)
      this.particlesGPUBuffer.destroy()
    }

    this.particlesGPUBuffer = RenderingContext.device.createBuffer({
      label: 'Light Particles GPU Buffer',
      size: LightParticle.STRUCT_BYTE_SIZE * this.particles.length,
      mappedAtCreation: true,
      usage: GPUBufferUsage.STORAGE,
    })
    VRAMUsageTracker.addBufferBytes(this.particlesGPUBuffer)

    const particlesGPUBufferContents = new Float32Array(
      this.particlesGPUBuffer.getMappedRange()
    )

    for (let i = 0; i < this.particles.length; i++) {
      const offset = i * LightParticle.STRUCT_FLOATS_COUNT
      const posOffset = offset + LightParticle.POSITION_OFFSET
      const origPosOffset = offset + LightParticle.ORIG_POSITION_OFFSET
      const velocityOffset = offset + LightParticle.VELOCITY_OFFSET
      const lifeOffset = offset + LightParticle.LIFE_OFFSET
      const lifeSpeedOffset = offset + LightParticle.LIFE_SPEED_OFFSET
      const radiusOffset = offset + LightParticle.RADIUS_OFFSET

      particlesGPUBufferContents[posOffset + 0] = this.particles[i].position[0]
      particlesGPUBufferContents[posOffset + 1] = this.particles[i].position[1]
      particlesGPUBufferContents[posOffset + 2] = this.particles[i].position[2]

      particlesGPUBufferContents[origPosOffset + 0] =
        this.particles[i].origPosition[0]
      particlesGPUBufferContents[origPosOffset + 1] =
        this.particles[i].origPosition[1]
      particlesGPUBufferContents[origPosOffset + 2] =
        this.particles[i].origPosition[2]

      particlesGPUBufferContents[velocityOffset + 0] =
        this.particles[i].velocity[0]
      particlesGPUBufferContents[velocityOffset + 1] =
        this.particles[i].velocity[1]
      particlesGPUBufferContents[velocityOffset + 2] =
        this.particles[i].velocity[2]

      particlesGPUBufferContents[lifeOffset] = this.particles[i].life

      particlesGPUBufferContents[lifeSpeedOffset] = this.particles[i].lifeSpeed

      particlesGPUBufferContents[radiusOffset] = this.particles[i].radius
    }

    this.particlesGPUBuffer.unmap()

    this.particles = null
  }

  public set fireParticlesRevealFactor(v: number) {
    this.updateFireParticlesRevealBuffer(v)
    for (const p of this.mainFireLights) {
      p.radius = LightingSystem.MAIN_FIRE_LIGHT_RADIUS * v
      p.intensity = LightingSystem.MAIN_FIRE_LIGHT_INTENSITY * v
      p.updateGPUBuffer()
    }
  }

  private updateFireParticlesRevealBuffer(v: number) {
    RenderingContext.device.queue.writeBuffer(
      this.fireParticlesRevealBuffer,
      0,
      new Float32Array([v])
    )
  }

  constructor(curvePoints: Vec3[]) {
    super()

    const dirLight = new DirectionalLight()
    dirLight.setPositionAsVec3(SUN_LOAD_START_POSITION)
    dirLight.setColor(0.2156, 0.2627, 0.3333)
    dirLight.intensity = SUN_LOAD_START_INTENSITY
    this.addLight(dirLight)
    this.mainDirLight = dirLight

    const p = new CameraFaceCulledPointLight()
    p.radius = 0 // LightingSystem.MAIN_FIRE_LIGHT_RADIUS
    p.intensity = 0 // LightingSystem.MAIN_FIRE_LIGHT_INTENSITY
    p.setPositionAsVec3(MAIN_LAMP_POINT_LIGHT_POSITIONS[0])
    p.setColorAsVec3(FIRE_PARTICLE_COLOR)
    p.updateGPUBuffer()
    this.addLight(p)
    this.mainFireLights.push(p)

    const p2 = new CameraFaceCulledPointLight()
    p2.radius = 0 // LightingSystem.MAIN_FIRE_LIGHT_RADIUS
    p2.intensity = 0 // LightingSystem.MAIN_FIRE_LIGHT_INTENSITY
    p2.setPositionAsVec3(MAIN_LAMP_POINT_LIGHT_POSITIONS[1])
    p2.setColorAsVec3(FIRE_PARTICLE_COLOR)
    p2.updateGPUBuffer()
    this.addLight(p2)
    this.mainFireLights.push(p2)

    const p3 = new CameraFaceCulledPointLight()
    p3.intensity = 0 // LightingSystem.MAIN_FIRE_LIGHT_INTENSITY
    p3.radius = 0 // LightingSystem.MAIN_FIRE_LIGHT_RADIUS
    p3.setPositionAsVec3(MAIN_LAMP_POINT_LIGHT_POSITIONS[2])
    p3.setColorAsVec3(FIRE_PARTICLE_COLOR)
    p3.updateGPUBuffer()
    this.addLight(p3)
    this.mainFireLights.push(p3)

    const p4 = new CameraFaceCulledPointLight()
    p4.intensity = 0 // LightingSystem.MAIN_FIRE_LIGHT_INTENSITY
    p4.radius = 0 // LightingSystem.MAIN_FIRE_LIGHT_RADIUS
    p4.setPositionAsVec3(MAIN_LAMP_POINT_LIGHT_POSITIONS[3])
    p4.setColorAsVec3(FIRE_PARTICLE_COLOR)
    p4.updateGPUBuffer()
    this.addLight(p4)
    this.mainFireLights.push(p4)

    // Fire Particles
    for (let i = 0; i < LightingSystem.PARTICLES_PER_FIRE; i++) {
      for (let n = 0; n < 4; n++) {
        const p = new PointLight()
        const pos = vec3.add(
          FIRE_PARTICLE_EMITTER_POSITIONS[n],
          vec3.create(
            (Math.random() * 2 - 1) * 0.1,
            0,
            (Math.random() * 2 - 1) * 0.1
          )
        )
        p.radius = 0.5
        p.intensity = 0.1
        p.setPositionAsVec3(pos)
        p.setColorAsVec3(FIRE_PARTICLE_COLOR)
        this.addParticleLight(p, 0.025)
      }
    }

    const curvePointsBuff = RenderingContext.device.createBuffer({
      label: 'Lighting System Curve Points GPU Buffer',
      size: 4 * curvePoints.length * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    })

    VRAMUsageTracker.addBufferBytes(curvePointsBuff)

    const curvePointsBuffContents = new Float32Array(
      curvePointsBuff.getMappedRange()
    )

    for (let i = 0; i < curvePoints.length; i++) {
      curvePointsBuffContents[i * 4 + 0] = curvePoints[i][0]
      curvePointsBuffContents[i * 4 + 1] = curvePoints[i][1]
      curvePointsBuffContents[i * 4 + 2] = curvePoints[i][2]
      curvePointsBuffContents[i * 4 + 3] = 1
    }

    curvePointsBuff.unmap()

    // 2nd Floor Curve Particles
    const zeroPos = vec3.create()
    for (let i = 0; i < LightingSystem.PARTICLES_PER_CURVE; i++) {
      const p = new PointLight()
      p.setColor(
        Math.random() * 3 + 1,
        Math.random() * 3 + 1,
        Math.random() * 3 + 1
      )
      p.setPositionAsVec3(zeroPos)
      p.radius = 2
      p.intensity = 1
      const t = i / LightingSystem.PARTICLES_PER_CURVE
      // const t = Math.random();
      this.addParticleLight(p, 0.02, t, 0.01, vec3.random(0.5))
    }

    this.particlesLength = this.particles.length

    // 1st Floor Left Corridor
    for (let i = 0; i < LightingSystem.PARTICLES_PER_CORRIDOR; i++) {
      const p = new PointLight()
      p.setColor(
        Math.random() * 3 + 1,
        Math.random() * 3 + 1,
        Math.random() * 3 + 1
      )
      p.setPositionAsVec3(zeroPos)
      p.radius = 1
      this.addParticleLight(
        p,
        0.02,
        i / LightingSystem.PARTICLES_PER_CORRIDOR,
        0.01,
        vec3.create(3.125, 1, 0)
      )
    }

    // 1st Floor Right Corridor
    for (let i = 0; i < LightingSystem.PARTICLES_PER_CORRIDOR; i++) {
      const p = new PointLight()
      p.setColor(
        Math.random() * 3 + 1,
        Math.random() * 3 + 1,
        Math.random() * 3 + 1
      )
      p.setPositionAsVec3(zeroPos)
      p.radius = 1
      this.addParticleLight(
        p,
        0.02,
        i / LightingSystem.PARTICLES_PER_CORRIDOR,
        0.01,
        vec3.create(-3.775, -1, 0)
      )
    }

    // this.particlesLength = this.particles.length;

    this.updateGPUBuffer()
    this.updateParticlesBuffer()

    this.particleSimSettingsBuffer = RenderingContext.device.createBuffer({
      label: 'Particles Update Sim Settings',
      size: 2 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    VRAMUsageTracker.addBufferBytes(this.particleSimSettingsBuffer)

    this.fireParticlesRevealBuffer = RenderingContext.device.createBuffer({
      label: 'Fire Particles Reveal Factor Buffer',
      size: 1 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    })

    VRAMUsageTracker.addBufferBytes(this.fireParticlesRevealBuffer)

    new Float32Array(this.fireParticlesRevealBuffer.getMappedRange()).set([0])

    this.fireParticlesRevealBuffer.unmap()

    const computeBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
        },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'uniform',
        },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'read-only-storage',
        },
      },
      {
        binding: 4,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {},
      },
    ]

    const computeBindGroupLayout =
      RenderingContext.device.createBindGroupLayout({
        label: 'Lights Compute Bind Group Layout',
        entries: computeBindGroupLayoutEntries,
      })

    const computeBindGroupEntries: GPUBindGroupEntry[] = [
      {
        binding: 0,
        resource: {
          buffer: this.particlesGPUBuffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: this.gpuBuffer,
        },
      },
      {
        binding: 2,
        resource: {
          buffer: this.particleSimSettingsBuffer,
        },
      },
      {
        binding: 3,
        resource: {
          buffer: curvePointsBuff,
        },
      },
      {
        binding: 4,
        resource: {
          buffer: this.fireParticlesRevealBuffer,
        },
      },
    ]

    this.computeBindGroup = RenderingContext.device.createBindGroup({
      label: 'Lights Compute Bind Group',
      entries: computeBindGroupEntries,
      layout: computeBindGroupLayout,
    })

    const renderBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {
          type: 'read-only-storage',
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {
          type: 'read-only-storage',
        },
      },
    ]

    const renderBindGroupLayout = RenderingContext.device.createBindGroupLayout(
      {
        label: 'Lights Render Bind Group Layout',
        entries: renderBindGroupLayoutEntries,
      }
    )

    const renderBindGroupEntries: GPUBindGroupEntry[] = [
      {
        binding: 0,
        resource: {
          buffer: this.particlesGPUBuffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: this.gpuBuffer,
        },
      },
    ]
    this.renderBindGroup = RenderingContext.device.createBindGroup({
      label: 'Lights Render Bind Group',
      entries: renderBindGroupEntries,
      layout: renderBindGroupLayout,
    })

    this.computePSO = PipelineStates.createComputePipeline({
      label: 'Update Lights Compute PSO',
      layout: RenderingContext.device.createPipelineLayout({
        label: 'Lights Compute PSO Layout',
        bindGroupLayouts: [computeBindGroupLayout],
      }),
      compute: {
        entryPoint: POINT_LIGHTS_SHADER_COMPUTE_ENTRY_FN,
        module: PipelineStates.createShaderModule(
          POINT_LIGHTS_UPDATE_SHADER_SRC,
          'Update Lights Shader Module'
        ),
        constants: {
          WORKGROUP_SIZE_X: LightingSystem.COMPUTE_WORKGROUP_SIZE_X,
          WORKGROUP_SIZE_Y: LightingSystem.COMPUTE_WORKGROUP_SIZE_Y,
          ANIMATED_PARTICLES_OFFSET_START: 1,
          FIREWORK_PARTICLES_OFFSET: 0,
          FIREWORK_PARTICLES_COUNT: 4 * LightingSystem.PARTICLES_PER_FIRE,
          CURVE_PARTICLES_OFFSET: 4 * LightingSystem.PARTICLES_PER_FIRE,
          CURVE_PARTICLES_COUNT: LightingSystem.PARTICLES_PER_CURVE,
          CURVE_POSITIONS_COUNT: curvePoints.length,
        },
      },
    })

    const colorTargets: GPUColorTargetState[] = [
      {
        format: 'rgba16float',
        blend: {
          color: {
            operation: 'add',
            srcFactor: 'one',
            dstFactor: 'one',
          },
          alpha: {
            operation: 'add',
            srcFactor: 'one',
            dstFactor: 'one',
          },
        },
      },
    ]
    const renderShaderModule = PipelineStates.createShaderModule(
      PARTICLES_RENDER_SHADER_SRC,
      'Render Lights Shader Module'
    )
    this.renderPSO = PipelineStates.createRenderPipeline({
      label: 'Render Lights PSO',
      layout: RenderingContext.device.createPipelineLayout({
        label: 'Lights Render PSO Layout',
        bindGroupLayouts: [
          PipelineStates.defaultCameraPlusLightsBindGroupLayout,
          renderBindGroupLayout,
        ],
      }),
      vertex: {
        entryPoint: PARTICLES_SHADER_VERTEX_ENTRY_FN,
        module: renderShaderModule,
        constants: {
          CURVE_PARTICLES_OFFSET: 4 * LightingSystem.PARTICLES_PER_FIRE,
        },
      },
      fragment: {
        entryPoint: PARTICLES_SHADER_FRAGMENT_ENTRY_FN,
        module: renderShaderModule,
        targets: colorTargets,
        constants: {
          ANIMATED_PARTICLES_OFFSET_START: 1,
          // CURVE_PARTICLES_OFFSET: 4 * LightingSystem.PARTICLES_PER_FIRE,
        },
      },
      depthStencil: {
        format: RenderingContext.depthStencilFormat,
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    })

    this.particleIndexBuffer = RenderingContext.device.createBuffer({
      label: 'Particle Index Buffer',
      size: 6 * Uint16Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    })

    VRAMUsageTracker.addBufferBytes(this.particleIndexBuffer)

    // prettier-ignore
    new Uint16Array(this.particleIndexBuffer.getMappedRange()).set([
      0, 1, 3,
      0, 2, 3
    ])

    this.particleIndexBuffer.unmap()
  }

  public update(commandEncoder: GPUCommandEncoder) {
    this.particlesSimSettingsArr[0] = RenderingContext.elapsedTimeMs
    this.particlesSimSettingsArr[1] = RenderingContext.deltaTimeMs

    RenderingContext.device.queue.writeBuffer(
      this.particleSimSettingsBuffer,
      0,
      this.particlesSimSettingsArr
    )

    const computePass = commandEncoder.beginComputePass({
      label: 'Update Lights Compute Encoder',
    })
    computePass.setPipeline(this.computePSO)
    computePass.setBindGroup(0, this.computeBindGroup)

    const workgroupCountX = Math.ceil(
      this.allLights.length / LightingSystem.COMPUTE_WORKGROUP_SIZE_X
    )
    computePass.dispatchWorkgroups(workgroupCountX, 1, 1)

    computePass.end()
  }

  public override render(renderPass: GPURenderPassEncoder) {
    renderPass.setPipeline(this.renderPSO)
    renderPass.setBindGroup(1, this.renderBindGroup)
    renderPass.setIndexBuffer(this.particleIndexBuffer, Drawable.INDEX_FORMAT)

    // renderPass.drawIndexed(6, this.particlesLength);
    renderPass.drawIndexed(
      6,
      this.render2ndFloorParticles
        ? this.particlesLength
        : LightingSystem.PARTICLES_PER_FIRE * 4
    )
  }
}
