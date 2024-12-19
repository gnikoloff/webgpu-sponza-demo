import { vec3 } from 'wgpu-matrix'
import sponzaGltfModelUrl from '../assets/sponza/Sponza.gltf?url'
import { Tween } from '../renderer/animation/Tween'
import CameraFlyController from '../renderer/camera/CameraFlyController'
import PerspectiveCamera from '../renderer/camera/PerspectiveCamera'
import RenderPassComposer from '../renderer/core/RenderPassComposer'
import RenderingContext from '../renderer/core/RenderingContext'
import CatmullRomCurve3 from '../renderer/math/CatmullRomCurve3'
import RollingAverage from '../renderer/math/RollingAverage'
import VRAMUsageTracker from '../renderer/misc/VRAMUsageTracker'
import GLTFModel from '../renderer/scene/GLTFModel'
import Scene from '../renderer/scene/Scene'
import BDRFLutGenerator from '../renderer/texture/BDRFLutGenerator'
import DiffuseIBLGenerator from '../renderer/texture/DiffuseIBLGenerator'
import SpecularIBLGenerator from '../renderer/texture/SpecularIBLGenerator'
import TextureController from '../renderer/texture/TextureController'
import TextureLoader from '../renderer/texture/TextureLoader'
import {
  DebugStatType,
  RenderPassType,
  placeholderFunc,
} from '../renderer/types'
import {
  BLIT_PASS_REVEAL_ANIM_DURATION_MS,
  ENVIRONMENT_CUBE_TEXTURE_FACE_URLS,
  FIREWORK_PARTICLES_LOAD_ANIM_DELAY_MS,
  FIREWORK_PARTICLES_LOAD_ANIM_DURATION_MS,
  FIREWORK_PARTICLES_LOAD_ANIM_EASE,
  MAIN_CAMERA_FAR,
  MAIN_CAMERA_LOAD_ANIM_DURATION_MS,
  MAIN_CAMERA_LOAD_ANIM_EASE,
  MAIN_CAMERA_NEAR,
  MAIN_CAMERA_START_LOAD_END_POSITION,
  MAIN_CAMERA_START_LOAD_START_POSITION,
  RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
  RENDER_PASS_BLOOM_TEXTURE,
  RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE,
  RENDER_PASS_DEPTH_STENCIL_TEXTURE,
  RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE,
  RENDER_PASS_HI_Z_DEPTH_TEXTURE,
  RENDER_PASS_LIGHTING_RESULT_TEXTURE,
  RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
  RENDER_PASS_SSAO_BLUR_TEXTURE,
  RENDER_PASS_SSAO_TEXTURE,
  RENDER_PASS_TAA_RESOLVE_TEXTURE,
  RENDER_PASS_VELOCITY_TEXTURE,
  SECOND_FLOOR_PARTICLES_CATMULL_CURVE_POINT_POSITIONS,
  SUN_LOAD_ANIM_DELAY_MS,
  SUN_LOAD_ANIM_DURATION_MS,
  SUN_LOAD_ANIM_EASE,
  SUN_LOAD_END_INTENSITY,
  SUN_LOAD_END_POSITION,
  SUN_LOAD_START_INTENSITY,
  SUN_LOAD_START_POSITION,
} from './constants'

import { lerp, mapNumberRange } from '../renderer/math/math'
import { TextureDebugMeshType } from '../types'
import LineDebugDrawable from './debug/LineDebugDrawable'
import TexturesDebugContainer from './debug/textures-debug/TexturesDebugContainer'
import DebugStatsContainer from './debug/timings-debug/DebugStatsContainer'
import LightingSystem from './lighting/LightingSystem'
import Skybox from './meshes/Skybox'
import BlitRenderPass from './render-passes/BlitRenderPass'
import BloomDownscaleRenderPass from './render-passes/BloomDownscaleRenderPass'
import BloomUpscaleRenderPass from './render-passes/BloomUpscaleRenderPass'
import DebugBoundsPass from './render-passes/DebugBoundsPass'
import DirectionalAmbientLightRenderPass from './render-passes/DirectionalAmbientLightRenderPass'
import DirectionalShadowRenderPass from './render-passes/DirectionalShadowRenderPass'
import GBufferRenderPass from './render-passes/GBufferRenderPass'
import HiZCopyDepthComputePass from './render-passes/HiZCopyDepthComputePass'
import HiZDepthComputePass from './render-passes/HiZDepthComputePass'
import PointLightsMaskPass from './render-passes/PointLightsMaskPass'
import PointLightsNonCulledRenderPass from './render-passes/PointLightsNonCulledRenderPass'
import PointLightsRenderPass from './render-passes/PointLightsRenderPass'
import ReflectionComputePass from './render-passes/ReflectionComputePass'
import SSAOBlurRenderPass from './render-passes/SSAOBlurRenderPass'
import SSAORenderPass from './render-passes/SSAORenderPass'
import SkyboxRenderPass from './render-passes/SkyboxRenderPass'
import TAAResolveRenderPass from './render-passes/TAAResolveRenderPass'
import TransparentRenderPass from './render-passes/TransparentRenderPass'
import MaterialCache from './utils/MaterialCache'

