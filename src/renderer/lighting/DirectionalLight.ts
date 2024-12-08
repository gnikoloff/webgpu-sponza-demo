import { LightType } from "../types";
import Light from "./Light";

export default class DirectionalLight extends Light {
	constructor() {
		super(LightType.Directional);
	}
}
