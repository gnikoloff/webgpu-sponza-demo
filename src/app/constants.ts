export const MAIN_CAMERA_NEAR = 0.1;
export const MAIN_CAMERA_FAR = 100;
export const ORTHO_CAMERA_NEAR = 0.1;
export const ORTHO_CAMERA_FAR = 1;

export const GROUND_SIZE = 80;

export const SHADER_ATTRIB_LOCATIONS = {
	get Position(): number {
		return 0;
	},
	get Normal(): number {
		return 1;
	},
	get TexCoord(): number {
		return 2;
	},
};

export const BIND_GROUP_LOCATIONS = {
	get Camera(): number {
		return 0;
	},
	get Model(): number {
		return 1;
	},
	get InstanceMatrices(): number {
		return 2;
	},
};

export const RENDER_TARGET_LOCATIONS = {
	get NormalMetallicRoughness(): number {
		return 0;
	},
	get ColorReflectance(): number {
		return 1;
	},
	get Velocity(): number {
		return 2;
	},
};
