// SPDX-License-Identifier: MIT
// Original display shader. This changes appearance only, never muscle geometry.
// Fiber directions are an illustrative approximation from shape and muscle names,
// not measured fascicles, a contraction simulation, or a clinical anatomy model.

const VERSION = 'anatomy-tissue-2';
// Shader state belongs to the material. Temporary Mesh -> SkinnedMesh wrappers
// share materials but may outlive neither their userData nor shadow properties.
// Symbols are intentionally excluded from userData/GLTF JSON serialization.
const ANATOMY_ORIGINAL_OWNER = Symbol.for('anatomy.original-material-owner.v1');
const ABDOMINAL_MATERIAL_STATE = Symbol.for('anatomy.abdominal-material-state.v1');
const ABDOMINAL_SHADER_UNIFORMS = Symbol.for('anatomy.abdominal-shader-uniforms.v1');

function anatomyName(mesh) {
  return String(mesh.userData?.name || mesh.name || '').replaceAll('_', ' ').toLowerCase();
}

function principalFrame(geometry, T) {
  const a = geometry.getAttribute('position');
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox.clone();
  const center = box.getCenter(new T.Vector3());
  const size = box.getSize(new T.Vector3());
  const span = Math.max(size.x, size.y, size.z, 1e-6);
  const mean = new T.Vector3();
  const step = Math.max(1, Math.floor(a.count / 1500));
  let count = 0;
  for (let i = 0; i < a.count; i += step) {
    mean.x += a.getX(i); mean.y += a.getY(i); mean.z += a.getZ(i); count++;
  }
  mean.multiplyScalar(1 / Math.max(count, 1));
  const covariance = new Float64Array(9);
  for (let i = 0; i < a.count; i += step) {
    const x = (a.getX(i) - mean.x) / span;
    const y = (a.getY(i) - mean.y) / span;
    const z = (a.getZ(i) - mean.z) / span;
    covariance[0] += x*x; covariance[1] += x*y; covariance[2] += x*z;
    covariance[4] += y*y; covariance[5] += y*z; covariance[8] += z*z;
  }
  covariance[3] = covariance[1]; covariance[6] = covariance[2]; covariance[7] = covariance[5];
  // Start on the largest variance, preventing a perpendicular seed on long limbs.
  const axis = new T.Vector3(1, 0, 0);
  if (covariance[4] > covariance[0] && covariance[4] >= covariance[8]) axis.set(0, 1, 0);
  else if (covariance[8] > covariance[0]) axis.set(0, 0, 1);
  const next = new T.Vector3();
  for (let i = 0; i < 18; i++) {
    next.set(
      covariance[0]*axis.x + covariance[1]*axis.y + covariance[2]*axis.z,
      covariance[3]*axis.x + covariance[4]*axis.y + covariance[5]*axis.z,
      covariance[6]*axis.x + covariance[7]*axis.y + covariance[8]*axis.z
    );
    if (next.lengthSq() < 1e-15) break;
    axis.copy(next).normalize();
  }
  if (axis.y < 0) axis.negate();
  const guide = Math.abs(axis.z) < 0.85 ? new T.Vector3(0, 0, 1) : new T.Vector3(1, 0, 0);
  const cross = new T.Vector3().crossVectors(axis, guide).normalize();
  const depth = new T.Vector3().crossVectors(axis, cross).normalize();
  return { box, center, size, span, axis, cross, depth };
}