export default class Renderer extends RenderingContext {
  public static initialize = async (
    canvas: HTMLCanvasElement
  ): Promise<Renderer | undefined> => {
    if (!navigator.gpu) {
      return undefined
    }

    const adapter = await navigator.gpu.requestAdapter()
    RenderingContext.$canvas = canvas
    RenderingContext.canvasContext = canvas.getContext(
      'webgpu'
    ) as GPUCanvasContext
    RenderingContext.pixelFormat = navigator.gpu.getPreferredCanvasFormat()

    const requiredFeatures: GPUFeatureName[] = []

    // TODO: M3 MBP currently reports wrong timestamp queries.
    // Need to implement and test them properly
    // const supportsGPUTimestampQuery = adapter.features.has('timestamp-query')
    const supportsGPUTimestampQuery = false

    if (supportsGPUTimestampQuery) {
      requiredFeatures.push('timestamp-query')
    }

    RenderingContext.device = await adapter.requestDevice({
      requiredFeatures,
    })

    RenderingContext.supportsGPUTimestampQuery = supportsGPUTimestampQuery

    RenderingContext.canvasContext.configure({
      device: RenderingContext.device,
      format: RenderingContext.pixelFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })

    return new Renderer()
  }

  public mainCamera: PerspectiveCamera
  public debugCamera: PerspectiveCamera
  public mainCameraCtrl: CameraFlyController

  private curveMoveLine: LineDebugDrawable
  private lightingManager: LightingSystem
  private scene = new Scene()

  private envDiffuseTexture: GPUTexture
  private envSpecularTexture: GPUTexture
  private envBdrfLutTexture: GPUTexture
  private renderPassComposer!: RenderPassComposer

  private cpuAverage = new RollingAverage()
  private gpuAverage = new RollingAverage()
  private fpsDisplayAverage = new RollingAverage()

  private texturesDebugContainer: TexturesDebugContainer
  private timingDebugContainer: DebugStatsContainer

  private resizeCounter = 0

  private viewportWidth = 0
  private viewportHeight = 0

  public set sunPositionX(v: number) {
    this.lightingManager.sunPositionX = v
  }

  public set sunPositionY(v: number) {
    this.lightingManager.sunPositionY = v
  }

  public set sunPositionZ(v: number) {
    this.lightingManager.sunPositionZ = v
  }

  public set sunIntensity(v: number) {
    this.lightingManager.sunIntensity = v
  }

  private _ssaoEnabled = true
  public set ssaoEnabled(v: boolean) {
    this._ssaoEnabled = v
    this.recreateRenderComposer()
  }

  public set ssaoKernelSize(v: number) {
    ;(
      this.renderPassComposer.getPass(RenderPassType.SSAO) as SSAORenderPass
    ).kernelSize = v
  }

  public set ssaoRadius(v: number) {
    ;(
      this.renderPassComposer.getPass(RenderPassType.SSAO) as SSAORenderPass
    ).radius = v
  }

  public set ssaoStrength(v: number) {
    ;(
      this.renderPassComposer.getPass(RenderPassType.SSAO) as SSAORenderPass
    ).strength = v
  }

