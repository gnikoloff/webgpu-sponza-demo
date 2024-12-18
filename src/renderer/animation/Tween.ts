import {
  EaseType,
  TweenProps,
  easeTweenFunc,
  placeholderFunc,
  updateTweenFunc,
} from '../types'
import { Easing } from './Easing'

export class Tween {
  startMS = 0

  rafID!: number
  delayID!: number
  durationMS: number
  delayMS: number
  easeFunc: easeTweenFunc
  onUpdate: updateTweenFunc
  onComplete: placeholderFunc

  constructor({
    durationMS,
    delayMS = 0,
    easeName = 'linear',
    onUpdate,
    onComplete = () => {},
  }: TweenProps) {
    this.durationMS = durationMS
    this.delayMS = delayMS
    this.easeFunc = Easing[easeName]
    this.onUpdate = onUpdate
    this.onComplete = onComplete
  }

  start(): this {
    const start = () => {
      this.startMS = performance.now()
      this.rafID = window.requestAnimationFrame(this.update)
      clearTimeout(this.delayID)
    }
    if (this.delayMS) {
      this.delayID = window.setTimeout(start, this.delayMS)
    } else {
      start()
    }
    return this
  }

  stop(): this {
    window.clearTimeout(this.delayID)
    window.cancelAnimationFrame(this.rafID)
    this.rafID = -1
    return this
  }

  setEase(easeName: EaseType): this {
    this.easeFunc = Easing[easeName]
    return this
  }

  update = () => {
    this.rafID = window.requestAnimationFrame(this.update)

    let msNorm = (performance.now() - this.startMS) / this.durationMS
    if (msNorm < 0) {
      msNorm = 0
    } else if (msNorm > 1) {
      msNorm = 1
    }

    const ease = this.easeFunc(msNorm)
    this.onUpdate(ease, msNorm)

    if (msNorm >= 1) {
      this.onComplete()
      this.stop()
    }
  }
}