const FRAGMENT_DECLARATIONS = /* glsl */`
varying vec3 vAnatomyRest;
uniform vec3 uAnatomyAxis;
uniform vec3 uAnatomyCross;
uniform vec3 uAnatomyDepth;
uniform vec3 uAnatomyFan;
uniform vec3 uAnatomyCoral;
uniform float uAnatomyMode;
uniform float uAnatomySide;
uniform float uAnatomyFrequency;
uniform float uAnatomyFineFrequency;
uniform float uAnatomyBump;

float anatomyFilteredWave(float phase) {
  // Suppress subpixel lines instead of introducing moire when zoomed out.
  return sin(phase) * (1.0 - smoothstep(0.65, 2.8, fwidth(phase)));
}

vec2 anatomyFiber(vec3 p) {
  float along = dot(p, uAnatomyAxis);
  float across = dot(p, uAnatomyCross);
  float depth = dot(p, uAnatomyDepth);
  float angle;
  float drift;
  if (uAnatomyMode > 0.5) {
    // A shared insertion-side focus joins the separate pectoralis heads.
    // A small floor avoids a singularity exactly at the illustrative focus.
    vec3 d = p - uAnatomyFan;
    float medial = max(-uAnatomySide * d.x, 0.025);
    angle = atan(d.y, medial);
    drift = 0.18 * sin(length(d.xy) * 11.0);
  } else {
    // Longitudinal bundles on each muscle, with a continuous cylindrical wrap.
    // Frequency is an integer; the atan seam therefore has the same phase.
    angle = atan(depth, across + 1e-7);
    drift = 0.25 * sin(along * 8.0) + 0.08 * sin(along * 21.0);
  }
  float phase = angle * uAnatomyFrequency + drift;
  // Fine fibers bend with their parent bundle. Their scale comes from each
  // muscle's measured cross-section (or the radius of its pectoral fan).
  float finePhase = angle * uAnatomyFineFrequency
                  + drift * (uAnatomyFineFrequency / uAnatomyFrequency)
                  + 0.13 * sin(along * 35.0 + angle * 4.0);
  float bundle = 0.76 * anatomyFilteredWave(phase)
               + 0.24 * anatomyFilteredWave(phase * 2.0 + 0.2);
  return vec2(bundle, anatomyFilteredWave(finePhase));
}
`;

const COLOR_FRAGMENT = /* glsl */`
#include <color_fragment>
vec3 anatomySource = diffuseColor.rgb;
vec3 anatomyVertex = vec3(1.0);
#if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
  anatomyVertex = vColor.rgb;
#endif
// Red dominance, rather than brightness, separates muscle from pale tendon.
// The source's tendon color and baked AO remain untouched where this mask is 0.
float anatomyRedness = (anatomyVertex.r - max(anatomyVertex.g, anatomyVertex.b))
                    / max(anatomyVertex.r, 0.0001);
float anatomyMuscleMask = smoothstep(0.48, 0.78, anatomyRedness);
float anatomyOcclusion = clamp(sqrt(max(anatomyVertex.r, 0.0) / 0.44), 0.47, 1.0);
vec3 anatomyPigment = diffuse * uAnatomyCoral * anatomyOcclusion;
diffuseColor.rgb = mix(anatomySource, anatomyPigment, anatomyMuscleMask * 0.82);
vec2 anatomyGrain = anatomyFiber(vAnatomyRest);
diffuseColor.rgb *= 1.0 + anatomyMuscleMask * dot(anatomyGrain, vec2(0.035, 0.024));
`;

const NORMAL_FRAGMENT = /* glsl */`
#include <normal_fragment_maps>
// Surface-gradient bump in the *deformed* view-space surface. Rest coordinates
// travel with vertices, so a future skin/morph rig will carry this pattern.
// No positions/normals/UV attributes on the asset are changed by this helper.
// The 0.8mm striation has much less height than the wide bundle, preserving
// a matte tissue surface instead of making every fine line a glossy ridge.
float anatomyHeight = uAnatomyBump * anatomyMuscleMask * dot(anatomyGrain, vec2(0.80, 0.15));
vec3 anatomyDx = dFdx(-vViewPosition);
vec3 anatomyDy = dFdy(-vViewPosition);
vec3 anatomyRx = cross(anatomyDy, normal);
vec3 anatomyRy = cross(normal, anatomyDx);
float anatomyDet = dot(anatomyDx, anatomyRx);
if (abs(anatomyDet) > 1e-12) {
  vec3 anatomyGradient = (anatomyRx * dFdx(anatomyHeight)
                        + anatomyRy * dFdy(anatomyHeight)) / anatomyDet;
  // Keep this a shallow material detail, never a replacement for anatomy.
  anatomyGradient *= min(1.0, 0.18 / max(length(anatomyGradient), 0.0001));
  normal = normalize(normal - anatomyGradient);
}
`;

