import { RotationOrder, mat4 } from "wgpu-matrix";

export const clamp = (num: number, min: number, max: number): number =>
	Math.min(Math.max(num, min), max);

export const deg2Rad = (deg: number): number => (deg * Math.PI) / 180;

export const rad2Deg = (rad: number): number => (rad * 180) / Math.PI;

export const MAT4x4_IDENTITY_MATRIX = mat4.identity();
export const QUATERNION_COMP_ORDER: RotationOrder = "xyz";
