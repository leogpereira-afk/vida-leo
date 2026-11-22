import * as T from './vendor/three.module.min.js';

// Metres in the atlas bind pose. The bar and both palms share this cylindrical grip.
export const gripRadius = .014;
export const palmCenter = [.264, .821, .083];
export const palmAxis = [1, -.28287, -.01];
const support = new T.Vector3(0, 1.433, -.0933);
const gripSpacing = .327;
const mirrored = (v, sign) => new T.Vector3(sign*v[0], v[1], v[2]);

function frame(axis, reference) {
  const x = axis.clone().normalize();
  const y = reference.clone().addScaledVector(x, -reference.dot(x)).normalize();
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, x.clone().cross(y)));
}

function align(restAxis, restReference, axis, reference) {
  return frame(axis, reference).multiply(frame(restAxis, restReference).invert());
}

// Solve once in torso space. Fixed segment lengths and a shared torso transform
// keep both hands at their purchase points even when the trunk inclines.
export function squatArm(sign, shoulder, elbowRest, wristRest, handRest) {
  const purchase = support.clone();
  purchase.x = sign*gripSpacing;
  return armForGrip(sign, shoulder, elbowRest, wristRest, handRest, purchase,
    new T.Vector3(0,-.92,-.39),new T.Vector3(sign*.19,-1,-.54));
}

export function armForGrip(sign, shoulder, elbowRest, wristRest, handRest, purchase, wristDirection, pole) {
  const center = mirrored(palmCenter, sign);
  const across = mirrored(palmAxis, sign).normalize();
  const wristToGrip = wristRest.clone().sub(center);
  const handQ = align(across, wristToGrip, new T.Vector3(-sign,0,0), wristDirection);
  const wrist = purchase.clone().add(wristToGrip.applyQuaternion(handQ));
  const line = wrist.clone().sub(shoulder);
  const d = line.length();
  line.divideScalar(d);
  const upper = shoulder.distanceTo(elbowRest), fore = elbowRest.distanceTo(wristRest);
  if (d >= upper+fore || d <= Math.abs(upper-fore)) throw Error('Barra fora do alcance do braço');
  const along = (upper*upper-fore*fore+d*d)/(2*d);
  pole.addScaledVector(line,-pole.dot(line)).normalize();
  const elbow = shoulder.clone().addScaledVector(line,along).addScaledVector(pole,Math.sqrt(upper*upper-along*along));
  const upperDir = elbow.clone().sub(shoulder);
  const foreDir = wrist.clone().sub(elbow);
  const hinge = upperDir.clone().cross(foreDir).normalize();
  const upperQ = align(elbowRest.clone().sub(shoulder), new T.Vector3(-1,0,0), upperDir, hinge);
  const foreQ = align(wristRest.clone().sub(elbowRest), across, foreDir, across.clone().applyQuaternion(handQ));
  const hand = handRest.clone().sub(wristRest).applyQuaternion(handQ).add(wrist);
  return [[shoulder,elbow,upperQ],[elbow,wrist,foreQ],[wrist,hand,handQ]];
}

export function mountBackBar(chest) {
  const bar=createBar('Barra_nas_costas');
  bar.position.copy(support).sub(chest.position);
  chest.add(bar);
  return bar;
}

export function createBar(name) {
  const bar=new T.Group();
  bar.name=name;
  const steel = new T.MeshStandardMaterial({color:0x939da5,roughness:.34,metalness:.58});
  const sleeve = new T.MeshStandardMaterial({color:0x596670,roughness:.36,metalness:.54});
  const ring = new T.MeshStandardMaterial({color:0x354049,roughness:.49,metalness:.30});
  function cylinder(name,radius,length,x,material) {
    const mesh = new T.Mesh(new T.CylinderGeometry(radius,radius,length,48),material);
    mesh.name=name; mesh.userData.equipment='barra';
    mesh.rotation.z=-Math.PI/2; mesh.position.x=x;
    mesh.castShadow=mesh.receiveShadow=true; bar.add(mesh);
    return mesh;
  }
  const shaft = cylinder('Haste',gripRadius,1.12,0,steel);
  Object.assign(shaft.userData,{radius:gripRadius,halfLength:.56});
  for(const sign of [-1,1]){
    cylinder('Manga',.023,.243,sign*.6815,sleeve);
    cylinder('Colar',.03,.014,sign*.563,ring);
    cylinder('Ponteira',.021,.004,sign*.803,ring);
    for(const x of [.27,.384]) cylinder('Marca da pegada',gripRadius+.00012,.002,sign*x,ring);
  }
  return bar;
}