function fiberFrequencies(mesh, frame, fan, isFan, worldHeight, T) {
  const p = mesh.geometry.getAttribute('position');
  const step = Math.max(1, Math.floor(p.count / 1500));
  const v = new T.Vector3();
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  const radii = [];
  for (let i = 0; i < p.count; i += step) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)).sub(frame.center);
    const u = v.dot(frame.cross), depth = v.dot(frame.depth);
    minU = Math.min(minU, u); maxU = Math.max(maxU, u);
    minV = Math.min(minV, depth); maxV = Math.max(maxV, depth);
    if (isFan) radii.push(Math.hypot(v.x - fan.x*frame.span, v.y - fan.y*frame.span));
  }
  const worldScale = new T.Vector3().setFromMatrixScale(mesh.matrixWorld);
  // Display scale calibration only: a 1.70m reference height makes detail
  // density stable if the caller resizes the whole model. This is not a claim
  // of measured fascicle dimensions or the depicted individual's height.
  const metersPerLocal = Math.max(worldScale.x, worldScale.y, worldScale.z) * 1.70 / worldHeight;
  let circumference;
  if (isFan) {
    radii.sort((a,b) => a-b);
    circumference = 2*Math.PI*radii[Math.floor((radii.length-1)*0.7)]*metersPerLocal;
  } else {
    const a = Math.max((maxU-minU)*0.5, 1e-6), b = Math.max((maxV-minV)*0.5, 1e-6);
    circumference = Math.PI*(3*(a+b)-Math.sqrt((3*a+b)*(a+3*b)))*metersPerLocal;
  }
  return {
    bundle: Math.max(8, Math.min(96, Math.round(circumference/0.0075))),
    fine: Math.max(16, Math.min(3072, Math.round(circumference/0.0008))),
    nominalFinePitchMeters: 0.0008
  };
}

function makeTissue(source, mesh, frame, fanBox, worldHeight, T) {
  const material = new T.MeshPhysicalMaterial();
  // Copy standard properties explicitly; Material.copy between different
  // classes does not initialize the physical model consistently across Three.
  for (const key of ['name', 'side', 'transparent', 'opacity', 'alphaTest', 'depthWrite',
    'depthTest', 'map', 'normalMap', 'normalMapType', 'bumpMap', 'bumpScale',
    'displacementMap', 'displacementScale', 'displacementBias', 'aoMap', 'aoMapIntensity',
    'emissiveMap', 'emissiveIntensity', 'envMap', 'envMapIntensity']) {
    if (source[key] !== undefined) material[key] = source[key];
  }
  material.color.copy(source.color || new T.Color(0xffffff));
  material.emissive.copy(source.emissive || new T.Color(0));
  if (source.normalScale) material.normalScale.copy(source.normalScale);
  material.vertexColors = !!mesh.geometry.getAttribute('color');
  material.metalness = 0;
  material.roughness = 0.56;
  material.ior = 1.38;
  material.specularIntensity = 0.32;
  material.clearcoat = 0.035;
  material.clearcoatRoughness = 0.64;
  material.sheen = 0;
  material.transmission = 0;
  const side = /right/.test(anatomyName(mesh)) ? -1 : 1;
  const fan = new T.Vector3();
  if (fanBox) {
    const s = fanBox.getSize(new T.Vector3());
    fan.set(side > 0 ? fanBox.max.x : fanBox.min.x,
      fanBox.min.y + s.y * 0.68, (fanBox.min.z + fanBox.max.z) * 0.5);
    fan.sub(frame.center).multiplyScalar(1 / frame.span);
  }
  const frequencies = fiberFrequencies(mesh, frame, fan, !!fanBox, worldHeight, T);
  // Two scales: visible bundles and an antialiased ~0.8mm fine striation.
  const uniforms = {
    uAnatomyCenter: { value: frame.center }, uAnatomyInvSpan: { value: 1 / frame.span },
    uAnatomyAxis: { value: frame.axis }, uAnatomyCross: { value: frame.cross },
    uAnatomyDepth: { value: frame.depth }, uAnatomyFan: { value: fan },
    uAnatomyCoral: { value: new T.Color('#b96855') },
    uAnatomyMode: { value: fanBox ? 1 : 0 }, uAnatomySide: { value: side },
    uAnatomyFrequency: { value: frequencies.bundle },
    uAnatomyFineFrequency: { value: frequencies.fine },
    uAnatomyBump: { value: worldHeight * 0.000035 }
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vAnatomyRest;
      uniform vec3 uAnatomyCenter;
      uniform float uAnatomyInvSpan;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vAnatomyRest = (position - uAnatomyCenter) * uAnatomyInvSpan;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\n' + FRAGMENT_DECLARATIONS)
      .replace('#include <color_fragment>', COLOR_FRAGMENT)
      .replace('#include <normal_fragment_maps>', NORMAL_FRAGMENT);
  };
  material.customProgramCacheKey = () => VERSION;
  material.userData.anatomyTissue = { version: VERSION, uniforms, frequencies,
    limits: 'Illustrative rest-space fiber direction; no physiological contraction or clinical validation.' };
  return material;
}

