import { Vec3, vec3 } from "wgpu-matrix";
import LightingManager from "../../renderer/lighting/LightingManager";
import PointLight from "../../renderer/lighting/PointLight";
import PipelineStates from "../../renderer/core/PipelineStates";
import RenderingContext from "../../renderer/core/RenderingContext";
import Light from "../../renderer/lighting/Light";
import LightParticle from "./LightParticle";
import Drawable from "../../renderer/scene/Drawable";
import DirectionalLight from "../../renderer/lighting/DirectionalLight";

import {
	PARTICLES_RENDER_SHADER_SRC,
	PARTICLES_SHADER_FRAGMENT_ENTRY_FN,
	PARTICLES_SHADER_VERTEX_ENTRY_FN,
} from "../shaders/PointLightsRenderShader";
import {
	POINT_LIGHTS_SHADER_COMPUTE_ENTRY_FN,
	POINT_LIGHTS_UPDATE_SHADER_SRC,
} from "../shaders/PointLightsUpdateShader";

const FIRE_SPAWN_POSITIONS: Vec3[] = [
	vec3.create(3.9, 3, 1.15),
	vec3.create(3.9, 3, -1.75),
	vec3.create(-4.95, 3, 1.1),
	vec3.create(-4.95, 3, -1.3),
];

export default class LightingSystem extends LightingManager {
	private static readonly COMPUTE_WORKGROUP_SIZE_X = 8;
	private static readonly COMPUTE_WORKGROUP_SIZE_Y = 1;

	private particlesGPUBuffer!: GPUBuffer;
	private particles: LightParticle[] = [];

	private computePSO: GPUComputePipeline;
	private renderPSO: GPURenderPipeline;
	private computeBindGroup: GPUBindGroup;
	private renderBindGroup: GPUBindGroup;
	private particleIndexBuffer: GPUBuffer;
	private particleSimSettingsBuffer: GPUBuffer;
	private particlesSimSettingsArr = new Float32Array(2).fill(0);

	public mainDirLight: DirectionalLight;

	public addParticleLight(v: Light, pRadius = 0.05): this {
		super.addLight(v);

		const p = new LightParticle({
			radius: 0.05,
			position: v.position,
			velocity: vec3.create(0, 0.5, 0),
			lifeSpeed: Math.random() * 0.01 + 0.002,
		});
		this.particles.push(p);

		return this;
	}

	public updateParticlesBuffer() {
		if (this.particlesGPUBuffer) {
			this.particlesGPUBuffer.destroy();
		}

		this.particlesGPUBuffer = RenderingContext.device.createBuffer({
			label: "Light Particles GPU Buffer",
			size: LightParticle.STRUCT_BYTE_SIZE * this.particles.length,
			mappedAtCreation: true,
			usage: GPUBufferUsage.STORAGE,
		});

		const particlesGPUBufferContents = new Float32Array(
			this.particlesGPUBuffer.getMappedRange(),
		);

		for (let i = 0; i < this.particles.length; i++) {
			const offset = i * LightParticle.STRUCT_FLOATS_COUNT;
			const posOffset = offset + LightParticle.POSITION_OFFSET;
			const origPosOffset = offset + LightParticle.ORIG_POSITION_OFFSET;
			const velocityOffset = offset + LightParticle.VELOCITY_OFFSET;
			const lifeOffset = offset + LightParticle.LIFE_OFFSET;
			const lifeSpeedOffset = offset + LightParticle.LIFE_SPEED_OFFSET;
			const radiusOffset = offset + LightParticle.RADIUS_OFFSET;

			particlesGPUBufferContents[posOffset + 0] = this.particles[i].position[0];
			particlesGPUBufferContents[posOffset + 1] = this.particles[i].position[1];
			particlesGPUBufferContents[posOffset + 2] = this.particles[i].position[2];

			particlesGPUBufferContents[origPosOffset + 0] =
				this.particles[i].origPosition[0];
			particlesGPUBufferContents[origPosOffset + 1] =
				this.particles[i].origPosition[1];
			particlesGPUBufferContents[origPosOffset + 2] =
				this.particles[i].origPosition[2];

			particlesGPUBufferContents[velocityOffset + 0] =
				this.particles[i].velocity[0];
			particlesGPUBufferContents[velocityOffset + 1] =
				this.particles[i].velocity[1];
			particlesGPUBufferContents[velocityOffset + 2] =
				this.particles[i].velocity[2];

			particlesGPUBufferContents[lifeOffset] = 0;

			particlesGPUBufferContents[lifeSpeedOffset] = this.particles[i].lifeSpeed;

			particlesGPUBufferContents[radiusOffset] = this.particles[i].radius;
		}

		this.particlesGPUBuffer.unmap();
	}

