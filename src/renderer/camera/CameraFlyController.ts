import { Vec3, mat4, vec2, vec3 } from 'wgpu-matrix'
import Camera from './Camera'

const DIR = vec3.create()

const FORWARD_CHAR_CODE = 'W'.charCodeAt(0)
const BACKWARD_CHAR_CODE = 'S'.charCodeAt(0)
const LEFT_CHAR_CODE = 'A'.charCodeAt(0)
const RIGHT_CHAR_CODE = 'D'.charCodeAt(0)
const UP_CHAR_CODE = 'E'.charCodeAt(0)
const DOWN_CHAR_CODE = 'Q'.charCodeAt(0)
const ARROW_FORWARD_CHAR_CODE = 38
const ARROW_LEFT_CHAR_CODE = 37
const ARROW_RIGHT_CHAR_CODE = 39
const ARROW_BACKWARD_CHAR_CODE = 40

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

export default class CameraFlyController {
  private static readonly TOUCHMOVE_ROOT_SIZE = 120
  private static readonly TOUCHMOVE_HANDLE_SIZE = 90

  private angles = vec2.create(0, -Math.PI * 0.5)
  private position: Vec3
  private viewMat = mat4.create()
  private rotMat = mat4.identity()

  private lastX = 0
  private lastY = 0
  private oldTime = 0

  private presedKeys: string[] = new Array(128)

  private rafId = -1

  public speed = 40

  private $touchMoveRoot?: HTMLDivElement
  private $touchMoveHandle?: HTMLDivElement
  private $touchLookRoot?: HTMLDivElement
  private $touchLookHandle?: HTMLDivElement

  private touchMoveX = -CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
  private touchMoveY = -CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
  private touchMoveTargetX = -CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
  private touchMoveTargetY = -CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
  private touchMoveAngle = 0

  private touchLookX = -CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
  private touchLookY = -CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
  private touchLookTargetX = -CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
  private touchLookTargetY = -CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
  private touchLookAngle = 0

  private isTouchMoveActive = false
  private isTouchLookActive = false

  public revealTouchControls() {
    if (!isTouchDevice) {
      return
    }
    this.$touchMoveRoot.style.setProperty('opacity', '1')
    this.$touchLookRoot.style.setProperty('opacity', '1')
  }

  constructor(
    private camera: Camera,
    private keyboardDomElement = document.body,
    private mouseDomElement = keyboardDomElement
  ) {
    this.position = camera.position
    keyboardDomElement.addEventListener('keydown', this.onKeyDown)
    keyboardDomElement.addEventListener('keyup', this.onKeyUp)

    mouseDomElement.addEventListener('mousedown', this.onMouseDown)
    mouseDomElement.addEventListener('mouseup', this.onMouseUp)

    this.rotateView(0.0075, 0.005)

    if (isTouchDevice) {
      // move controller

      this.$touchMoveRoot = document.createElement('div')
      this.$touchMoveRoot.style.setProperty('position', 'fixed')
      this.$touchMoveRoot.style.setProperty('left', '24px')
      this.$touchMoveRoot.style.setProperty('bottom', '24px')
      this.$touchMoveRoot.style.setProperty(
        'width',
        `${CameraFlyController.TOUCHMOVE_ROOT_SIZE}px`
      )
      this.$touchMoveRoot.style.setProperty(
        'height',
        `${CameraFlyController.TOUCHMOVE_ROOT_SIZE}px`
      )
      // this.$touchMoveRoot.style.setProperty('background', 'red')
      this.$touchMoveRoot.style.setProperty('border-radius', '50%')
      this.$touchMoveRoot.style.setProperty('border', '2px solid white')
      this.$touchMoveRoot.style.setProperty('z-index', '9999')
      this.$touchMoveRoot.style.setProperty('transition', 'opacity 0.125s ease')
      this.$touchMoveRoot.style.setProperty('opacity', '0')

      this.$touchMoveHandle = document.createElement('div')
      this.$touchMoveHandle.style.setProperty(
        'width',
        `${CameraFlyController.TOUCHMOVE_HANDLE_SIZE}px`
      )
      this.$touchMoveHandle.style.setProperty(
        'height',
        `${CameraFlyController.TOUCHMOVE_HANDLE_SIZE}px`
      )
      this.$touchMoveHandle.style.setProperty('position', 'absolute')
      this.$touchMoveHandle.style.setProperty('left', '50%')
      this.$touchMoveHandle.style.setProperty('top', '50%')
      this.$touchMoveHandle.style.setProperty(
        'background-color',
        'rgba(255, 255, 255, 0.72)'
      )
      this.$touchMoveHandle.style.setProperty('border-radius', '50%')
      //
      this.$touchMoveRoot.appendChild(this.$touchMoveHandle)
      document.body.appendChild(this.$touchMoveRoot)

      // Look controller
      this.$touchLookRoot = document.createElement('div')
      this.$touchLookRoot.style.setProperty('position', 'fixed')
      this.$touchLookRoot.style.setProperty('bottom', '24px')
      this.$touchLookRoot.style.setProperty('right', '24px')
      this.$touchLookRoot.style.setProperty(
        'width',
        `${CameraFlyController.TOUCHMOVE_ROOT_SIZE}px`
      )
      this.$touchLookRoot.style.setProperty(
        'height',
        `${CameraFlyController.TOUCHMOVE_ROOT_SIZE}px`
      )
      this.$touchLookRoot.style.setProperty('border', '2px solid white')
      this.$touchLookRoot.style.setProperty('border-radius', '50%')
      this.$touchLookRoot.style.setProperty('z-index', '9999')
      this.$touchLookRoot.style.setProperty('transition', 'opacity 0.125s ease')
      this.$touchLookRoot.style.setProperty('opacity', '0')

      document.body.appendChild(this.$touchLookRoot)

      this.$touchLookHandle = document.createElement('div')
      this.$touchLookHandle.style.setProperty(
        'width',
        `${CameraFlyController.TOUCHMOVE_HANDLE_SIZE}px`
      )
      this.$touchLookHandle.style.setProperty(
        'height',
        `${CameraFlyController.TOUCHMOVE_HANDLE_SIZE}px`
      )
      this.$touchLookHandle.style.setProperty('position', 'absolute')
      this.$touchLookHandle.style.setProperty('left', '50%')
      this.$touchLookHandle.style.setProperty('top', '50%')
      this.$touchLookHandle.style.setProperty(
        'background-color',
        'rgba(255, 255, 255, 0.72)'
      )
      this.$touchLookHandle.style.setProperty('border-radius', '50%')
      this.$touchLookRoot.appendChild(this.$touchLookHandle)

      this.$touchMoveHandle.addEventListener(
        'touchstart',
        this.onMoveHandleTouchStart
      )
      this.$touchMoveHandle.addEventListener(
        'touchmove',
        this.onMoveHandleTouchMove
      )
      this.$touchMoveHandle.addEventListener(
        'touchend',
        this.onMoveHandleTouchEnd
      )
      this.$touchMoveHandle.addEventListener(
        'touchcancel',
        this.onMoveHandleTouchEnd
      )

      this.$touchLookHandle.addEventListener(
        'touchstart',
        this.onLookHandleTouchStart
      )
      this.$touchLookHandle.addEventListener(
        'touchmove',
        this.onLookHandleTouchMove
      )
      this.$touchLookHandle.addEventListener(
        'touchend',
        this.onLookHandleTouchEnd
      )
      this.$touchLookHandle.addEventListener(
        'touchcancel',
        this.onLookHandleTouchEnd
      )
    }
  }

