#version 300 es

#pragma inject(defines)

precision mediump float;

in vec4 fragmentColor;
in vec2 fragmentTextureCoord;
in vec3 fragmentLighting;

out vec4 outputColor;

#ifdef DIFFUSE_TEXTURE
uniform sampler2D sampler;
#endif

void main() {
#ifdef DIFFUSE_TEXTURE
  vec4 sampledColor = texture(sampler, fragmentTextureCoord);
#ifdef BLACK_IS_TRANSPARENT
  // If blackIsTransparent is set, always discard black, regardless of blending mode
  if (sampledColor.rgb == vec3(0.0)) {
    discard;
  }
#endif
#endif

  outputColor = fragmentColor * vec4(fragmentLighting, 1.0f)
#ifdef DIFFUSE_TEXTURE
  * sampledColor
#endif
  ;

#ifdef FIXED_TRANSPARENCY_ALPHA
  // Fixed alpha value for transparent pixels
  float isOpaque = step(1.0f, outputColor.a);
  outputColor.a = mix(FIXED_TRANSPARENCY_ALPHA, 1.0f, isOpaque);
#else
#ifndef USE_SOURCE_ALPHA_FOR_TRANSPARENCY
  // If not fixed alpha OR source alpha, then disable transparency
  outputColor.a = 1.0f;
#endif
  // else use source alpha (outputColor.a remains untouched)
#endif
}