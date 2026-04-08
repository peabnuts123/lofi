#version 300 es

#pragma inject(defines)

precision mediump float;

/* Fragment attributes */
in vec4 fragmentColor;
in vec3 fragmentLighting;
#ifdef DIFFUSE_TEXTURE
in vec2 fragmentTextureCoord;
#endif

/* Outputs */
out vec4 outputColor;

/* Uniforms */
#ifdef DIFFUSE_TEXTURE
uniform sampler2D sampler;
#endif
#ifdef ALPHA_CLIPPING
uniform float alphaCutoff;
#endif

void main() {
#ifdef DIFFUSE_TEXTURE
  vec4 sampledColor = texture(sampler, fragmentTextureCoord);
#endif

  outputColor = fragmentColor * vec4(fragmentLighting, 1.0f)
#ifdef DIFFUSE_TEXTURE
  * sampledColor
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