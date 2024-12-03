import Drawable from "../../../renderer/scene/Drawable";

import GeometryCache from "../../utils/GeometryCache";
import MaterialCache from "../../utils/MaterialCache";

export default class GroundPlane extends Drawable {
	constructor() {
		let geometry = GeometryCache.defaultPlaneGeometry;
		super(geometry);

		this.label = "Ground Plane";

		this.setMaterial(MaterialCache.defaultDeferredMaterial);

		this.materialProps.isReflective = true;
		this.materialProps.setColor(0.4, 0.4, 0.4);
		this.materialProps.metallic = 0.1;
		this.materialProps.roughness = 0.5;
	}
}
