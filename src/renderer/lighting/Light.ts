import {
	StructuredView,
	makeShaderDataDefinitions,
	makeStructuredView,
} from "webgpu-utils";
import { Vec3, vec3 } from "wgpu-matrix";
import { LightTypeToShaderType } from "../constants";
import Transform from "../scene/Transform";
import { SHADER_CHUNKS } from "../shader/chunks";
import { LightType, UUIDString } from "../types";

const _lightShaderDefs = makeShaderDataDefinitions(SHADER_CHUNKS.Light);
const _lightsStorageView = makeStructuredView(_lightShaderDefs.structs.Light);

export default class Light extends Transform {
	public static get STRUCT_BYTE_SIZE(): number {
		return _lightsStorageView.arrayBuffer.byteLength;
	}

	public id: UUIDString = crypto.randomUUID();
	public lightsStorageView: StructuredView;

	private _color = vec3.create(1, 1, 0);
	private _intensity: number = 1;

	public get intensity(): number {
		return this._intensity;
	}

	public set intensity(v: number) {
		this._intensity = v;
		this.lightsStorageView.set({
			intensity: v,
		});
	}

	public get color(): Vec3 {
		return this.getColor();
	}

	public set color(v: Vec3) {
		this.setColor(v[0], v[1], v[2]);
	}

	public setColor(r: number, g: number, b: number) {
		this._color[0] = r;
		this._color[1] = g;
		this._color[2] = b;
		this.lightsStorageView.set({
			color: this._color,
		});
	}

	public setColorAsVec3(v: Vec3) {
		vec3.copy(v, this._color);
		this.lightsStorageView.set({
			color: this._color,
		});
	}

	public getColor(): Vec3 {
		return this._color;
	}

	public override setPosition(x: number, y: number, z: number): this {
		super.setPosition(x, y, z);
		this.lightsStorageView.set({
			position: this.position,
		});
		return this;
	}

	public override setPositionAsVec3(xyz: Float32Array): this {
		super.setPositionAsVec3(xyz);
		this.lightsStorageView.set({
			position: this.position,
		});
		return this;
	}

	public override setPositionX(x: number): this {
		super.setPositionX(x);
		this.lightsStorageView.set({
			position: this.position,
		});
		return this;
	}

	public override setPositionY(y: number): this {
		super.setPositionY(y);
		this.lightsStorageView.set({
			position: this.position,
		});
		return this;
	}

	public override setPositionZ(z: number): this {
		super.setPositionZ(z);
		this.lightsStorageView.set({
			position: this.position,
		});
		return this;
	}

	constructor(public lightType: LightType) {
		super();

		const lightShaderDefs = makeShaderDataDefinitions(SHADER_CHUNKS.Light);
		this.lightsStorageView = makeStructuredView(lightShaderDefs.structs.Light);

		this.lightsStorageView.set({
			color: this._color,
			position: this.position,
			lightType: LightTypeToShaderType.get(lightType),
			intensity: 1,
		});
	}
}
