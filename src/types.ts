export type SSRMethod = "linear" | "hi-z";

export interface IGUIParams {
	"Play Animation": boolean;
	"Enable TAA": boolean;
	"Debug G-Buffer": boolean;
	"Debug Shadow Map": boolean;
	"Debug Shadow Cascade Index": boolean;
	"Debug Point Lights Mask": boolean;
	"SSR Enabled": boolean;
	"SSR Method": SSRMethod;
	"SSR Max Iterations": number;
	"Auto-Rotate Sun": boolean;
	"Debug Skybox": boolean;
	"Debug Bounding Boxes": boolean;
}
