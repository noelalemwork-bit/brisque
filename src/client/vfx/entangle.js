// GLSL for sampling the Moth Entanglement Shader's lookup tables (entanglement-shader-v1, ported from
// the entanglement_texture.glsl the engine ships). The engine bakes scalar reflectance R and
// transmittance T over (film phase s, incident angle t); colour comes from evaluating the phase at
// three wavelengths (650 / 530 / 470 nm) for an interlayer spacing `thick` (nm).
// Our packed PNG (tools/prerender/run.mjs) holds R in rows [0,h) and T in rows [h,2h), row 0 = theta 0,
// loaded with flipY = false; S wraps (periodic phase), angle rows are clamped to their half.

export const ENTANGLE_LUT_ROWS = 64;

export const ENTANGLE_GLSL = /* glsl */ `
  // returns R (rgb) in .rgb of r, T in .rgb of t
  void entangleRT(sampler2D lut, float cosT, float thick, out vec3 r, out vec3 t) {
    const float H = ${ENTANGLE_LUT_ROWS}.0;
    cosT = clamp(cosT, 0.0, 1.0);
    float a = acos(cosT) / 1.5707963;
    float D = -2.0 * 6.2831853 * thick * cosT;
    vec3 s = fract(D / vec3(650.0, 530.0, 470.0) / 6.2831853);
    float row = (0.5 + a * (H - 1.0)) / (2.0 * H);
    float vR = row;
    float vT = row + 0.5;
    r = vec3(texture2D(lut, vec2(s.r, vR)).r, texture2D(lut, vec2(s.g, vR)).r, texture2D(lut, vec2(s.b, vR)).r);
    t = vec3(texture2D(lut, vec2(s.r, vT)).r, texture2D(lut, vec2(s.g, vT)).r, texture2D(lut, vec2(s.b, vT)).r);
  }
  // thin-film tint around 1.0: each channel relative to the mean, so hue shifts survive any brightness
  vec3 entangleTint(vec3 c, float gain) {
    float m = max((c.r + c.g + c.b) / 3.0, 1e-3);
    return clamp(vec3(1.0) + (c / m - 1.0) * gain, 0.0, 2.0);
  }
`;
