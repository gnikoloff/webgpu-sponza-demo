import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";
import { LightType } from "../types";

interface IPBRLightingShaderUtils {
	isDeferred: boolean;
	hasIBL: boolean;
}

const GetPBRLightingShaderUtils = ({
	isDeferred,
	hasIBL,
}): IPBRLightingShaderUtils => wgsl/* wgsl */ `
  @must_use
  fn DistributionGGX(N: vec3f, H: vec3f, roughness: f32) -> f32 {
    let a = roughness*roughness;
    let a2 = a*a;
    let NdotH = max(dot(N, H), 0.0);
    let NdotH2 = NdotH*NdotH;

    let nom   = a2;
    var denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / denom;
}

  @must_use
  fn GeometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
    let r = (roughness + 1.0);
    let k = (r * r) / 8;

    let nom   = NdotV;
    let denom = NdotV * (1.0 - k) + k;
    return nom / denom;
  }

  @must_use
  fn GeometrySmith(N: vec3f, V: vec3f, L: vec3f, roughness: f32) -> f32 {
    let NdotV = max(dot(N, V), 0.0);
    let NdotL = max(dot(N, L), 0.0);
    let ggx2 = GeometrySchlickGGX(NdotV, roughness);
    let ggx1 = GeometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
  }

  @must_use
  fn FresnelSchlick(cosTheta: f32, F0: vec3f) -> vec3f {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
  }

  @must_use
  fn FresnelSchlickRoughness(cosTheta: f32, F0: vec3f, roughness: f32) -> vec3f {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
  }

  @must_use
  fn PBRLighting(
    material: Material,
    instanceId: u32,
    viewSpacePos: vec3f,
    N: vec3f,
    V: vec3f,
    shadow: f32,
    opacity: f32,
    #if ${hasIBL}
      diffuseIBLTexture: texture_cube<f32>,
      specularIBLTexture: texture_cube<f32>,
      bdrfLutTexture: texture_2d<f32>,
      envTexSampler: sampler
    #endif
  ) -> vec4f {
    let albedo = material.albedo;
    let F0 = mix(vec3f(0.04), albedo, material.metallic);
    
    
    var Lo = vec3f(0.0);
    let albedoOverPi = albedo / PI;

    let roughness = material.roughness;
    let roughnessSq = roughness * roughness;
    let roughnessQuad = roughnessSq * roughnessSq;

    let metallic = material.metallic;

    let light = &lightsBuffer[instanceId];
    let lightPos = (camera.viewMatrix * vec4f(light.position, 1.0)).xyz;
    let isPointLight = light.lightType == ${LightType.Point};
    let dist = lightPos.xyz - viewSpacePos.xyz;
    let d = length(dist);

    let L = select(normalize(lightPos), normalize(dist), isPointLight);
    let H = normalize(V + L);


    // if (d > 1) {
    //   return vec4f(ambient, 1);
    // }

    // var pointLightAttenuation = 1 - (d / (light.radius));
    let pointLightAttenuation = 1 - smoothstep(0.0, light.radius, d);

    // pointLightAttenuation *= pointLightAttenuation;
    // let fade = max(0.0, 1.0 - d / 0.1);
    // pointLightAttenuation *= fade;
    var attenuation = select(1.0, pointLightAttenuation, isPointLight);
    attenuation *= attenuation;
    let radiance = light.color * attenuation * light.intensity;

    let NDF = DistributionGGX(N, H, roughnessQuad);
    let G = GeometrySmith(N, V, L, roughness);
    var F = FresnelSchlick(max(dot(H, V), 0.0), F0);

    let numerator = NDF * G * F;
    // let denominator = 4.0 * (NdotV * NdotL, 0.0001); // + 0.0001 to prevent divide by zero
    let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001; // + 0.0001 to prevent divide by zero

    var specular = numerator / denominator;

      // kS is equal to Fresnel
    var kS = F;
    // for energy conservation, the diffuse and specular light can't
    // be above 1.0 (unless the surface emits light); to preserve this
    // relationship the diffuse component (kD) should equal 1.0 - kS.
    var kD = vec3f(1.0 - kS);
    // multiply kD by the inverse metalness such that only non-metals
    // have diffuse lighting, or a linear blend if partly metal (pure metals
    // have no diffuse light).
    kD *= 1.0 - metallic;

    let NdotL = max(dot(N, L), 0.0); 

    // add to outgoing radiance Lo
    Lo += (kD * albedoOverPi + specular) * radiance * NdotL * shadow * material.ambientOcclusion; // * light.opacity;  // note that we already multiplied the BRDF by the Fresnel
  
    #if ${hasIBL}
      let irradiance = textureSampleLevel(diffuseIBLTexture, envTexSampler, N, 0).rgb;
      kS = FresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness); 
      kD = 1.0 - kS;
      kD *= 1.0 - metallic;
      // let ambientIBL = kD * irradiance;
      // let ambientFactor = 0.2;
      
      

      let R = reflect(-V, N);
      let MAX_REFLECTION_LOD = 8.0;
      let prefilteredColor = vec3f(
        textureSampleLevel(
          specularIBLTexture,
          envTexSampler,
          R,
          material.roughness * MAX_REFLECTION_LOD
        ).rgb
      );

      let uv = vec2f(max(dot(N, V), 0.0), roughness);
      let envBDRF = textureSample(bdrfLutTexture, envTexSampler, uv).rg;
      specular = prefilteredColor * (F * envBDRF.x + envBDRF.y);

      let diffuse = irradiance * (albedo * 0.2);
      // let ambient = (kD * diffuse) * ambientOcclusion;
      let ambient = kD * diffuse * (shadow + 0.5) * material.ambientOcclusion;
      
      
      var color = ambient + Lo;
    #else
      var color = Lo;
    #endif

    if (isPointLight && d > light.radius) {
      return vec4f(0);
    }

    return vec4f(color, opacity);
  }
`;

export default GetPBRLightingShaderUtils;
