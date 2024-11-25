import { Vec3, vec3 } from "wgpu-matrix";

export default class MaterialProps {
	public isReflective = true;

	private _baseColor = vec3.create();

	public get color(): Vec3 {
		return this._baseColor;
	}

	public set color(v: Vec3) {
		this.setColor(v[0], v[1], v[2]);
	}

	public setColorR(v: number) {
		this._baseColor[0] = v;
	}

	public setColorG(v: number) {
		this._baseColor[1] = v;
	}

	public setColorB(v: number) {
		this._baseColor[2] = v;
	}

	public setColor(r: number, g: number, b: number) {
		this._baseColor[0] = r;
		this._baseColor[1] = g;
		this._baseColor[2] = b;
	}
}
