import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const folder = new URL('../publico/assets/esportes/modelos/', import.meta.url);
const model = JSON.parse(readFileSync(new URL('humano-atletico.json', folder), 'utf8'));
const muscles = ['chest', 'core', 'back', 'traps', 'lowerBack', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves'];
const surfaces = ['body', 'eyes', 'shorts', 'shortsTrim', 'trainerUpper', 'trainerSole', 'trainerTrim'];

function bytes(base64) {
  assert.equal(typeof base64, 'string');
  const result = Buffer.from(base64, 'base64');
  assert.equal(result.toString('base64'), base64, 'base64 deve estar íntegro');
  return result;
}

test('malha humana possui anatomia detalhada e escala em metros', () => {
  assert.ok(Number.isInteger(model.vertexCount) && model.vertexCount > 10000);
  const positions = bytes(model.arrays.positionF32);
  const normals = bytes(model.arrays.normalI8);
  assert.equal(positions.byteLength, model.vertexCount * 3 * 4);
  assert.equal(normals.byteLength, model.vertexCount * 3);
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < positions.byteLength; i += 4) {
    const value = positions.readFloatLE(i);
    assert.ok(Number.isFinite(value), `posição inválida em ${i / 4}`);
    if ((i / 4) % 3 === 1) { low = Math.min(low, value); high = Math.max(high, value); }
  }
  assert.ok(high - low > 1.7 && high - low < 2.1, 'altura humana em metros');
  assert.ok(model.indexCounts.body / 3 > 20000, 'corpo usa malha contínua detalhada');
});

test('rig e pesos preservam todas as influências de deformação', () => {
  assert.equal(model.bones.length, model.boneCount);
  assert.equal(model.boneCount, 22);
  assert.equal(new Set(model.bones.map(bone => bone.name)).size, model.boneCount);
  for (const bone of model.bones) {
    for (const point of [bone.start, bone.end]) {
      assert.equal(point.length, 3);
      assert.ok(point.every(Number.isFinite), bone.name);
    }
    assert.ok(Math.hypot(...bone.end.map((value, axis) => value - bone.start[axis])) > .001, bone.name);
  }
  const joints = bytes(model.arrays.jointsU8), weights = bytes(model.arrays.weightsU8);
  assert.equal(joints.length, model.vertexCount * 4);
  assert.equal(weights.length, model.vertexCount * 4);
  let blended = 0;
  for (let vertex = 0; vertex < model.vertexCount; vertex++) {
    let total = 0, influences = 0;
    for (let k = 0; k < 4; k++) {
      const at = vertex * 4 + k;
      assert.ok(joints[at] < model.boneCount, `osso inválido no vértice ${vertex}`);
      total += weights[at];
      if (weights[at] > 0) influences++;
    }
    assert.equal(total, 255, `peso não normalizado no vértice ${vertex}`);
    if (influences > 1) blended++;
  }
  assert.ok(blended > model.vertexCount / 3, 'articulações devem mesclar influências');
});

test('superfícies e grupos musculares possuem triângulos válidos e distintos', () => {
  assert.deepEqual(model.groupOrder, muscles);
  const expected = [...surfaces, ...muscles].sort();
  assert.deepEqual(Object.keys(model.arrays.indicesU16).sort(), expected);
  assert.deepEqual(Object.keys(model.indexCounts).sort(), expected);
  const muscleData = new Set();
  for (const group of expected) {
    const encoded = model.arrays.indicesU16[group], indices = bytes(encoded);
    assert.ok(indices.byteLength > 0, group);
    assert.equal(indices.byteLength / 2, model.indexCounts[group], group);
    assert.equal(model.indexCounts[group] % 3, 0, group);
    for (let i = 0; i < indices.byteLength; i += 2) {
      assert.ok(indices.readUInt16LE(i) < model.vertexCount, `${group}: índice fora da malha`);
    }
    if (muscles.includes(group)) muscleData.add(encoded);
  }
  assert.equal(muscleData.size, muscles.length, 'cada região muscular precisa de sua própria superfície');
});

test('asset conserva procedência CC0 e não inclui texturas ou código de terceiros', () => {
  const license = readFileSync(new URL('LICENCA.md', folder), 'utf8');
  assert.match(license, /CC0 1\.0 Universal/);
  assert.match(license, /makehumancommunity\/makehuman/);
  assert.match(license, /dcdyouget\/formlab-motion-atlas/);
  assert.match(license, /Nenhuma textura, animação, shader ou implementação de renderização externa foi copiada/);
  assert.match(model.source, /MakeHuman CC0/);
  assert.match(model.sourceSha256, /^[a-f0-9]{64}$/);
  assert.ok(Object.values(model.targetSha256).every(hash => /^[a-f0-9]{64}$/.test(hash)));
  assert.deepEqual(Object.keys(model.arrays).sort(), ['digitsU8', 'indicesU16', 'jointsU8', 'normalI8', 'positionF32', 'weightsU8']);
});
