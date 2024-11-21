import { vec3 } from "wgpu-matrix";

export default class MaterialProps {
	public isReflective = true;
	public baseColor = vec3.create();
}
