import { RotationOrder, mat4 } from "wgpu-matrix";
export const clamp = (num: number, min: number, max: number): number =>
	Math.min(Math.max(num, min), max);

export const lerp = (a: number, b: number, t: number) => a + t * (b - a);

export const deg2Rad = (deg: number): number => (deg * Math.PI) / 180;

export const rad2Deg = (rad: number): number => (rad * 180) / Math.PI;

export const numMipLevelsForSize = (width: number, height: number): number => {
	const maxSize = Math.max(width, height);
	return (1 + Math.log2(maxSize)) | 0;
};

export const MAT4x4_IDENTITY_MATRIX = mat4.identity();
export const QUATERNION_COMP_ORDER: RotationOrder = "xyz";

export const SKYBOX_CUBEMAP_CAMERA_LOOK_ATS = [
	[1, 0, 0],
	[-1, 0, 0],
	[0, 1, 0],
	[0, -1, 0],
	[0, 0, 1],
	[0, 0, -1],
];

export const SKYBOX_CUBEMAP_CAMERA_UPS = [
	[0, 1, 0],
	[0, 1, 0],
	[0, 0, -1],
	[0, 0, 1],
	[0, 1, 0],
	[0, 1, 0],
];
