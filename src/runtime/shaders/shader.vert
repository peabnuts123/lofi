#version 300 es
in vec3 vertexPosition;
in vec3 vertexColor;
in vec2 textureCoord;

out vec3 fragmentColor;
out vec2 fragmentTextureCoord;

uniform mat4 worldMatrix;

// @TODO use an #include for this
layout(std140) uniform Camera {
  mat4 viewProjectionMatrix;
};

void main() {
  gl_Position = viewProjectionMatrix * worldMatrix * vec4(vertexPosition, 1.0);
  fragmentColor = vertexColor;
  fragmentTextureCoord = textureCoord;
}
