#version 300 es
/* @TODO */
// in vec3 light0Position;
// in vec3 light0Color;

in vec3 vertexPosition;
in vec3 vertexColor;
in vec3 vertexNormal;
in vec2 textureCoord;

out vec3 fragmentColor;
out vec2 fragmentTextureCoord;
out vec3 fragmentLighting;

uniform mat4 worldMatrix;
uniform mat3 normalMatrix;

// @TODO use an #include for this
layout(std140) uniform Camera {
  mat4 viewProjectionMatrix;
};

void main() {
  vec4 worldPosition = worldMatrix * vec4(vertexPosition, 1.0);
  gl_Position = viewProjectionMatrix * worldPosition;
  fragmentColor = vertexColor;
  fragmentTextureCoord = textureCoord;

  // Lighting
  vec3 mockLightPosition = vec3(2, 1, 2);
  vec3 mockLightColor = vec3(1, 1, 1);
  vec3 mockAmbientLightColor = vec3(0.3, 0.3, 0.3);

  vec3 worldNormal = normalize(normalMatrix * vertexNormal);
  vec3 lightDir = normalize(mockLightPosition - worldPosition.xyz);
  float lightingDiffuse = max(dot(worldNormal, lightDir), 0.0);
  fragmentLighting = mockAmbientLightColor + (lightingDiffuse * mockLightColor);
}