  public set enableTAA(v: boolean) {
    this.mainCamera.shouldJitter = v
    const taaPass = this.renderPassComposer.getPass(
      RenderPassType.TAAResolve
    ) as TAAResolveRenderPass
    const bloomDownscaleRenderPass = this.renderPassComposer.getPass(
      RenderPassType.BloomDownsample
    ) as BloomDownscaleRenderPass
    const blitPass = this.renderPassComposer.getPass(
      RenderPassType.Blit
    ) as BlitRenderPass
    taaPass.enabled = v

    if (v) {
      taaPass.resetHistory()
    }

    bloomDownscaleRenderPass
      .resetInputs()
      .addInputTexture(
        v
          ? RENDER_PASS_TAA_RESOLVE_TEXTURE
          : RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE
      )
    blitPass
      .resetInputs()
      .addInputTextures([
        RENDER_PASS_BLOOM_TEXTURE,
        v
          ? RENDER_PASS_TAA_RESOLVE_TEXTURE
          : RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE,
      ])
  }

  public set debugGBuffer(v: boolean) {
    if (v) {
      this.texturesDebugContainer.scrollIntoGbufferSection()
      this.texturesDebugContainer.reveal()
    } else {
      this.texturesDebugContainer.hide()
    }
  }

  public set debugShadowMap(v: boolean) {
    if (v) {
      this.texturesDebugContainer.scrollToShadowSection()
      this.texturesDebugContainer.reveal()
    } else {
      this.texturesDebugContainer.hide()
    }
  }

  public set shadowMapSize(v: number) {
    const shadowPass = this.renderPassComposer.getPass(
      RenderPassType.Shadow
    ) as DirectionalShadowRenderPass
    this.renderPassComposer
      .getPass(RenderPassType.DirectionalAmbientLighting)
      .resetInputs()
      .addInputTextures([
        RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
        RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
        RENDER_PASS_DEPTH_STENCIL_TEXTURE,
        RENDER_PASS_SSAO_BLUR_TEXTURE,
        RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE,
      ])
    shadowPass.shadowMapSize = v
  }

  public set debugShadowCascadeIndex(v: boolean) {
    ;(
      this.renderPassComposer.getPass(
        RenderPassType.DirectionalAmbientLighting
      ) as DirectionalAmbientLightRenderPass
    ).debugShadowCascadeLayer = v
  }

  public set debugLightsMask(v: boolean) {
    ;(
      this.renderPassComposer.getPass(
        RenderPassType.PointLightsLighting
      ) as PointLightsRenderPass
    ).debugLightsMask = v
  }

  public set render2ndFloorPoints(v: boolean) {
    this.lightingManager.render2ndFloorParticles = v
  }

  public enableAnimation = true

  public set ssrIsHiZ(v: boolean) {
    ;(
      this.renderPassComposer.getPass(
        RenderPassType.Reflection
      ) as ReflectionComputePass
    ).isHiZ = v
    this.renderPassComposer.getPass(RenderPassType.HiZ).enabled = v
  }

  public set ssrMaxIterations(v: number) {
    ;(
      this.renderPassComposer.getPass(
        RenderPassType.Reflection
      ) as ReflectionComputePass
    ).maxIterations = v
  }

  public set debugMissedSSR(v: boolean) {
    ;(
      this.renderPassComposer.getPass(
        RenderPassType.Reflection
      ) as ReflectionComputePass
    ).debugMissedIntersections = v
  }

  private _ssrEnabled = true

  public set ssrEnabled(v: boolean) {
    this._ssrEnabled = v
    this.recreateRenderComposer()
  }

  private _bloomEnabled = true
  public set bloomEnabled(v: boolean) {
    this._bloomEnabled = v

    this.recreateRenderComposer()
  }

  public set bloomFilterRadius(v: number) {
    ;(
      this.renderPassComposer.getPass(
        RenderPassType.BloomUpsample
      ) as BloomUpscaleRenderPass
    ).bloomFilterRadius = v
  }

  public set debugBoundingBoxes(v: boolean) {
    ;(
      this.renderPassComposer.getPass(
        RenderPassType.DebugBounds
      ) as DebugBoundsPass
    ).enabled = v
  }

  public set debugMovementCurve(v: boolean) {
    this.curveMoveLine.visible = v
  }

  public toggleStatsVisibility() {
    this.timingDebugContainer.toggleVisibility()
  }

  public onIntroAnimComplete: placeholderFunc

