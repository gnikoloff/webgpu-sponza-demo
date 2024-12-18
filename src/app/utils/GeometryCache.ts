import CubeGeometry from '../../renderer/geometry/CubeGeometry'
import PlaneGeometry from '../../renderer/geometry/PlaneGeometry'
import SphereGeometry from '../../renderer/geometry/SphereGeometry'

let _defaultPlaneGeometry: PlaneGeometry
let _unitCubeGeometry: CubeGeometry
let _unitSphereGeometry: SphereGeometry
let _pointLightSphereGeometry: SphereGeometry

const GeometryCache = Object.freeze({
  get defaultPlaneGeometry(): PlaneGeometry {
    if (_defaultPlaneGeometry) {
      return _defaultPlaneGeometry
    }
    _defaultPlaneGeometry = new PlaneGeometry()
    return _defaultPlaneGeometry
  },

  get unitCubeGeometry(): CubeGeometry {
    if (_unitCubeGeometry) {
      return _unitCubeGeometry
    }
    _unitCubeGeometry = new CubeGeometry()
    return _unitCubeGeometry
  },

  get unitSphereGeometry(): SphereGeometry {
    if (_unitSphereGeometry) {
      return _unitSphereGeometry
    }
    _unitSphereGeometry = new SphereGeometry()
    return _unitSphereGeometry
  },

  get pointLightSphereGeometry(): SphereGeometry {
    if (_pointLightSphereGeometry) {
      return _pointLightSphereGeometry
    }
    _pointLightSphereGeometry = new SphereGeometry(1, 9, 9)
    return _pointLightSphereGeometry
  },
})

export default GeometryCache
