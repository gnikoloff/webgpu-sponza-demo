export default class RollingAverage {
  private total = 0
  private samples: number[] = []
  private cursor = 0
  constructor(private numSamples = 200) {}

  public addSample(v: number) {
    this.total += v - (this.samples[this.cursor] || 0)
    this.samples[this.cursor] = v
    this.cursor = (this.cursor + 1) % this.numSamples
  }

  public getSamplesCount(): number {
    return this.samples.length
  }

  public get(): number {
    return this.total / this.samples.length
  }
}