  constructor() {
    super()
    this.mainCamera = new PerspectiveCamera(
      70,
      1,
      MAIN_CAMERA_NEAR,
      MAIN_CAMERA_FAR
    )
    this.mainCamera.shouldJitter = true
    this.mainCamera.setPositionAsVec3(MAIN_CAMERA_START_LOAD_START_POSITION)
    this.mainCamera.setLookAt(0, 2, 0)
    this.mainCamera.updateViewMatrix()

    this.mainCameraCtrl = new CameraFlyController(
      this.mainCamera,
      document.body,
      RenderingContext.$canvas
    )
    this.mainCameraCtrl.startTick()

    this.debugCamera = new PerspectiveCamera(
      70,
      1,
      MAIN_CAMERA_NEAR,
      MAIN_CAMERA_FAR
    )
    this.debugCamera.setPosition(6, 12, 1)
    this.debugCamera.setLookAt(0, 7, 0)
    this.debugCamera.updateViewMatrix()

    const curve = new CatmullRomCurve3(
      SECOND_FLOOR_PARTICLES_CATMULL_CURVE_POINT_POSITIONS,
      true
    )
    const movementCurvePoints = curve.getPoints(240)
    // this.curveMoveLine = new LineDebugDrawable(movementCurvePoints);
    // this.curveMoveLine.visible = false;
    // this.scene.addChild(this.curveMoveLine);

    this.lightingManager = new LightingSystem(movementCurvePoints)
    this.scene.lightingManager = this.lightingManager

    this.texturesDebugContainer = new TexturesDebugContainer()
    this.timingDebugContainer = new DebugStatsContainer()

    this.scene.skybox = new Skybox()

    const sponzaModel = new GLTFModel(sponzaGltfModelUrl)
    this.scene.addChild(sponzaModel)
    sponzaModel.setPositionY(2).updateWorldMatrix()

    Promise.all([
      TextureLoader.load6SeparateHDRFacesAsCubeMapTexture(
        ENVIRONMENT_CUBE_TEXTURE_FACE_URLS,
        512,
        true,
        'Skybox Faces'
      ),
      sponzaModel.load(),
    ]).then(([environmentTexture]) => {
      this.envDiffuseTexture = DiffuseIBLGenerator.encode(environmentTexture)
      this.envSpecularTexture = SpecularIBLGenerator.encode(
        environmentTexture,
        256
      )
      this.envBdrfLutTexture = BDRFLutGenerator.encode()

      TextureController.generateMipsForCubeTexture(this.envDiffuseTexture)
      this.scene.skybox.setTexture(this.envDiffuseTexture)

      const dirAmbientLightPass = this.renderPassComposer.getPass(
        RenderPassType.DirectionalAmbientLighting
      ) as DirectionalAmbientLightRenderPass

      dirAmbientLightPass
        .setDiffuseIBLTexture(this.envDiffuseTexture)
        .setSpecularIBLTexture(this.envSpecularTexture)
        .setBDRFLutTexture(this.envBdrfLutTexture)

      VRAMUsageTracker.removeTextureBytes(environmentTexture)
      environmentTexture.destroy()

      sponzaModel
        .setMaterial(MaterialCache.defaultGLTFTexturedDeferredMaterial)
        .setMaterial(
          MaterialCache.defaultGLTFShadowMaterial,
          RenderPassType.Shadow
        )

      // Add some artifical time to hide any possible lingering mipmap generation artefacts etc
      setTimeout(() => {
        document.getElementById('loader').classList.toggle('faded')

        // Sun intro anim
        new Tween({
          durationMS: SUN_LOAD_ANIM_DURATION_MS,
          delayMS: SUN_LOAD_ANIM_DELAY_MS,
          easeName: SUN_LOAD_ANIM_EASE,
          onUpdate: (t) => {
            const sunPos = vec3.lerp(
              SUN_LOAD_START_POSITION,
              SUN_LOAD_END_POSITION,
              t
            )
            const sunIntensity = lerp(
              SUN_LOAD_START_INTENSITY,
              SUN_LOAD_END_INTENSITY,
              t
            )
            this.sunPositionX = sunPos[0]
            this.sunPositionY = sunPos[1]
            this.sunPositionZ = sunPos[2]
            this.sunIntensity = sunIntensity
          },
          onComplete: () => {
            // ...
          },
        }).start()

        new Tween({
          durationMS: FIREWORK_PARTICLES_LOAD_ANIM_DURATION_MS,
          delayMS: FIREWORK_PARTICLES_LOAD_ANIM_DELAY_MS,
          easeName: FIREWORK_PARTICLES_LOAD_ANIM_EASE,
          onUpdate: (t) => {
            this.lightingManager.fireParticlesRevealFactor = t
          },
          onComplete: () => {
            document.getElementById('logo').classList.toggle('faded')
            this.mainCameraCtrl.revealTouchControls()
            if (this.onIntroAnimComplete) {
              this.onIntroAnimComplete()
            }
          },
        }).start()

        // Camera intro anim
        new Tween({
          durationMS: MAIN_CAMERA_LOAD_ANIM_DURATION_MS,
          easeName: MAIN_CAMERA_LOAD_ANIM_EASE,
          onUpdate: (t) => {
            this.mainCamera
              .setPositionAsVec3(
                vec3.lerp(
                  MAIN_CAMERA_START_LOAD_START_POSITION,
                  MAIN_CAMERA_START_LOAD_END_POSITION,
                  t
                )
              )
              .updateViewMatrix()
          },
          onComplete: () => {
            // ...
          },
        }).start()

        const blitPass = this.renderPassComposer.getPass(
          RenderPassType.Blit
        ) as BlitRenderPass

        blitPass.revealWithAnimation(BLIT_PASS_REVEAL_ANIM_DURATION_MS)
      }, 500)
    })
  }

