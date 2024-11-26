import Drawable from "../../../renderer/scene/Drawable";
import { GROUND_SIZE } from "../../constants";
import GeometryCache from "../../utils/GeometryCache";
import MaterialCache from "../../utils/MaterialCache";

export default class GroundPlane extends Drawable {
	constructor() {
		let geometry = GeometryCache.defaultPlaneGeometry;
		super(geometry);

		this.setMaterial(MaterialCache.defaultDeferredMaterial);

		this.materialProps.isReflective = true;
		this.materialProps.setColor(0.4, 0.4, 0.4);

		this.setRotationX(Math.PI * -0.5)
			.setPositionY(0)
			.setScale(GROUND_SIZE, GROUND_SIZE, GROUND_SIZE);
		this.updateWorldMatrix();
	}
}
