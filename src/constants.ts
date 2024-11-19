export const MAIN_CAMERA_NEAR = 0.1;
export const MAIN_CAMERA_FAR = 500;

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
};