  private recreateRenderComposer(
    width = this.viewportWidth,
    height = this.viewportHeight
  ) {
    this.renderPassComposer?.destroy()

    this.renderPassComposer = new RenderPassComposer()
    this.renderPassComposer.setScene(this.scene)

    const shadowRenderPass = new DirectionalShadowRenderPass(
      this.lightingManager.mainDirLight,
      width,
      height
    )
      .addOutputTexture(RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE)
      .setCamera(this.mainCamera)

    const gbufferRenderPass = new GBufferRenderPass(width, height)
      .setCamera(this.mainCamera)
      .addOutputTextures([
        RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
        RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
        RENDER_PASS_VELOCITY_TEXTURE,
        RENDER_PASS_DEPTH_STENCIL_TEXTURE,
      ])

    let ssaoRenderPass: SSAORenderPass
    let ssaoBlurRenderPass: SSAOBlurRenderPass

    if (this._ssaoEnabled) {
      ssaoRenderPass = new SSAORenderPass(width, height)
        .addInputTextures([
          RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
          RENDER_PASS_DEPTH_STENCIL_TEXTURE,
        ])
        .addOutputTexture(RENDER_PASS_SSAO_TEXTURE)
        .setCamera(this.mainCamera)

      ssaoBlurRenderPass = new SSAOBlurRenderPass(width, height)
        .addInputTexture(RENDER_PASS_SSAO_TEXTURE)
        .addOutputTexture(RENDER_PASS_SSAO_BLUR_TEXTURE)
    }

    const dirAmbientLightRenderPassInputTexNames = [
      RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
      RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
      RENDER_PASS_DEPTH_STENCIL_TEXTURE,
      RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE,
    ]

    if (this._ssaoEnabled) {
      dirAmbientLightRenderPassInputTexNames.push(RENDER_PASS_SSAO_TEXTURE)
    }

    const directionalAmbientLightRenderPass =
      new DirectionalAmbientLightRenderPass(
        shadowRenderPass.shadowCascadesBuffer,
        width,
        height
      )
        .setCamera(this.mainCamera)
        .addInputTextures(dirAmbientLightRenderPassInputTexNames)
        .addOutputTexture(RENDER_PASS_LIGHTING_RESULT_TEXTURE)

    directionalAmbientLightRenderPass.ssaoMixFactor = this._ssaoEnabled ? 1 : 0

    if (this.envDiffuseTexture) {
      directionalAmbientLightRenderPass.setDiffuseIBLTexture(
        this.envDiffuseTexture
      )
    }

    if (this.envSpecularTexture) {
      directionalAmbientLightRenderPass.setSpecularIBLTexture(
        this.envSpecularTexture
      )
    }
    if (this.envBdrfLutTexture) {
      directionalAmbientLightRenderPass.setBDRFLutTexture(
        this.envBdrfLutTexture
      )
    }

    const pointLightNonInstancedTexInputNames = [
      RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
      RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
      RENDER_PASS_DEPTH_STENCIL_TEXTURE,
      RENDER_PASS_LIGHTING_RESULT_TEXTURE,
    ]

    if (this._ssaoEnabled) {
      pointLightNonInstancedTexInputNames.push(RENDER_PASS_SSAO_TEXTURE)
    }

    const pointLightsNonInstancedNonCulledRenderPass =
      new PointLightsNonCulledRenderPass(width, height)
        .setCamera(this.mainCamera)
        .addInputTextures(pointLightNonInstancedTexInputNames)
        .addOutputTexture(RENDER_PASS_LIGHTING_RESULT_TEXTURE)

    const pointLightsStencilMaskPass = new PointLightsMaskPass(width, height)
      .setCamera(this.mainCamera)
      .addInputTextures([RENDER_PASS_DEPTH_STENCIL_TEXTURE])
      .addOutputTexture(RENDER_PASS_DEPTH_STENCIL_TEXTURE)
      .setLightsBuffer(this.lightingManager.gpuBuffer)
      .updateLightsMaskBindGroup()

    const pointLightsRenderPassInputTexNames = [
      RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
      RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
      RENDER_PASS_DEPTH_STENCIL_TEXTURE,
      RENDER_PASS_LIGHTING_RESULT_TEXTURE,
    ]

    if (this._ssaoEnabled) {
      pointLightsRenderPassInputTexNames.push(RENDER_PASS_SSAO_TEXTURE)
    }

    const pointLightsRenderPass = new PointLightsRenderPass(width, height)
      .setCamera(this.mainCamera)
      .addInputTextures(pointLightsRenderPassInputTexNames)
      .addOutputTexture(RENDER_PASS_LIGHTING_RESULT_TEXTURE)

    const transparentRenderPass = new TransparentRenderPass(width, height)
      .setCamera(this.mainCamera)
      .addInputTextures([
        RENDER_PASS_LIGHTING_RESULT_TEXTURE,
        RENDER_PASS_DEPTH_STENCIL_TEXTURE,
      ])
      .addOutputTextures([
        RENDER_PASS_LIGHTING_RESULT_TEXTURE,
        RENDER_PASS_DEPTH_STENCIL_TEXTURE,
      ])

    const skyboxRenderPass = new SkyboxRenderPass(width, height)
      .setCamera(this.mainCamera)
      .addInputTextures([
        RENDER_PASS_LIGHTING_RESULT_TEXTURE,
        RENDER_PASS_DEPTH_STENCIL_TEXTURE,
      ])
      .addOutputTextures([
        RENDER_PASS_LIGHTING_RESULT_TEXTURE,
        RENDER_PASS_DEPTH_STENCIL_TEXTURE,
      ])

    let hiZCopyDepthComputePass: HiZCopyDepthComputePass
    let hiZDepthComputePass: HiZDepthComputePass
    let reflectionsComputePass: ReflectionComputePass

    if (this._ssrEnabled) {
      hiZCopyDepthComputePass = new HiZCopyDepthComputePass(width, height)
        .addInputTexture(RENDER_PASS_DEPTH_STENCIL_TEXTURE)
        .addOutputTexture(RENDER_PASS_HI_Z_DEPTH_TEXTURE)

      hiZDepthComputePass = new HiZDepthComputePass(width, height)
        .addInputTexture(RENDER_PASS_HI_Z_DEPTH_TEXTURE)
        .addOutputTexture(RENDER_PASS_HI_Z_DEPTH_TEXTURE)
      reflectionsComputePass = new ReflectionComputePass(width, height)
        .setCamera(this.mainCamera)
        .addInputTextures([
          RENDER_PASS_LIGHTING_RESULT_TEXTURE,
          RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE,
          RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE,
          RENDER_PASS_HI_Z_DEPTH_TEXTURE,
        ])
        .addOutputTexture(RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE)
    }

    const taaResolveRenderPass = new TAAResolveRenderPass(width, height)
      .addInputTextures([
        this._ssrEnabled
          ? RENDER_PASS_COMPUTED_REFLECTIONS_TEXTURE
          : RENDER_PASS_LIGHTING_RESULT_TEXTURE,
        RENDER_PASS_VELOCITY_TEXTURE,
      ])
      .addOutputTexture(RENDER_PASS_TAA_RESOLVE_TEXTURE)

    let bloomDownscaleRenderPass: BloomDownscaleRenderPass
    let bloomUpscaleRenderPass: BloomUpscaleRenderPass

    if (this._bloomEnabled) {
      bloomDownscaleRenderPass = new BloomDownscaleRenderPass(width, height)
        .addInputTexture(RENDER_PASS_TAA_RESOLVE_TEXTURE)
        .addOutputTexture(RENDER_PASS_BLOOM_TEXTURE)

      bloomUpscaleRenderPass = new BloomUpscaleRenderPass(width, height)
        .addInputTexture(RENDER_PASS_BLOOM_TEXTURE)
        .addOutputTexture(RENDER_PASS_BLOOM_TEXTURE)
    }

    const blitRenderPassInputs: string[] = []

    if (this._bloomEnabled) {
      blitRenderPassInputs.push(RENDER_PASS_BLOOM_TEXTURE)
    }
    blitRenderPassInputs.push(RENDER_PASS_TAA_RESOLVE_TEXTURE)

    const blitRenderPass = new BlitRenderPass(
      width,
      height,
      this.resizeCounter > 0
    ).addInputTextures(blitRenderPassInputs)

    blitRenderPass.bloomEnabled = this._bloomEnabled

    this.renderPassComposer.addPass(shadowRenderPass).addPass(gbufferRenderPass)

    if (this._ssaoEnabled) {
      this.renderPassComposer
        .addPass(ssaoRenderPass)
        .addPass(ssaoBlurRenderPass)
    }

    this.renderPassComposer
      .addPass(directionalAmbientLightRenderPass)
      .addPass(pointLightsNonInstancedNonCulledRenderPass)
      .addPass(pointLightsStencilMaskPass)
      .addPass(pointLightsRenderPass)
      .addPass(transparentRenderPass)
      .addPass(skyboxRenderPass)

    if (this._ssrEnabled) {
      this.renderPassComposer
        .addPass(hiZCopyDepthComputePass)
        .addPass(hiZDepthComputePass)
        .addPass(reflectionsComputePass)
    }

    this.renderPassComposer.addPass(taaResolveRenderPass)

    if (this._bloomEnabled) {
      this.renderPassComposer
        .addPass(bloomDownscaleRenderPass)
        .addPass(bloomUpscaleRenderPass)
    }

    this.renderPassComposer.addPass(blitRenderPass)
  }

