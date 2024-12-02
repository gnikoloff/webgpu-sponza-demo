import Transform from "../../../renderer/scene/Transform";
import { GROUND_SIZE } from "../../constants";
import GroundPipes from "./GroundPipes";
import GroundPlane from "./GroundPlane";

export default class GroundContainer extends Transform {
	private plane: GroundPlane;
	// private pipes: GroundPipes;
	constructor() {
		super();
		this.plane = new GroundPlane();
		// this.pipes = new GroundPipes();

		this.plane
			.setRotationX(Math.PI * -0.5)
			.setPositionY(0)
			.setScale(GROUND_SIZE, GROUND_SIZE, GROUND_SIZE);

		this.addChild(this.plane);

		// this.addChild(this.pipes);
	}
}
