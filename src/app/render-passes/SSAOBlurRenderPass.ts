import RenderPass from "../../renderer/core/RenderPass";
import { RenderPassType } from "../../renderer/types";

export default class SSAOBlurRenderPass extends RenderPass {
	constructor() {
		super(RenderPassType.SSAOBlur);
	}
}