  public resize(w: number, h: number) {
    this.viewportWidth = w
    this.viewportHeight = h

    this.debugCamera.onResize(w, h)
    this.mainCamera.onResize(w, h)

    this.recreateRenderComposer(w, h)
    this.resizeCounter++
  }

  public async renderFrame(elapsedTime: number) {
    const now = (elapsedTime - RenderingContext.elapsedTimeMs) * 0.001
    const deltaDiff = now - RenderingContext.prevTimeMs
    RenderingContext.prevTimeMs = now
    RenderingContext.elapsedTimeMs += this.enableAnimation ? deltaDiff : 0
    RenderingContext.deltaTimeMs = this.enableAnimation
      ? Math.min(deltaDiff, 0.5)
      : 0
    const jsPerfStartTime = performance.now()

    this.debugCamera.onFrameStart()
    this.mainCamera.onFrameStart()

    const commandEncoder = RenderingContext.device.createCommandEncoder({
      label: 'Frame Command Encoder',
    })

    this.lightingManager.update(commandEncoder)
    this.renderPassComposer.render(commandEncoder)

    this.texturesDebugContainer
      .setTextureGBufferSection(
        TextureDebugMeshType.Albedo,
        this.renderPassComposer.getTexture(
          RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE
        )
      )
      .setTextureGBufferSection(
        TextureDebugMeshType.Normal,
        this.renderPassComposer.getTexture(
          RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE
        )
      )
      .setTextureGBufferSection(
        TextureDebugMeshType.Metallic,
        this.renderPassComposer.getTexture(
          RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE
        )
      )
      .setTextureGBufferSection(
        TextureDebugMeshType.Roughness,
        this.renderPassComposer.getTexture(
          RENDER_PASS_NORMAL_METALLIC_ROUGHNESS_TEXTURE
        )
      )
      // .setTextureGBufferSection(
      //   TextureDebugMeshType.AO,
      //   this.renderPassComposer.getTexture(RENDER_PASS_SSAO_BLUR_TEXTURE) ||
      //     TextureLoader.dummyR16FTexture
      // )
      .setTextureGBufferSection(
        TextureDebugMeshType.Reflectance,
        this.renderPassComposer.getTexture(
          RENDER_PASS_ALBEDO_REFLECTANCE_TEXTURE
        )
      )
      .setTextureGBufferSection(
        TextureDebugMeshType.Depth,
        this.renderPassComposer.getTexture(RENDER_PASS_DEPTH_STENCIL_TEXTURE)
      )
      .setTextureGBufferSection(
        TextureDebugMeshType.Velocity,
        this.renderPassComposer.getTexture(RENDER_PASS_VELOCITY_TEXTURE)
      )
      .setTextureShadowSection(
        TextureDebugMeshType.ShadowDepthCascade0,
        this.renderPassComposer.getTexture(
          RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE
        )
      )
      .setTextureShadowSection(
        TextureDebugMeshType.ShadowDepthCascade1,
        this.renderPassComposer.getTexture(
          RENDER_PASS_DIRECTIONAL_LIGHT_DEPTH_TEXTURE
        )
      )
      .render(commandEncoder)

    RenderingContext.device.queue.submit([commandEncoder.finish()])

    this.renderPassComposer.onFrameEnd()
    this.mainCamera.onFrameEnd()
    this.debugCamera.onFrameEnd()

    const jsPerfTime = performance.now() - jsPerfStartTime

    if (RenderingContext.supportsGPUTimestampQuery) {
      const [shadowRenderPassTimingResult, blitRenderPassTimingResult] =
        await Promise.all([
          this.renderPassComposer
            .getPass(RenderPassType.Shadow)
            .getTimingResult(),
          this.renderPassComposer
            .getPass(RenderPassType.Blit)
            .getTimingResult(),
        ])

      const gbufferRenderPassTimings = shadowRenderPassTimingResult.timings
      const blitRenderPassTimings = blitRenderPassTimingResult.timings
      const totalGPUTime =
        (blitRenderPassTimings[1] - gbufferRenderPassTimings[0]) / 1_000_000
      this.gpuAverage.addSample(totalGPUTime)
    }

    this.cpuAverage.addSample(jsPerfTime)
    this.fpsDisplayAverage.addSample(1 / deltaDiff)

    const cpuAverageStat = this.cpuAverage.get()
    const fpsAverageStat = this.fpsDisplayAverage.get()
    const gpuAverageStat = this.gpuAverage.get()

    this.mainCameraCtrl.speed = mapNumberRange(fpsAverageStat, 60, 120, 30, 30)

    if (RenderingContext.supportsGPUTimestampQuery) {
      this.timingDebugContainer.setDisplayValue(
        DebugStatType.GPUTotal,
        gpuAverageStat > 0 ? `${gpuAverageStat.toFixed(1)}ms` : 'N/A'
      )
    }

    this.timingDebugContainer
      .setDisplayValue(
        DebugStatType.CPUTotal,
        cpuAverageStat !== 0 ? `${cpuAverageStat.toFixed(1)}ms` : 'N/A'
      )
      .setDisplayValue(
        DebugStatType.FPS,
        fpsAverageStat !== 0 ? `${fpsAverageStat.toFixed(1)}ms` : 'N/A'
      )
      .setDisplayValue(DebugStatType.VRAM, VRAMUsageTracker.getFormattedSize())
      .setDisplayValue(
        DebugStatType.VisibleMeshes,
        `${this.scene.visibleNodesCount} / ${this.scene.nodesCount}`
      )
      .setDisplayValue(
        DebugStatType.LightsCount,
        this.lightingManager.lightsCount.toString()
      )

    RenderingContext.frameIndex++
  }
}