/** Apply once to the Ecorche scene, before creating its exercise rig.
 *  Replaced source materials are retained for the caller's resource disposal;
 *  this function never disposes potentially shared materials or edits geometry.
 *  GLB-specific fan coordinates assume the source's shared Y-up anatomy frame.
 */
export function enhanceAnatomy(root, T) {
  if (!root?.traverse || !T?.MeshPhysicalMaterial) return;
  root.updateMatrixWorld(true);
  const worldHeight = Math.max(new T.Box3().setFromObject(root).getSize(new T.Vector3()).y, 1e-4);
  const muscles = [];
  const pectoralBoxes = { left: new T.Box3(), right: new T.Box3() };
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh.userData.anatomyMaterialEnhanced) return;
    const data = mesh.userData || {};
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const isMuscle = data.tissue === 'muscle' || /muscle/i.test(data.layer || '')
      || materials.some(m => /muscle/i.test(m?.name || ''));
    if (!isMuscle || !mesh.geometry?.getAttribute('position')?.count) return;
    const frame = principalFrame(mesh.geometry, T);
    const name = anatomyName(mesh);
    if (/gluteus maximus/.test(name)) {
      const side=/right/.test(name)?-1:1;
      frame.axis.set(.80*side,-.61,.17).normalize();
      frame.cross.crossVectors(frame.axis,new T.Vector3(0,0,1)).normalize();
      frame.depth.crossVectors(frame.axis,frame.cross).normalize();
    }
    if (/pectoralis major/.test(name)) pectoralBoxes[/right/.test(name) ? 'right' : 'left'].union(frame.box);
    muscles.push({ mesh, frame, name, materials });
  });
  for (const { mesh, frame, name, materials } of muscles) {
    const box = /pectoralis major/.test(name) ? pectoralBoxes[/right/.test(name) ? 'right' : 'left'] : null;
    const replacements = materials.map(source => makeTissue(source, mesh, frame, box, worldHeight, T));
    for (const material of replacements) material[ANATOMY_ORIGINAL_OWNER] = mesh;
    mesh.userData.anatomyOriginalMaterials = materials;
    mesh.material = Array.isArray(mesh.material) ? replacements : replacements[0];
    mesh.userData.anatomyMaterialEnhanced = VERSION;
  }
}

const ABDOMINAL_SLICES = 32;
const ABDOMINAL_VERTEX = /* glsl */`
varying vec3 vAbdominalRest;
varying float vAbdominalRedness;
uniform vec3 uAbdominalOrigin;
uniform float uAbdominalInvHeight;
`;
const ABDOMINAL_FRAGMENT = /* glsl */`
varying vec3 vAbdominalRest;
varying float vAbdominalRedness;
uniform float uAbdominalEnabled;
uniform vec3 uAbdominalProfile[32];
bool abdominalSheathWindow() {
  if (uAbdominalEnabled < 0.5 || vAbdominalRedness >= 0.48) return false;
  if (vAbdominalRest.y < -0.008 || vAbdominalRest.y > 1.008) return false;
  float slice = clamp(vAbdominalRest.y, 0.0, 1.0) * 31.0;
  int a = int(floor(slice));
  int b = min(a + 1, 31);
  // x/y hold the actual rectus envelope; z excludes the posterior surface.
  vec3 boundary = mix(uAbdominalProfile[a], uAbdominalProfile[b], fract(slice));
  return vAbdominalRest.x >= boundary.x && vAbdominalRest.x <= boundary.y
      && vAbdominalRest.z >= boundary.z;
}
`;