	constructor() {
		super();

		const dirLight = new DirectionalLight();
		dirLight.setPosition(0, 100, 1);
		dirLight.setColor(0.2156, 0.2627, 0.3333);
		dirLight.intensity = 2;
		this.addLight(dirLight);
		this.mainDirLight = dirLight;

		let r = 1;
		let p = new PointLight();
		p.radius = r;
		p.setPositionAsVec3(FIRE_SPAWN_POSITIONS[0]);
		p.setColor(1, 1, 0);
		this.addLight(p);

		let p2 = new PointLight();
		p2.radius = r;
		p2.setPositionAsVec3(FIRE_SPAWN_POSITIONS[1]);
		p2.setColor(1, 1, 0);
		this.addLight(p2);

		let p3 = new PointLight();
		p3.radius = r;
		p3.setPositionAsVec3(FIRE_SPAWN_POSITIONS[2]);
		p3.setColor(1, 1, 0);
		this.addLight(p3);

		let p4 = new PointLight();
		p4.radius = r;
		p4.setPositionAsVec3(FIRE_SPAWN_POSITIONS[3]);
		p4.setColor(1, 1, 0);
		this.addLight(p4);

		for (let i = 0; i < 32; i++) {
			for (let n = 0; n < 4; n++) {
				let p = new PointLight();
				const pos = vec3.add(
					FIRE_SPAWN_POSITIONS[n],
					vec3.create(
						(Math.random() * 2 - 1) * 0.1,
						0,
						(Math.random() * 2 - 1) * 0.1,
					),
				);
				p.radius = 0.5;
				p.setPositionAsVec3(pos);
				p.setColor(1, 1, 0);
				this.addParticleLight(p, 0.1);
			}
		}

		this.updateGPUBuffer();
		this.updateParticlesBuffer();

		this.particleSimSettingsBuffer = RenderingContext.device.createBuffer({
			label: "Particles Update Sim Settings",
			size: 2 * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		const computeBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				buffer: {
					type: "storage",
				},
			},
			{
				binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				buffer: {
					type: "storage",
				},
			},
			{
				binding: 2,
				visibility: GPUShaderStage.COMPUTE,
				buffer: {
					type: "uniform",
				},
			},
		];

		const computeBindGroupLayout =
			RenderingContext.device.createBindGroupLayout({
				label: "Lights Compute Bind Group Layout",
				entries: computeBindGroupLayoutEntries,
			});

		const computeBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: {
					buffer: this.particlesGPUBuffer,
				},
			},
			{
				binding: 1,
				resource: {
					buffer: this.gpuBuffer,
				},
			},
			{
				binding: 2,
				resource: {
					buffer: this.particleSimSettingsBuffer,
				},
			},
		];

		this.computeBindGroup = RenderingContext.device.createBindGroup({
			label: "Lights Compute Bind Group",
			entries: computeBindGroupEntries,
			layout: computeBindGroupLayout,
		});

		const renderBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX,
				buffer: {
					type: "read-only-storage",
				},
			},
		];

		const renderBindGroupLayout = RenderingContext.device.createBindGroupLayout(
			{
				label: "Lights Render Bind Group Layout",
				entries: renderBindGroupLayoutEntries,
			},
		);

		const renderBindGroupEntries: GPUBindGroupEntry[] = [
			{
				binding: 0,
				resource: {
					buffer: this.particlesGPUBuffer,
				},
			},
		];
		this.renderBindGroup = RenderingContext.device.createBindGroup({
			label: "Lights Render Bind Group",
			entries: renderBindGroupEntries,
			layout: renderBindGroupLayout,
		});

		this.computePSO = PipelineStates.createComputePipeline({
			label: "Update Lights Compute PSO",
			layout: RenderingContext.device.createPipelineLayout({
				label: "Lights Compute PSO Layout",
				bindGroupLayouts: [computeBindGroupLayout],
			}),
			compute: {
				entryPoint: POINT_LIGHTS_SHADER_COMPUTE_ENTRY_FN,
				module: PipelineStates.createShaderModule(
					POINT_LIGHTS_UPDATE_SHADER_SRC,
					"Update Lights Shader Module",
				),
				constants: {
					WORKGROUP_SIZE_X: LightingSystem.COMPUTE_WORKGROUP_SIZE_X,
					WORKGROUP_SIZE_Y: LightingSystem.COMPUTE_WORKGROUP_SIZE_Y,
					ANIMATED_PARTICLES_OFFSET_START: 5,
				},
			},
		});

		const colorTargets: GPUColorTargetState[] = [
			{
				format: "rgba16float",
				blend: {
					color: {
						operation: "add",
						srcFactor: "one",
						dstFactor: "one",
					},
					alpha: {
						operation: "add",
						srcFactor: "one",
						dstFactor: "one",
					},
				},
			},
		];
		const renderShaderModule = PipelineStates.createShaderModule(
			PARTICLES_RENDER_SHADER_SRC,
			"Render Lights Shader Module",
		);
		this.renderPSO = PipelineStates.createRenderPipeline({
			label: "Render Lights PSO",
			layout: RenderingContext.device.createPipelineLayout({
				label: "Lights Render PSO Layout",
				bindGroupLayouts: [
					PipelineStates.defaultCameraPlusLightsBindGroupLayout,
					renderBindGroupLayout,
				],
			}),
			vertex: {
				entryPoint: PARTICLES_SHADER_VERTEX_ENTRY_FN,
				module: renderShaderModule,
				constants: {},
			},
			fragment: {
				entryPoint: PARTICLES_SHADER_FRAGMENT_ENTRY_FN,
				module: renderShaderModule,
				targets: colorTargets,
			},
			depthStencil: {
				format: "depth32float-stencil8",
				depthWriteEnabled: true,
				depthCompare: "less",
			},
		});

		this.particleIndexBuffer = RenderingContext.device.createBuffer({
			label: "Particle Index Buffer",
			size: 6 * Uint16Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.INDEX,
			mappedAtCreation: true,
		});

		// prettier-ignore
		new Uint16Array(this.particleIndexBuffer.getMappedRange()).set([
      0, 1, 3,
      0, 2, 3
    ])

		this.particleIndexBuffer.unmap();
	}

	public update(commandEncoder: GPUCommandEncoder) {
		this.particlesSimSettingsArr[0] = RenderingContext.elapsedTimeMs;
		this.particlesSimSettingsArr[1] = RenderingContext.deltaTimeMs;

		RenderingContext.device.queue.writeBuffer(
			this.particleSimSettingsBuffer,
			0,
			this.particlesSimSettingsArr,
		);

		const computePass = commandEncoder.beginComputePass({
			label: "Update Lights Compute Encoder",
		});
		computePass.setPipeline(this.computePSO);
		computePass.setBindGroup(0, this.computeBindGroup);

		const workgroupCountX = Math.ceil(
			this.allLights.length / LightingSystem.COMPUTE_WORKGROUP_SIZE_X,
		);
		computePass.dispatchWorkgroups(workgroupCountX, 1, 1);

		computePass.end();
	}

	public override render(renderPass: GPURenderPassEncoder) {
		renderPass.setPipeline(this.renderPSO);
		renderPass.setBindGroup(1, this.renderBindGroup);
		renderPass.setIndexBuffer(this.particleIndexBuffer, Drawable.INDEX_FORMAT);

		renderPass.drawIndexed(6, this.particles.length);
	}
}
