// http://easings.net/
// Easing functions from https://github.com/tweenjs/tween.js/blob/master/src/Tween.js

import BaseUtilObject from '../core/BaseUtilObject'

export class Easing extends BaseUtilObject {
  static linear(k: number): number {
    return k
  }

  static quad_In(k: number): number {
    return k * k
  }
  static quad_Out(k: number): number {
    return k * (2 - k)
  }
  static quad_InOut(k: number): number {
    if ((k *= 2) < 1) return 0.5 * k * k
    return -0.5 * (--k * (k - 2) - 1)
  }

  static cubic_In(k: number): number {
    return k * k * k
  }
  static cubic_Out(k: number): number {
    return --k * k * k + 1
  }
  static cubic_InOut(k: number): number {
    if ((k *= 2) < 1) return 0.5 * k * k * k
    return 0.5 * ((k -= 2) * k * k + 2)
  }

  static quart_In(k: number): number {
    return k * k * k * k
  }
  static quart_Out(k: number): number {
    return 1 - --k * k * k * k
  }
  static quart_InOut(k: number): number {
    if ((k *= 2) < 1) return 0.5 * k * k * k * k
    return -0.5 * ((k -= 2) * k * k * k - 2)
  }

  static quint_In(k: number): number {
    return k * k * k * k * k
  }
  static quint_Out(k: number): number {
    return --k * k * k * k * k + 1
  }
  static quint_InOut(k: number): number {
    if ((k *= 2) < 1) return 0.5 * k * k * k * k * k
    return 0.5 * ((k -= 2) * k * k * k * k + 2)
  }

  static sine_In(k: number): number {
    return 1 - Math.cos((k * Math.PI) / 2)
  }
  static sine_Out(k: number): number {
    return Math.sin((k * Math.PI) / 2)
  }
  static sine_InOut(k: number): number {
    return 0.5 * (1 - Math.cos(Math.PI * k))
  }

  static exp_In(k: number): number {
    return k === 0 ? 0 : Math.pow(1024, k - 1)
  }
  static exp_Out(k: number): number {
    return k === 1 ? 1 : 1 - Math.pow(2, -10 * k)
  }
  static exp_InOut(k: number): number {
    if (k === 0 || k === 1) return k
    if ((k *= 2) < 1) return 0.5 * Math.pow(1024, k - 1)
    return 0.5 * (-Math.pow(2, -10 * (k - 1)) + 2)
  }

  static circ_In(k: number): number {
    return 1 - Math.sqrt(1 - k * k)
  }
  static circ_Out(k: number): number {
    return Math.sqrt(1 - --k * k)
  }
  static circ_InOut(k: number): number {
    if ((k *= 2) < 1) return -0.5 * (Math.sqrt(1 - k * k) - 1)
    return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1)
  }

  static elastic_In(k: number): number {
    if (k === 0 || k === 1) return k
    return -Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI)
  }

  static elastic_Out(k: number): number {
    if (k === 0 || k === 1) return k
    return Math.pow(2, -10 * k) * Math.sin((k - 0.1) * 5 * Math.PI) + 1
  }

  static elastic_InOut(k: number): number {
    if (k === 0 || k === 1) return k

    k *= 2
    if (k < 1)
      return (
        -0.5 * Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI)
      )
    return (
      0.5 * Math.pow(2, -10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI) + 1
    )
  }

  static back_In(k: number): number {
    return k * k * ((1.70158 + 1) * k - 1.70158)
  }
  static back_Out(k: number): number {
    return --k * k * ((1.70158 + 1) * k + 1.70158) + 1
  }
  static back_InOut(k: number): number {
    const s = 1.70158 * 1.525
    if ((k *= 2) < 1) return 0.5 * (k * k * ((s + 1) * k - s))
    return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2)
  }

  static bounce_In(k: number): number {
    return 1 - Easing.bounce_Out(1 - k)
  }
  static bounce_Out(k: number): number {
    if (k < 1 / 2.75) return 7.5625 * k * k
    else if (k < 2 / 2.75) return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75
    else if (k < 2.5 / 2.75) return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375
    else return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375
  }

  static bounce_InOut(k: number): number {
    if (k < 0.5) return Easing.bounce_In(k * 2) * 0.5
    return Easing.bounce_Out(k * 2 - 1) * 0.5 + 0.5
  }
}
