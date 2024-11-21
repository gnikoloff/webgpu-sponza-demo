import { mat4, quat } from "wgpu-matrix";
import CyllinderGeometry from "../../../renderer/geometry/CyllinderGeometry";
import InstancedDrawable from "../../../renderer/scene/InstancedDrawable";
import MaterialCache from "../../utils/MaterialCache";
import { GROUND_SIZE } from "../../constants";
import { QUATERNION_COMP_ORDER } from "../../../renderer/utils/math";

export default class GroundPipes extends InstancedDrawable {
	private static readonly PIPE_RADIUS = 0.009;
	private static readonly PIPES_PER_AXIS = 5;
	private static readonly PIPES_SPACING =
		GROUND_SIZE / GroundPipes.PIPES_PER_AXIS;

	constructor() {
		let geometry = new CyllinderGeometry(
			GroundPipes.PIPE_RADIUS,
			GroundPipes.PIPE_RADIUS,
			GROUND_SIZE,
		);
		let instanceCount = GroundPipes.PIPES_PER_AXIS * 2 + 2;

		super(geometry, instanceCount);

		this.material = MaterialCache.defaultDeferredInstancedMaterial;

		let instanceOffset = 0;
		let translateMat = mat4.create();
		let yRotMat = mat4.fromQuat(
			quat.fromEuler(0, 0, Math.PI * 0.5, QUATERNION_COMP_ORDER),
		);
		for (let i = 0; i < GroundPipes.PIPES_PER_AXIS; i++) {
			mat4.translation(
				new Float32Array([0, 0, i * GroundPipes.PIPES_SPACING - 7.5]),
				translateMat,
			);
			let mat = mat4.mul(translateMat, yRotMat);
			this.setMatrixAt(instanceOffset, mat);
			instanceOffset++;
		}

		mat4.translation(
			new Float32Array([0, 0, 6 * GroundPipes.PIPES_SPACING - 10.5]),
			translateMat,
		);
		let mat = mat4.mul(translateMat, yRotMat);
		this.setMatrixAt(instanceOffset, mat);
		instanceOffset++;

		// let xRotMat: float4x4 = .init(rotation: [.pi * Float(0.5), 0, 0])
		let xRotMat = mat4.fromQuat(
			quat.fromEuler(Math.PI * 0.5, 0, 0, QUATERNION_COMP_ORDER),
		);
		for (let i = 0; i < GroundPipes.PIPES_PER_AXIS; i++) {
			mat4.translation(
				new Float32Array([i * GroundPipes.PIPES_SPACING - 7.5, 0, 0]),
				translateMat,
			);
			let mat = mat4.mul(translateMat, xRotMat);
			this.setMatrixAt(instanceOffset, mat);
			instanceOffset++;
		}

		mat4.translation(
			new Float32Array([6 * GroundPipes.PIPES_SPACING - 10.5, 0, 0]),
			translateMat,
		);
		mat = mat4.mul(translateMat, xRotMat);
		this.setMatrixAt(instanceOffset, mat);

		this.updateInstances();
		this.updateWorldMatrix();
	}
}
