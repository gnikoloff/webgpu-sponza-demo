import Light, { LightType } from "./Light";

export default class DirectionalLight extends Light {
	constructor() {
		super(LightType.Directional);
	}
}