function sheathProfile(rectus, external, T) {
  // Convert the real rectus surface into the external-oblique rest frame;
  // no fabricated replacement surface or vertex edits are introduced.
  const transform = external.matrixWorld.clone().invert().multiply(rectus.matrixWorld);
  const p = rectus.geometry.getAttribute('position');
  const points = [];
  const bounds = new T.Box3();
  for (let i = 0; i < p.count; i++) {
    const v = new T.Vector3(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(transform);
    points.push(v); bounds.expandByPoint(v);
  }
  const height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(height) || height <= 1e-6) return null;
  const origin = new T.Vector3(0, bounds.min.y, (bounds.min.z + bounds.max.z) * 0.5);
  const bins = Array.from({ length: ABDOMINAL_SLICES }, () => ({
    minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity
  }));
  for (const v of points) {
    v.sub(origin).multiplyScalar(1 / height);
    const bin = bins[Math.max(0, Math.min(31, Math.round(v.y * 31)))];
    bin.minX = Math.min(bin.minX, v.x); bin.maxX = Math.max(bin.maxX, v.x);
    bin.minZ = Math.min(bin.minZ, v.z); bin.maxZ = Math.max(bin.maxZ, v.z);
  }
  // Mesh samples can skip a thin band; fill only from the closest existing band.
  for (let i = 0; i < bins.length; i++) {
    if (Number.isFinite(bins[i].minX)) continue;
    let nearest = -1;
    for (let j = 0; j < bins.length; j++) {
      if (Number.isFinite(bins[j].minX) && (nearest < 0 || Math.abs(j-i) < Math.abs(nearest-i))) nearest = j;
    }
    if (nearest < 0) return null;
    bins[i] = { ...bins[nearest] };
  }
  return {
    origin, inverseHeight: 1 / height,
    // 1.2% of rectus height is a narrow viewing margin (~5mm on this model).
    profile: bins.map(b => new T.Vector3(b.minX - 0.012, b.maxX + 0.012, (b.minZ + b.maxZ) * 0.5))
  };
}

function installSheathShader(material, uniforms) {
  if (material[ABDOMINAL_SHADER_UNIFORMS]) {
    if (material[ABDOMINAL_SHADER_UNIFORMS] !== uniforms) {
      throw new Error('Abdominal shader already belongs to another window state.');
    }
    return;
  }
  const previousHook = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.vertexColors = true;
  material.onBeforeCompile = function(shader, renderer) {
    previousHook.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + ABDOMINAL_VERTEX)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vAbdominalRest = (position - uAbdominalOrigin) * uAbdominalInvHeight;
        vAbdominalRedness = 1.0;
        #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
          vAbdominalRedness = (color.r - max(color.g, color.b)) / max(color.r, 0.0001);
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + ABDOMINAL_FRAGMENT)
      .replace(/void\s+main\s*\(\s*\)\s*\{/, 'void main() {\n if (abdominalSheathWindow()) discard;');
  };
  material.customProgramCacheKey = () => previousKey + '|virtual-rectus-sheath-window-1';
  material[ABDOMINAL_SHADER_UNIFORMS] = uniforms;
  material.needsUpdate = true;
}

function abdominalStateFor(mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.map(m => m?.[ABDOMINAL_MATERIAL_STATE]).find(Boolean);
}

function bindAbdominalState(mesh, state) {
  mesh.userData.anatomyAbdominalWindow = state;
  mesh.material = Array.isArray(mesh.material) ? state.surfaceMaterials : state.surfaceMaterials[0];
  mesh.customDepthMaterial = state.depthMaterial;
  mesh.customDistanceMaterial = state.distanceMaterial;
}

function cloneShadowMaterial(source, fallback) {
  if (!source) return fallback();
  const clone = source.clone();
  clone.onBeforeCompile = source.onBeforeCompile;
  const sourceKey = source.customProgramCacheKey();
  clone.customProgramCacheKey = () => sourceKey;
  return clone;
}

/** Optional virtual dissection of the central, anterior aponeurotic surface.
 *  The original GLB groups this sheet with external oblique; it is not a
 *  separately validated anatomical layer. Pale color + the actual rectus
 *  envelope approximate a viewing window, NOT a surgical dissection boundary.
 *  Explicit enabled=true is required. False restores full visibility immediately.
 *  Geometry, muscle shape, lateral red obliques and source vertex colors stay intact.
 *  Apply after enhanceAnatomy and before changing the model's resting pose.
 *  Caller owns/disposes the generated surface/depth/distance materials.
 */
