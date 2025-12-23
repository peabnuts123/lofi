#version 300 es

#pragma inject(defines)

precision mediump float;

in vec3 fragmentColor;
in vec2 fragmentTextureCoord;
in vec3 fragmentLighting;

out vec4 outputColor;

#ifdef DIFFUSE_TEXTURE
uniform sampler2D sampler;
#endif

void main() {
  outputColor = vec4(fragmentColor, 1.0f) * vec4(fragmentLighting, 1.0f)
#ifdef DIFFUSE_TEXTURE
  * texture(sampler, fragmentTextureCoord)
#endif
  ;
}