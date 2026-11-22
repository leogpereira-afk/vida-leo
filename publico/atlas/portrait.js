import * as T from './vendor/three.module.min.js';

const neckBase = new T.Vector3(0, 1.4615, 0);
const portraitFocusHeight = 0.105;

// The study rig is in metres. Mount in its rest pose before playback.
export function addPortrait(body, portrait) {
  const facialParts = [];
  const box = new T.Box3();
  const toBody = body.matrixWorld.clone().invert();
  body.traverse(part => {
    if (!part.isMesh) return;
    part.geometry.computeBoundingBox();
    box.copy(part.geometry.boundingBox)
      .applyMatrix4(toBody.clone().multiply(part.matrixWorld));
    if (box.min.y >= 1.495) facialParts.push([part, part.visible]);
  });

  portrait.position.copy(neckBase);
  portrait.scale.setScalar(0.995);
  portrait.traverse(part => {
    if (!part.isMesh) return;
    part.castShadow = true;
    part.receiveShadow = true;
    part.userData.portrait = true;
    part.material.metalness = 0;
    part.material.roughness = 0.84;
    part.material.normalScale.set(0.55, 0.55);
    part.material.side = T.DoubleSide;
    part.material.map.generateMipmaps = false;
    part.material.map.minFilter = T.LinearFilter;
    part.material.map.needsUpdate = true;
    // Blender exported the remeshed cervical surface with a per-vertex skin edge.
    part.material.vertexColors = true;
    part.material.transparent = true;
    part.material.alphaTest = 0.015;
    part.material.forceSinglePass = true;
    // Fade the thin skin edge per pixel. The portrait's original cervical
    // triangles are much larger than a pixel in a close-up.
    part.material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 portraitPosition;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nportraitPosition = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 portraitPosition;')
        .replace('#include <alphatest_fragment>', `
          vec2 radial = normalize(vec2(portraitPosition.x, portraitPosition.z + 0.012) + vec2(0.000001,0.0));
          float front = radial.y;
          float border = 1.427 + 0.009*(1.0-front) + 0.011*radial.x*radial.x - 0.027*pow(max(0.0,front),1.4);
          float heightAboveEdge = 1.4615 + portraitPosition.y*0.995 - border;
          diffuseColor.a *= smoothstep(0.008, 0.068, heightAboveEdge);
          #include <alphatest_fragment>
        `);
    };
    part.material.customProgramCacheKey = () => 'portrait-neck-blend-1';
    part.material.needsUpdate = true;
  });

  body.add(portrait);
  const headBone = body.getObjectByName('FullRig_head');
  if (headBone) headBone.attach(portrait);
  return {
    show(natural) {
      portrait.visible = natural;
      for (const [part, visible] of facialParts) part.visible = visible && !natural;
    },
    center(target) {
      return portrait.localToWorld(target.set(0, portraitFocusHeight, 0.017));
    }
  };
}
