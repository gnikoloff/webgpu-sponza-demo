import PlaneGeometry from "../../renderer/geometry/PlaneGeometry";
import SphereGeometry from "../../renderer/geometry/SphereGeometry";

let _defaultPlaneGeometry: PlaneGeometry;
let _pointLightSphereGeometry: SphereGeometry;

const GeometryCache = {
	get defaultPlaneGeometry(): PlaneGeometry {
		if (_defaultPlaneGeometry) {
			return _defaultPlaneGeometry;
		}
		_defaultPlaneGeometry = new PlaneGeometry();
		return _defaultPlaneGeometry;
	},

	get pointLightSphereGeometry(): SphereGeometry {
		if (_pointLightSphereGeometry) {
			return _pointLightSphereGeometry;
		}
		_pointLightSphereGeometry = new SphereGeometry(1, 9, 9);
		return _pointLightSphereGeometry;
	},
};

export default GeometryCache;
