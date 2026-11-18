// Rest-space finger articulation for the CC0 human mesh. Call before body skinning
// and recompute normals afterwards. Input geometry and asset data remain unchanged.
const EPSILON = 1e-8;
const sub = (a, b) => a.map((value, index) => value - b[index]);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = vector => {
  const length = Math.hypot(...vector);
  return length > EPSILON ? vector.map(value => value / length) : [0, 0, 0];
};
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (start, end, value) => {
  const t = clamp((value - start) / Math.max(EPSILON, end - start));
  return t * t * (3 - 2 * t);
};

function rotateAt(point, pivot, axis, angle) {
  const relative = sub(point, pivot), c = Math.cos(angle), s = Math.sin(angle);
  const perpendicular = cross(axis, relative), axial = dot(axis, relative);
  return relative.map((value, i) => pivot[i] + value * c + perpendicular[i] * s + axis[i] * axial * (1 - c));
}

function makeHand(landmarks, side) {
  const wrist = landmarks[`joint-${side}-hand`];
  const fingers = Array.from({length: 5}, (_, finger) => Array.from({length: 4}, (_, joint) => landmarks[`joint-${side}-finger-${finger + 1}-${joint + 1}`]));
  if (!wrist || fingers.flat().some(point => !Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite))) return null;
  const forward = unit(sub(fingers[2][0], wrist));
  const across = unit(sub(fingers[1][0], fingers[4][0]));
  let palm = unit(cross(across, forward));
  // The relaxed source fingers already curve slightly toward the palm. That
  // curvature determines the flexion side independently of left/right naming.
  const curvature = fingers.slice(1).reduce((result, chain) => {
    const bend = sub(unit(sub(chain[3], chain[2])), unit(sub(chain[1], chain[0])));
    return result.map((value, axis) => value + bend[axis]);
  }, [0, 0, 0]);
  if (dot(palm, curvature) < 0) palm = palm.map(value => -value);
  return fingers.map((chain, finger) => {
    const lengths = chain.slice(0, 3).map((point, joint) => Math.hypot(...sub(chain[joint + 1], point)));
    const axes = chain.slice(0, 3).map((point, joint) => unit(cross(sub(chain[joint + 1], point), palm)));
    const degrees = finger === 0 ? [48, 24, 34] : [52, 72, 40];
    if (finger === 0) {
      // Thumb opposition closes across the palm, while the other digits flex
      // toward it. Its root axis therefore differs from the finger hinges.
      axes[0] = unit(cross(sub(chain[1], chain[0]), sub(fingers[2][0], chain[0])));
    }
    return {chain, lengths, axes, angles: degrees.map(value => value * Math.PI / 180)};
  });
}

function fingerArc(point, finger) {
  let bestDistance = Infinity, arc = 0, accumulated = 0;
  for (let segment = 0; segment < 3; segment++) {
    const offset = sub(point, finger.chain[segment]);
    const vector = sub(finger.chain[segment + 1], finger.chain[segment]);
    const t = clamp(dot(offset, vector) / Math.max(EPSILON, dot(vector, vector)));
    const distance = offset.reduce((sum, value, axis) => sum + (value - t * vector[axis]) ** 2, 0);
    if (distance < bestDistance) { bestDistance = distance; arc = accumulated + finger.lengths[segment] * t; }
    accumulated += finger.lengths[segment];
  }
  return arc;
}

function flexVertex(point, finger, amount) {
  const arc = fingerArc(point, finger);
  const first = finger.lengths[0], second = first + finger.lengths[1];
  const blend1 = smooth(first - finger.lengths[0] * .2, first + finger.lengths[1] * .2, arc);
  const blend2 = smooth(second - finger.lengths[1] * .2, second + finger.lengths[2] * .2, arc);
  const influence = [1 - blend1, blend1 * (1 - blend2), blend1 * blend2];
  const result = [0, 0, 0];
  for (let segment = 0; segment < 3; segment++) {
    if (!influence[segment]) continue;
    let moved = point;
    // A distal phalanx inherits all proximal rotations. Evaluating the rest
    // transforms from distal to proximal is ordinary forward kinematics.
    for (let joint = segment; joint >= 0; joint--) moved = rotateAt(moved, finger.chain[joint], finger.axes[joint], finger.angles[joint] * amount);
    for (let axis = 0; axis < 3; axis++) result[axis] += moved[axis] * influence[segment];
  }
  return result;
}

