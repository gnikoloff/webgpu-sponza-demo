import Transform from "../../../renderer/scene/Transform";
import GroundPipes from "./GroundPipes";
import GroundPlane from "./GroundPlane";

export default class GroundContainer extends Transform {
	private plane: GroundPlane;
	// private pipes: GroundPipes;
	constructor() {
		super();
		this.plane = new GroundPlane();
		// this.pipes = new GroundPipes();
		this.addChild(this.plane);
		// this.addChild(this.pipes);
	}
}
