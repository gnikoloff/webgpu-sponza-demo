import Renderer from "../../app/Renderer";
import Camera from "../camera/Camera";
import { RenderPassNames } from "../constants";
import Scene from "../scene/Scene";
import { RenderPassType } from "../types";
import RenderPass from "./RenderPass";

export default class RenderPassComposer {
	private passes: RenderPass[] = [];
	private textureCache: Map<string, GPUTexture> = new Map();
	private scene!: Scene;

	public destroy() {
		for (const pass of this.passes) {
			pass.destroy();
		}
		this.textureCache.clear();
	}

	public setScene(scene: Scene) {
		this.scene = scene;
	}

	public addPass(renderPass: RenderPass): this {
		if (this.passes.some(({ type }) => type === renderPass.type)) {
			const renderPassName = RenderPassNames.get(renderPass.type);
			console.warn(`RenderPass ${renderPassName} has already been added`);
			return;
		}
		this.passes.push(renderPass);
		return this;
	}

	public removePass(type: RenderPassType) {
		this.passes = this.passes.filter(({ type: passType }) => passType !== type);
	}

	public getPass(type: RenderPassType): RenderPass | undefined {
		return this.passes.find(({ type: passType }) => passType === type);
	}

	public setTexture(name: string, texture: GPUTexture) {
		this.textureCache.set(name, texture);
	}

	public getTexture(name: string): GPUTexture | undefined {
		return this.textureCache.get(name);
	}

	public async render(commandEncoder: GPUCommandEncoder) {
		for (const pass of this.passes) {
			if (!pass.enabled) {
				continue;
			}
			const inputs = pass.inputTextureNames.map((inputName) =>
				this.textureCache.get(inputName),
			);

			const outTextures = pass.render(commandEncoder, this.scene, inputs);

			pass.outputTextureNames.forEach((outTexName, i) => {
				this.textureCache.set(outTexName, outTextures[i]);
			});
		}
	}

	public onFrameEnd() {
		for (const pass of this.passes) {
			pass.onFrameEnd();
		}
	}
}
