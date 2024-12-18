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

const floatView = new Float32Array(1);
const int32View = new Int32Array(floatView.buffer);
export const toHalf = (val: number): number => {
	floatView[0] = val;
	const x = int32View[0];

	let bits = (x >> 16) & 0x8000; /* Get the sign */
	let m = (x >> 12) & 0x07ff; /* Keep one extra bit for rounding */
	const e = (x >> 23) & 0xff; /* Using int is faster here */

	/* If zero, or denormal, or exponent underflows too much for a denormal
	 * half, return signed zero. */
	if (e < 103) {
		return bits;
	}

	/* If NaN, return NaN. If Inf or exponent overflow, return Inf. */
	if (e > 142) {
		bits |= 0x7c00;
		/* If exponent was 0xff and one mantissa bit was set, it means NaN,
		 * not Inf, so make sure we set one mantissa bit too. */
		bits |= (e == 255 ? 0 : 1) && x & 0x007fffff;
		return bits;
	}

	/* If exponent underflows but not too much, return a denormal */
	if (e < 113) {
		m |= 0x0800;
		/* Extra rounding may overflow and set mantissa to 0 and exponent
		 * to 1, which is OK. */
		bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
		return bits;
	}

	bits |= ((e - 112) << 10) | (m >> 1);
	/* Extra rounding. An overflow will set mantissa to 0 and increment
	 * the exponent, which is OK. */
	bits += m & 1;
	return bits;
};
