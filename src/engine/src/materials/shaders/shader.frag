#version 300 es

#pragma inject(defines)

precision mediump float;

/* Fragment attributes */
in vec4 fragmentColor;
in vec3 fragmentLighting;
in vec3 worldNormal;
in vec3 worldPosition;
#ifdef DIFFUSE_TEXTURE
in vec2 fragmentTextureCoord;
#endif

/* Outputs */
out vec4 outputColor;

/* Uniforms */
#ifdef DIFFUSE_TEXTURE
uniform sampler2D diffuseTextureSampler;
#endif
#ifdef ALPHA_CLIPPING
uniform float alphaCutoff;
#endif
#ifdef REFLECTION
uniform samplerCube cubemapSampler;
uniform float cubemapIntensity;
#endif

/* UBOs */
// @TODO use an #include for this
layout(std140) uniform Camera {
  highp mat4 viewProjectionMatrix;
  highp vec3 cameraPosition;
};

void main() {
#ifdef DIFFUSE_TEXTURE
  vec4 sampledColor = texture(diffuseTextureSampler, fragmentTextureCoord);
#endif
#ifdef REFLECTION
  vec3 incidence = normalize(worldPosition - cameraPosition);
  // @NOTE Change swizzle of reflection angle to correct for Z=up
  vec3 reflection = reflect(incidence, normalize(worldNormal)).xzy;
  vec4 reflectionColor = vec4(texture(cubemapSampler, reflection).rgb, 1.0f) * cubemapIntensity;
#endif

  outputColor = fragmentColor * vec4(fragmentLighting, 1.0f)
#ifdef DIFFUSE_TEXTURE
  * sampledColor
#endif
#ifdef REFLECTION
  + reflectionColor
#endif
  ;

#if defined(FIXED_TRANSPARENCY_ALPHA)
  // Fixed alpha value for transparent pixels
  float isOpaque = step(1.0f, outputColor.a);
  outputColor.a = mix(FIXED_TRANSPARENCY_ALPHA, 1.0f, isOpaque);
#elif defined(ALPHA_BLENDING)
  // Alpha blending (outputColor.a remains untouched)
#elif defined(ALPHA_CLIPPING)
  // Alpha clipping
  if (outputColor.a < alphaCutoff) {
    discard;
  }
#else
  // Pixel is opaque
  outputColor.a = 1.0f;
#endif
}