function softenKnuckles(original, posed, data, movable) {
  if (!data.arrays.indicesU16?.body) return;
  const raw = atob(data.arrays.indicesU16.body), neighbors = new Map();
  const indexAt = offset => raw.charCodeAt(offset) + 256 * raw.charCodeAt(offset + 1);
  for (let offset = 0; offset < raw.length; offset += 6) {
    const triangle = [indexAt(offset), indexAt(offset + 2), indexAt(offset + 4)];
    for (let corner = 0; corner < 3; corner++) {
      const a = triangle[corner], b = triangle[(corner + 1) % 3];
      for (const [vertex, neighbor] of [[a, b], [b, a]]) {
        if (!movable.has(vertex)) continue;
        if (!neighbors.has(vertex)) neighbors.set(vertex, new Set());
        neighbors.get(vertex).add(neighbor);
      }
    }
  }
  // Smooth the displacement field only where small triangles become strained.
  // Keeping the original surface as the reference retains knuckle/skin relief;
  // stationary palm neighbors anchor the transition at the finger roots.
  for (let pass = 0; pass < 10; pass++) {
    const pending = [];
    for (const [vertex, connected] of neighbors) {
      const offset = vertex * 3, average = [0, 0, 0];
      let total = 0, strained = false;
      for (const neighbor of connected) {
        const at = neighbor * 3;
        const rest = Math.hypot(...[0, 1, 2].map(axis => original[offset + axis] - original[at + axis]));
        const length = Math.hypot(...[0, 1, 2].map(axis => posed[offset + axis] - posed[at + axis]));
        if (rest < EPSILON) continue;
        if (length > rest * 1.75) strained = true;
        const weight = 1 / rest;
        total += weight;
        for (let axis = 0; axis < 3; axis++) average[axis] += (posed[at + axis] - original[at + axis]) * weight;
      }
      if (!strained || !total) continue;
      pending.push([offset, average.map((value, axis) => posed[offset + axis] * .55 + (original[offset + axis] + value / total) * .45)]);
    }
    for (const [offset, point] of pending) posed.set(point, offset);
    if (!pending.length) break;
  }
}

export function applyGrip(positions, data, grip = 1) {
  if (!(positions instanceof Float32Array) || positions.length % 3) throw new TypeError('A malha precisa de posições Float32Array xyz.');
  const result = new Float32Array(positions);
  const amount = Number.isFinite(grip) ? clamp(grip) : 0;
  if (!amount || !data?.arrays?.digitsU8 || !data?.landmarks) return result;
  const hands = {l: makeHand(data.landmarks, 'l'), r: makeHand(data.landmarks, 'r')};
  const encoded = atob(data.arrays.digitsU8);
  const movable = new Set();
  // Sparse asset records: uint16 little-endian vertex + five uint8 digit
  // weights, ordered thumb to little finger. The unused weight preserves palm.
  if (encoded.length % 7) throw new RangeError('Pesos dos dedos incompletos.');
  for (let record = 0; record < encoded.length; record += 7) {
    const vertex = encoded.charCodeAt(record) + encoded.charCodeAt(record + 1) * 256;
    if (vertex * 3 + 2 >= positions.length) throw new RangeError('Vértice dos dedos fora da malha.');
    const point = Array.from(positions.subarray(vertex * 3, vertex * 3 + 3));
    const hand = hands[point[0] >= 0 ? 'l' : 'r'];
    if (!hand) continue;
    movable.add(vertex);
    const moved = [...point];
    for (let digit = 0; digit < 5; digit++) {
      const weight = encoded.charCodeAt(record + 2 + digit) / 255;
      if (!weight) continue;
      const bent = flexVertex(point, hand[digit], amount);
      for (let axis = 0; axis < 3; axis++) moved[axis] += (bent[axis] - point[axis]) * weight;
    }
    result.set(moved, vertex * 3);
  }
  softenKnuckles(positions, result, data, movable);
  return result;
}