export function configureAbdominalWindow(root, T, enabled) {
  if (typeof enabled !== 'boolean') throw new TypeError('Pass an explicit boolean for virtual dissection.');
  if (!root?.traverse) return;
  const externalMeshes = [], rectusMeshes = [];
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const name = anatomyName(mesh);
    if (/external oblique/.test(name)) externalMeshes.push(mesh);
    if (/rectus abdominis/.test(name)) rectusMeshes.push(mesh);
  });
  if (!enabled) {
    for (const mesh of externalMeshes) {
      const state = abdominalStateFor(mesh);
      if (state) {
        bindAbdominalState(mesh, state);
        state.uniforms.uAbdominalEnabled.value = 0;
      }
    }
    return;
  }
  root.updateMatrixWorld(true);
  for (const mesh of externalMeshes) {
    let state = abdominalStateFor(mesh);
    if (state) {
      bindAbdominalState(mesh, state);
      state.uniforms.uAbdominalEnabled.value = 1;
      continue;
    }
    const right = /right/.test(anatomyName(mesh));
    const rectus = rectusMeshes.find(m => /right/.test(anatomyName(m)) === right);
    if (!rectus || !mesh.geometry?.getAttribute('color') || !rectus.geometry?.getAttribute('position')) continue;
    const section = sheathProfile(rectus, mesh, T);
    if (!section) continue;
    const uniforms = {
      uAbdominalOrigin: { value: section.origin },
      uAbdominalInvHeight: { value: section.inverseHeight },
      uAbdominalProfile: { value: section.profile },
      uAbdominalEnabled: { value: 1 }
    };
    const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    // Enhanced muscles already have independent materials. For a raw GLB,
    // detach the material before adding a per-mesh window to a shared source.
    const surfaces = originals.map(source => {
      if (mesh.userData.anatomyMaterialEnhanced) return source;
      const clone = source.clone();
      clone.onBeforeCompile = source.onBeforeCompile;
      const originalKey = source.customProgramCacheKey();
      clone.customProgramCacheKey = () => originalKey;
      return clone;
    });
    const depth = cloneShadowMaterial(mesh.customDepthMaterial,
      () => new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking }));
    const distance = cloneShadowMaterial(mesh.customDistanceMaterial, () => new T.MeshDistanceMaterial());
    depth.side = distance.side = surfaces[0].side;
    for (const material of [...surfaces, depth, distance]) installSheathShader(material, uniforms);
    state = { uniforms, originalMaterials: originals, surfaceMaterials: surfaces,
      depthMaterial: depth, distanceMaterial: distance,
      originalDepthMaterial: mesh.customDepthMaterial, originalDistanceMaterial: mesh.customDistanceMaterial,
      limits: 'Virtual sheath viewing window derived from color and rectus envelope; not a validated dissection boundary.' };
    for (const material of [...surfaces, depth, distance]) material[ABDOMINAL_MATERIAL_STATE] = state;
    bindAbdominalState(mesh, state);
    // A rig may create the window only after replacing the original Mesh.
    // Keep that original owner ready for disposal/restoration of the rig.
    for (const material of originals) {
      const owner = material[ANATOMY_ORIGINAL_OWNER];
      if (owner && owner !== mesh) bindAbdominalState(owner, state);
    }
  }
}

const EYE_FRAGMENT = /* glsl */`
varying vec3 vEyeRest;
uniform vec3 uEyeIris;
uniform vec3 uEyeLimbus;
uniform vec3 uEyePupil;
float eyeFilteredLine(float phase) {
  return sin(phase) * (1.0 - smoothstep(0.65, 2.8, fwidth(phase)));
}
`;

const EYE_COLOR_FRAGMENT = /* glsl */`
#include <color_fragment>
float eyeRadius = length(vEyeRest.xy);
float eyeAngle = atan(vEyeRest.y, vEyeRest.x + 0.000001);
float eyeAA = max(fwidth(eyeRadius) * 1.1, 0.006);
float eyeDisc = 1.0 - smoothstep(1.0 - eyeAA, 1.0 + eyeAA, eyeRadius);
// Pigment is restricted to the existing anterior corneal cap (+Z).
// Back, rim and sclera are not painted with a second iris.
eyeDisc *= smoothstep(0.08, 0.18, vEyeRest.z);
float eyeGrain = 0.55 * eyeFilteredLine(eyeAngle * 61.0 + eyeRadius * 6.0)
               + 0.45 * eyeFilteredLine(eyeAngle * 97.0 - eyeRadius * 8.0);
vec3 eyePigment = uEyeIris * (0.96 + 0.085 * eyeGrain);
eyePigment = mix(eyePigment, uEyeLimbus, smoothstep(0.90, 1.015, eyeRadius) * 0.82);
float eyePupilMask = 1.0 - smoothstep(0.32 - eyeAA, 0.32 + eyeAA, eyeRadius);
eyePigment = mix(eyePigment, uEyePupil, eyePupilMask);
float eyeOcclusion = clamp(sqrt(max(diffuseColor.r, 0.0) / 0.45), 0.65, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, eyePigment * eyeOcclusion, eyeDisc);
`;

