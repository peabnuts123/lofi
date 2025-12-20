#version 300 es
precision mediump float;

in vec3 fragmentColor;
in vec2 fragmentTextureCoord;
in vec3 fragmentLighting;

out vec4 outputColor;

uniform sampler2D sampler;

void main() {
  outputColor = texture(sampler, fragmentTextureCoord)
    * vec4(fragmentColor, 1.0f)
    * vec4(fragmentLighting, 1.0);
}