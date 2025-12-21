#version 300 es

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

layout(std140) uniform Lighting {
  vec3 ambientLightColor;
  vec3 pointLight0Position;
  vec3 pointLight0Color;
  vec3 pointLight1Position;
  vec3 pointLight1Color;
  vec3 pointLight2Position;
  vec3 pointLight2Color;
  vec3 pointLight3Position;
  vec3 pointLight3Color;
};

void main() {
  vec4 worldPosition = worldMatrix * vec4(vertexPosition, 1.0);
  gl_Position = viewProjectionMatrix * worldPosition;
  fragmentColor = vertexColor;
  fragmentTextureCoord = textureCoord;

  // Lighting
  vec3 worldNormal = normalize(normalMatrix * vertexNormal);
  /* - Light 0 */
  vec3 light0Dir = normalize(pointLight0Position - worldPosition.xyz);
  float light0Intensity = max(dot(worldNormal, light0Dir), 0.0);
  /* - Light 1 */
  vec3 light1Dir = normalize(pointLight1Position - worldPosition.xyz);
  float light1Intensity = max(dot(worldNormal, light1Dir), 0.0);
  /* - Light 2 */
  vec3 light2Dir = normalize(pointLight2Position - worldPosition.xyz);
  float light2Intensity = max(dot(worldNormal, light2Dir), 0.0);
  /* - Light 3 */
  vec3 light3Dir = normalize(pointLight3Position - worldPosition.xyz);
  float light3Intensity = max(dot(worldNormal, light3Dir), 0.0);
  fragmentLighting = ambientLightColor
    + (light0Intensity * pointLight0Color)
    + (light1Intensity * pointLight1Color)
    + (light2Intensity * pointLight2Color)
    + (light3Intensity * pointLight3Color);
}
