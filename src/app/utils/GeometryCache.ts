import PlaneGeometry from "../../renderer/geometry/PlaneGeometry";

let _defaultPlaneGeometry: PlaneGeometry;

const GeometryCache = {
	get defaultPlaneGeometry(): PlaneGeometry {
		if (_defaultPlaneGeometry) {
			return _defaultPlaneGeometry;
		}
		_defaultPlaneGeometry = new PlaneGeometry();
		return _defaultPlaneGeometry;
	},
};

export default GeometryCache;
