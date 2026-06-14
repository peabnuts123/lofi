#version 300 es

#pragma inject(defines)

/* Defaults */
#ifndef MAX_POINT_LIGHTS
  #define MAX_POINT_LIGHTS 1 // @NOTE Zero-length arrays not valid
#endif
#ifndef MAX_DIRECTIONAL_LIGHTS
  #define MAX_DIRECTIONAL_LIGHTS 1 // @NOTE Zero-length arrays not valid
#endif

/* Vertex attributes */
// Required
in vec3 vertexPosition;
in vec3 vertexNormal;
// Optional
#ifdef DIFFUSE_TEXTURE
in vec2 textureCoord;
#endif
#ifdef VERTEX_COLORS
in vec4 vertexColor;
#endif
#ifdef SKIN
in vec4 vertexJoints;
in vec4 vertexWeights;
#endif

/* Uniforms */
// Required
uniform mat4 worldMatrix;
uniform mat4 localMatrix;
uniform mat3 normalMatrix;
// Optional
#ifdef DIFFUSE_COLOR
uniform vec4 diffuseColor;
#endif
#ifdef SKIN
uniform mat4 jointMatrix[MAX_BONES];
#endif

/* Shader outputs */
out vec4 fragmentColor;
out vec3 fragmentLighting;
out vec3 worldNormal;
out vec3 worldPosition;
#ifdef DIFFUSE_TEXTURE
out vec2 fragmentTextureCoord;
#endif

/* UBOs */
// @TODO use an #include for this
layout(std140) uniform Camera {
  mat4 viewProjectionMatrix;
  vec3 cameraPosition;
};
layout(std140) uniform Lighting {
  vec3 ambientLightColor;
  // @NOTE Arrays are padded to vec4 under std140
  vec4 pointLightPositions[MAX_POINT_LIGHTS];
  vec4 pointLightColors[MAX_POINT_LIGHTS];
  vec4 directionalLightOrientations[MAX_DIRECTIONAL_LIGHTS];
  vec4 directionalLightColors[MAX_DIRECTIONAL_LIGHTS];
};

void main() {
  // Geometry
#ifdef SKIN
  // @NOTE Ignore skin if weights are all zero
  float totalWeight = vertexWeights.x + vertexWeights.y + vertexWeights.z + vertexWeights.w;
  mat4 skinMatrix;
  if(totalWeight > 0.0f) {
    skinMatrix = vertexWeights.x * jointMatrix[int(vertexJoints.x)] +
      vertexWeights.y * jointMatrix[int(vertexJoints.y)] +
      vertexWeights.z * jointMatrix[int(vertexJoints.z)] +
      vertexWeights.w * jointMatrix[int(vertexJoints.w)];
  } else {
    skinMatrix = mat4(1.0f);
  }
  vec4 worldPositionVec4 = worldMatrix * skinMatrix * vec4(vertexPosition, 1.0f);
#else
  vec4 worldPositionVec4 = worldMatrix * localMatrix * vec4(vertexPosition, 1.0f);
#endif
  worldPosition = vec3(worldPositionVec4);
  gl_Position = viewProjectionMatrix * worldPositionVec4;

  // Color
  fragmentColor = vec4(1.0f, 1.0f, 1.0f, 1.0f);
#ifdef VERTEX_COLORS
  fragmentColor *= vertexColor;
#endif
#ifdef DIFFUSE_COLOR
  fragmentColor *= diffuseColor;
#endif

#ifdef DIFFUSE_TEXTURE
  // Texturing
  fragmentTextureCoord = textureCoord;
#endif

  // Lighting
#ifdef SKIN
  vec3 skinnedNormal = normalize(transpose(inverse(mat3(skinMatrix))) * vertexNormal);
  worldNormal = normalize(normalMatrix * skinnedNormal);
#else
  worldNormal = normalize(normalMatrix * vertexNormal);
#endif
#ifdef UNLIT
  fragmentLighting = vec3(1.0f, 1.0f, 1.0f);
#else
  // Ambient lighting
  fragmentLighting = ambientLightColor.rgb;

  // Point lights
  for(int i = 0; i < MAX_POINT_LIGHTS; i++) {
    vec3 lightDir = normalize(pointLightPositions[i].xyz - worldPosition);
    float intensity = max(dot(worldNormal, lightDir), 0.0f);
    fragmentLighting += intensity * pointLightColors[i].rgb;
  }

  // Directional lights
  for(int i = 0; i < MAX_DIRECTIONAL_LIGHTS; i++) {
    vec3 lightDir = normalize(-directionalLightOrientations[i].xyz);
    float intensity = max(dot(worldNormal, lightDir), 0.0f);
    fragmentLighting += intensity * directionalLightColors[i].rgb;
  }
#endif
}
