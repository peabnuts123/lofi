#version 300 es

#pragma inject(defines)

/* Lighting constants */
// `Constant` coefficient in lighting formula
#define LIGHTING_COEFFICIENT_CONSTANT 1.0f
// `Linear` coefficient in lighting formula
#define LIGHTING_COEFFICIENT_LINEAR 0.0f
// Value of lighting formula at `range`
#define LIGHTING_INTENSITY_AT_MAX_RANGE 0.1f

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
  vec4 pointLightIntensities[MAX_POINT_LIGHTS];
  vec4 pointLightRanges[MAX_POINT_LIGHTS];
  vec4 directionalLightOrientations[MAX_DIRECTIONAL_LIGHTS];
  vec4 directionalLightColors[MAX_DIRECTIONAL_LIGHTS];
  vec4 directionalLightIntensities[MAX_POINT_LIGHTS];
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
  // @NOTE `worldMatrix` is premultiplied by `localMatrix` if no skin
  vec4 worldPositionVec4 = worldMatrix * vec4(vertexPosition, 1.0f);
#endif
  worldPosition = worldPositionVec4.xyz / worldPositionVec4.w;
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
  mat3 skinNormalMatrix = transpose(inverse(mat3(skinMatrix)));
  worldNormal = normalize(normalMatrix * skinNormalMatrix * vertexNormal);
#else
  // @NOTE `normalMatrix` is premultiplied (before inverting/transposing) by `localMatrix` if no skin
  worldNormal = normalize(normalMatrix * vertexNormal);
#endif
#ifdef UNLIT
  fragmentLighting = vec3(1.0f, 1.0f, 1.0f);
#else
  // Ambient lighting
  fragmentLighting = ambientLightColor.rgb;

  // Point lights
  for(int i = 0; i < MAX_POINT_LIGHTS; i++) {
    float lightRange = pointLightRanges[i].x;
    if(lightRange > 0.0f) {
      float lightRangeSqr = lightRange * lightRange;
      vec3 lightVector = pointLightPositions[i].xyz - worldPosition;
      float lightDistanceSqr = dot(lightVector, lightVector);

// @TODO REMOVE ALL THESE OTHER OPTIONS, just committing for posterity
      // // Cut off light after max range, or at distance = 0
      if(lightDistanceSqr > 0.0f /* && lightDistanceSqr <= lightRangeSqr */) {
        float lightDistance = sqrt(lightDistanceSqr);
        vec3 lightDir = normalize(lightVector);
        float intensity = pointLightIntensities[i].x * max(dot(worldNormal, lightDir), 0.0f);

        // @NOTE Classic GL lighting formula:
        //  Attenuation = 1 / (K_c + K_l * d + K_q * d^2)
        // d   = Distance to light source
        // K_c = Constant lighting coefficient
        // K_l = Linear lighting coefficient
        // K_q = Quadratic lighting coefficient
        // @NOTE GL Compliant
        // float coefficientQuadratic = 1.0f / (2.0 * LIGHTING_INTENSITY_AT_MAX_RANGE * lightRangeSqr);
        float coefficientQuadratic = ((1.0f / LIGHTING_INTENSITY_AT_MAX_RANGE) - 1.0f) / lightRangeSqr;
        fragmentLighting += (intensity * pointLightColors[i].rgb) / (LIGHTING_COEFFICIENT_CONSTANT + LIGHTING_COEFFICIENT_LINEAR * lightDistance + coefficientQuadratic * lightDistanceSqr);

        // @NOTE GL Compliant "half range"
        // float coefficientQuadratic = 1.0f / lightRangeSqr;
        // fragmentLighting += (intensity * pointLightColors[i].rgb) / (LIGHTING_COEFFICIENT_CONSTANT + LIGHTING_COEFFICIENT_LINEAR * lightDistance + coefficientQuadratic * lightDistanceSqr);

        // @NOTE Other guy's
        // float s = lightDistance / lightRange;
        // float Q = 3.0f;
        // fragmentLighting += (intensity * pointLightColors[i].rgb) * ((1.0f - s * s) * (1.0f - s * s)) / (1.0f + Q * s);

        // @NOTE QUADRATIC
        // fragmentLighting += (intensity * pointLightColors[i].rgb) * ((lightDistanceSqr/lightRangeSqr) - (2.0f * lightDistance / lightRange) + 1.0f);

        // @NOTE LINEAR
        // fragmentLighting += (intensity * pointLightColors[i].rgb) * (-lightDistance / lightRange + 1.0f);

        // @NOTE CUTOFF
        // float intensity = max(dot(worldNormal, lightDir), 0.0f);
        // fragmentLighting += (intensity * pointLightColors[i].rgb);
      }
    }
  }

  // Directional lights
  for(int i = 0; i < MAX_DIRECTIONAL_LIGHTS; i++) {
    vec3 lightDir = normalize(-directionalLightOrientations[i].xyz);
    float intensity = max(dot(worldNormal, lightDir), 0.0f);
    fragmentLighting += intensity * directionalLightIntensities[i].x * directionalLightColors[i].rgb;
  }
#endif
}
