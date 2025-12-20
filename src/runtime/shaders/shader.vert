#version 300 es
in vec3 vertexPosition;
in vec3 vertexColor;

out vec3 fragmentColor;

uniform mat4 worldMatrix;

// @TODO use an #include for this
layout(std140) uniform Camera {
  mat4 viewProjectionMatrix;
};

void main() {
  fragmentColor = vertexColor;

  gl_Position = viewProjectionMatrix * worldMatrix * vec4(vertexPosition, 1.0);
}