  private onLookHandleTouchStart = () => {
    // ...
  }

  private onLookHandleTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    const px = e.targetTouches[0].clientX
    const py = e.targetTouches[0].clientY
    const cx = innerWidth - 24 - CameraFlyController.TOUCHMOVE_ROOT_SIZE * 0.5
    const cy = innerHeight - 24 - CameraFlyController.TOUCHMOVE_ROOT_SIZE * 0.5
    const dx = cx - px
    const dy = cy - py
    const d = Math.min(Math.sqrt(dx * dx + dy * dy), 60)
    const angle = Math.atan2(-dy, -dx)
    const nx =
      Math.cos(angle) * d - CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
    const ny =
      Math.sin(angle) * d - CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
    this.touchLookTargetX = nx
    this.touchLookTargetY = ny
    this.touchLookAngle = angle

    this.isTouchLookActive = true
  }

  private onLookHandleTouchEnd = () => {
    this.touchLookTargetX = -CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
    this.touchLookTargetY = -CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
    this.isTouchLookActive = false
  }

  private onMoveHandleTouchStart = () => {
    // ...
  }

  private onMoveHandleTouchEnd = () => {
    this.touchMoveTargetX = -CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
    this.touchMoveTargetY = -CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
    this.isTouchMoveActive = false
  }

  private onMoveHandleTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    const px = e.targetTouches[0].clientX
    const py = e.targetTouches[0].clientY
    const cx = 24 + CameraFlyController.TOUCHMOVE_ROOT_SIZE * 0.5
    const cy = innerHeight - 24 - CameraFlyController.TOUCHMOVE_ROOT_SIZE * 0.5
    const dx = cx - px
    const dy = cy - py
    const d = Math.min(Math.sqrt(dx * dx + dy * dy), 60)

    const angle = Math.atan2(-dy, -dx)
    const nx =
      Math.cos(angle) * d - CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
    const ny =
      Math.sin(angle) * d - CameraFlyController.TOUCHMOVE_HANDLE_SIZE * 0.5
    this.touchMoveTargetX = nx
    this.touchMoveTargetY = ny
    this.touchMoveAngle = angle

    this.isTouchMoveActive = true
  }

  public startTick() {
    this.rafId = requestAnimationFrame(this.update)
  }

  public endTick() {
    cancelAnimationFrame(this.rafId)
  }

  private update = () => {
    const speed = this.speed * 0.001
    vec3.set(0, 0, 0, DIR)

    const now = performance.now() * 0.001
    const dt = now - this.oldTime
    this.oldTime = now

    if (isTouchDevice) {
      this.touchMoveX += (this.touchMoveTargetX - this.touchMoveX) * dt * 5
      this.touchMoveY += (this.touchMoveTargetY - this.touchMoveY) * dt * 5

      this.$touchMoveHandle?.style.setProperty(
        'transform',
        `translate3d(${this.touchMoveX}px, ${this.touchMoveY}px, 0)`
      )

      this.touchLookX += (this.touchLookTargetX - this.touchLookX) * dt * 5
      this.touchLookY += (this.touchLookTargetY - this.touchLookY) * dt * 5

      this.$touchLookHandle?.style.setProperty(
        'transform',
        `translate3d(${this.touchLookX}px, ${this.touchLookY}px, 0)`
      )

      if (this.isTouchLookActive) {
        const dx = Math.cos(this.touchLookAngle)
        const dy = Math.sin(this.touchLookAngle)
        this.rotateView(dx * 0.03, dy * 0.03)
      }

      if (this.isTouchMoveActive) {
        const mx = Math.cos(this.touchMoveAngle)
        const my = Math.sin(this.touchMoveAngle)
        DIR[0] = mx * 0.05
        DIR[2] = my * 0.05
      }
    } else {
      if (
        this.presedKeys[FORWARD_CHAR_CODE] ||
        this.presedKeys[ARROW_FORWARD_CHAR_CODE]
      ) {
        DIR[2] -= speed
      }
      if (
        this.presedKeys[BACKWARD_CHAR_CODE] ||
        this.presedKeys[ARROW_BACKWARD_CHAR_CODE]
      ) {
        DIR[2] += speed
      }
      if (
        this.presedKeys[LEFT_CHAR_CODE] ||
        this.presedKeys[ARROW_LEFT_CHAR_CODE]
      ) {
        DIR[0] -= speed
      }
      if (
        this.presedKeys[RIGHT_CHAR_CODE] ||
        this.presedKeys[ARROW_RIGHT_CHAR_CODE]
      ) {
        DIR[0] += speed
      }
      if (this.presedKeys[UP_CHAR_CODE]) {
        // Space, moves up
        DIR[1] += speed
      }
      if (this.presedKeys[DOWN_CHAR_CODE]) {
        // Shift, moves down
        DIR[1] -= speed
      }
    }

    if (DIR[0] !== 0 || DIR[1] !== 0 || DIR[2] !== 0) {
      // Move the camera in the direction we are facing
      vec3.transformMat4(DIR, this.rotMat, DIR)
      vec3.add(this.position, DIR, this.position)
    }

    const mv = this.viewMat
    mat4.identity(mv)
    mat4.rotateX(mv, this.angles[0], mv)
    mat4.rotateY(mv, this.angles[1], mv)
    mat4.translate(mv, vec3.negate(this.position), mv)
    this.camera.setPosition(
      this.position[0],
      this.position[1],
      this.position[2]
    )
    this.camera.updateViewMatrixWithMat(mv)
    this.rafId = requestAnimationFrame(this.update)
  }

  private rotateView(xDelta: number, yDelta: number) {
    if (xDelta || yDelta) {
      this.angles[1] += xDelta
      while (this.angles[1] < 0) {
        this.angles[1] += Math.PI * 2.0
      }
      while (this.angles[1] >= Math.PI * 2.0) {
        this.angles[1] -= Math.PI * 2.0
      }

      this.angles[0] += yDelta
      if (this.angles[0] < -Math.PI * 0.5) {
        this.angles[0] = -Math.PI * 0.5
      }
      if (this.angles[0] > Math.PI * 0.5) {
        this.angles[0] = Math.PI * 0.5
      }

      mat4.identity(this.rotMat)
      mat4.rotateY(this.rotMat, -this.angles[1], this.rotMat)
      mat4.rotateX(this.rotMat, -this.angles[0], this.rotMat)
    }
  }

  private onMouseDown = (e: MouseEvent) => {
    this.lastX = e.pageX
    this.lastY = e.pageY
    this.mouseDomElement.addEventListener('mousemove', this.onMouseMove)
  }

  private onMouseUp = () => {
    this.mouseDomElement.removeEventListener('mousemove', this.onMouseMove)
  }

  private onMouseMove = (e: MouseEvent) => {
    const xDelta = e.pageX - this.lastX
    const yDelta = e.pageY - this.lastY
    this.lastX = e.pageX
    this.lastY = e.pageY
    this.rotateView(xDelta * 0.0075, yDelta * 0.005)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // @ts-expect-error Deprecated but still available
    this.presedKeys[e.keyCode] = true
  }

  private onKeyUp = (e: KeyboardEvent) => {
    // @ts-expect-error Deprecated but still available
    this.presedKeys[e.keyCode] = false
  }
}
