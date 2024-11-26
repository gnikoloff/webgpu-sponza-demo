const PBR_LIGHTING_UTILS_SHADER_CHUNK_SRC = /* wgsl */ `
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
  fn PBRLighting(
    material: ptr<function, Material>,
    instanceId: u32,
    worldPos: vec3f,
    N: vec3f,
    V: vec3f,
    shadow: f32
  ) -> vec4f {
    let albedo = material.albedo;
    let F0 = mix(vec3f(0.04), albedo, material.metallic);
    var ambientFactor = vec3f(0.005);
    let ambient = (ambientFactor) * albedo * material.ambientOcclusion;
    var Lo = vec3f(0.0);
    let albedoOverPi = albedo / PI;

    let roughness = material.roughness;
    let roughnessSq = roughness * roughness;
    let roughnessQuad = roughnessSq * roughnessSq;

    let metallic = material.metallic;
    let ambientOcclusion = material.ambientOcclusion;

    let light = &lightsBuffer[instanceId];
    let lightPos = light.position;
    let isPointLight = light.lightType == 1;
    let dist = lightPos - worldPos;
    let d = length(dist);

    if (isPointLight && d > light.radius) {
      return vec4f(0);
    }

    // if (d > light.radius) {
    //   return vec4f(ambient, 1.0);
    // }

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
    let F = FresnelSchlick(max(dot(H, V), 0.0), F0);

    let numerator = NDF * G * F;
    // let denominator = 4.0 * (NdotV * NdotL, 0.0001); // + 0.0001 to prevent divide by zero
    let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001; // + 0.0001 to prevent divide by zero

    let specular = numerator / denominator;

      // kS is equal to Fresnel
    let kS = F;
    // for energy conservation, the diffuse and specular light can't
    // be above 1.0 (unless the surface emits light); to preserve this
    // relationship the diffuse component (kD) should equal 1.0 - kS.
    var kD = vec3f(1.0 - kS);
    // multiply kD by the inverse metalness such that only non-metals
    // have diffuse lighting, or a linear blend if partly metal (pure metals
    // have no diffuse light).
    kD *= 1.0 - metallic;

//    kD *= shadow;

    let NdotL = max(dot(N, L), 0.0); 

    // add to outgoing radiance Lo
    Lo += (kD * albedoOverPi + specular) * radiance * NdotL * shadow; // * light.opacity;  // note that we already multiplied the BRDF by the Fresnel
  

    // half3 ambient = (ambientFactor + ambientIBL) * materialAlbedo * ambientOcclusion;
    

    // let color = ambient + specularIBL + Lo;
    var color = ambient + Lo;

    // HDR tonemapping
    // color = color / (color + vec3(1.0));
    // gamma correct
    // color = pow(color, vec3(1.0/2.2)); 

    return vec4f(color, 1.0);
  }
`;

export default PBR_LIGHTING_UTILS_SHADER_CHUNK_SRC;
