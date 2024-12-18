import { Vec3, vec3 } from 'wgpu-matrix'

class CubicPoly {
  public c0 = 0
  public c1 = 0
  public c2 = 0
  public c3 = 0

  private set(x0: number, x1: number, t0: number, t1: number) {
    this.c0 = x0
    this.c1 = t0
    this.c2 = -3 * x0 + 3 * x1 - 2 * t0 - t1
    this.c3 = 2 * x0 - 2 * x1 + t0 + t1
  }

  initCatmullRom(
    x0: number,
    x1: number,
    x2: number,
    x3: number,
    tension: number
  ) {
    this.set(x1, x2, tension * (x2 - x0), tension * (x3 - x1))
  }

  initNonuniformCatmullRom(
    x0: number,
    x1: number,
    x2: number,
    x3: number,
    dt0: number,
    dt1: number,
    dt2: number
  ) {
    let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1
    let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2

    t1 *= dt1
    t2 *= dt1

    this.set(x1, x2, t1, t2)
  }

  calc(t: number) {
    const t2 = t * t
    const t3 = t2 * t
    return this.c0 + this.c1 * t + this.c2 * t2 + this.c3 * t3
  }
}

const px = new CubicPoly()
const py = new CubicPoly()
const pz = new CubicPoly()
const tmp = vec3.create()

export default class CatmullRomCurve3 {
  constructor(
    private points: Vec3[] = [],
    private closed = false,
    private tension = 0.5
  ) {}

  public getPoint(t: number, optionalTarget = vec3.create()): Vec3 {
    const point = optionalTarget
    const l = this.points.length
    const p = (l - (this.closed ? 0 : 1)) * t
    let intPoint = Math.floor(p)
    let weight = p - intPoint
    if (this.closed) {
      intPoint +=
        intPoint > 0 ? 0 : (Math.floor(Math.abs(intPoint) / l) + 1) * l
    } else if (weight === 0 && intPoint === l - 1) {
      intPoint = l - 2
      weight = 1
    }
    let p0: Vec3
    let p3: Vec3

    if (this.closed || intPoint > 0) {
      p0 = this.points[(intPoint - 1) % l]
    } else {
      vec3.sub(this.points[0], this.points[1], tmp)
      vec3.add(tmp, this.points[0], tmp)
      p0 = tmp
    }

    const p1 = this.points[intPoint % l]
    const p2 = this.points[(intPoint + 1) % l]

    if (this.closed || intPoint + 2 < l) {
      p3 = this.points[(intPoint + 2) % l]
    } else {
      vec3.sub(this.points[l - 1], this.points[l - 2], tmp)
      vec3.add(tmp, this.points[l - 1], tmp)
      p3 = tmp
    }

    const pow = 0.25
    let dt0 = Math.pow(vec3.distSq(p0, p1), pow)
    let dt1 = Math.pow(vec3.distSq(p1, p2), pow)
    let dt2 = Math.pow(vec3.distSq(p2, p3), pow)

    if (dt1 < 1e-4) dt1 = 1.0
    if (dt0 < 1e-4) dt0 = dt1
    if (dt2 < 1e-4) dt2 = dt1

    px.initNonuniformCatmullRom(p0[0], p1[0], p2[0], p3[0], dt0, dt1, dt2)
    py.initNonuniformCatmullRom(p0[1], p1[1], p2[1], p3[1], dt0, dt1, dt2)
    pz.initNonuniformCatmullRom(p0[2], p1[2], p2[2], p3[2], dt0, dt1, dt2)

    vec3.set(px.calc(weight), py.calc(weight), pz.calc(weight), point)

    return point
  }

  public getPoints(divisions = 5): Vec3[] {
    const out: Vec3[] = []
    for (let d = 0; d < divisions; d++) {
      out.push(this.getPoint(d / divisions))
    }
    return out
  }
}