/** Optional cosmetic eye material using only the atlas's real cornea/sclera.
 *  The iris/pupil are a rest-space pigment approximation on the anterior cap,
 *  not added eyeball geometry or a physically reconstructed internal iris.
 *  No claim of ophthalmic/anatomical validation. Call after the basic materials.
 */
export function enhanceEyes(root, T) {
  if (!root?.traverse || !T?.MeshPhysicalMaterial) return;
  const eyes = [];
  root.traverse(mesh => {
    if (mesh.isMesh && /\b(cornea|sclera)\b/.test(anatomyName(mesh))
      && mesh.geometry?.getAttribute('position')) eyes.push(mesh);
  });
  for (const mesh of eyes) {
    if (mesh.userData.anatomyEyesEnhanced) continue;
    const name = anatomyName(mesh), cornea = /\bcornea\b/.test(name);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox, size = box.getSize(new T.Vector3());
    const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const sclera = eyes.find(o => /\bsclera\b/.test(anatomyName(o))
      && /\bright\b/.test(anatomyName(o)) === /\bright\b/.test(name));
    let irisX = size.x * 0.41, irisY = size.y * 0.41;
    // The corneal radius is primary. The corresponding sclera also constrains
    // the disk to under 45% of globe diameter, avoiding oversized pupils/eyes.
    // Écorché's eye meshes share a coordinate frame and object scale.
    if (cornea && sclera) {
      if (!sclera.geometry.boundingBox) sclera.geometry.computeBoundingBox();
      const globeSize = sclera.geometry.boundingBox.getSize(new T.Vector3());
      irisX = Math.min(irisX, globeSize.x * 0.225);
      irisY = Math.min(irisY, globeSize.y * 0.225);
    }
    const replacements = originals.map(source => {
      const material = new T.MeshPhysicalMaterial({
        color: source.color.clone().multiply(new T.Color('#eee9e1')),
        vertexColors: !!mesh.geometry.getAttribute('color'), side: source.side,
        roughness: cornea ? 0.57 : 0.67, metalness: 0,
        ior: 1.38, specularIntensity: 0.20, clearcoat: 0, sheen: 0,
        transmission: 0, transparent: false,
        depthWrite: source.depthWrite, depthTest: source.depthTest
      });
      material.name = cornea ? 'Anatomical cornea — illustrative iris' : 'Anatomical sclera';
      if (cornea && irisX > 0 && irisY > 0 && size.z > 0) {
        const uniforms = {
          uEyeOrigin: { value: new T.Vector3((box.min.x + box.max.x)*0.5, (box.min.y + box.max.y)*0.5, box.min.z) },
          uEyeInvSize: { value: new T.Vector3(1/irisX, 1/irisY, 1/size.z) },
          uEyeIris: { value: new T.Color('#765035') },
          uEyeLimbus: { value: new T.Color('#33291f') },
          uEyePupil: { value: new T.Color('#070808') }
        };
        material.onBeforeCompile = shader => {
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
              varying vec3 vEyeRest;
              uniform vec3 uEyeOrigin;
              uniform vec3 uEyeInvSize;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
              vEyeRest = (position - uEyeOrigin) * uEyeInvSize;`);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\n' + EYE_FRAGMENT)
            .replace('#include <color_fragment>', EYE_COLOR_FRAGMENT);
        };
        material.customProgramCacheKey = () => 'anatomical-eye-pigment-1';
        material.userData.anatomyEye = { uniforms, irisRadiiLocal: [irisX, irisY], pupilRadiusRatio: 0.32,
          limits: 'Anterior corneal pigment illustration, not an internal iris reconstruction.' };
      }
      return material;
    });
    mesh.userData.anatomyEyeOriginalMaterials = originals;
    mesh.material = Array.isArray(mesh.material) ? replacements : replacements[0];
    mesh.userData.anatomyEyesEnhanced = true;
  }
}
