import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const moduleSource = readFileSync(new URL('../publico/saude-esportes-maos.js', import.meta.url), 'utf8');
const {applyGrip} = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);

const data = JSON.parse(readFileSync(new URL('../publico/assets/esportes/modelos/humano-atletico.json', import.meta.url), 'utf8'));
const source = Buffer.from(data.arrays.positionF32, 'base64');
const positions = Float32Array.from({length: data.vertexCount * 3}, (_, i) => source.readFloatLE(i * 4));
const digitData = Buffer.from(data.arrays.digitsU8, 'base64');
const digitVertices = new Set(Array.from({length: digitData.length / 7}, (_, i) => digitData.readUInt16LE(i * 7)));

test('pegada preserva dados originais e zero mantém a mão aberta', () => {
  const original = positions.slice(), originalData = JSON.stringify(data);
  const open = applyGrip(positions, data, 0);
  assert.notEqual(open, positions);
  assert.deepEqual(open, original);
  applyGrip(positions, data);
  assert.deepEqual(positions, original);
  assert.equal(JSON.stringify(data), originalData);
});

test('flexão altera somente vértices dos dedos com deslocamentos finitos', () => {
  const closed = applyGrip(positions, data);
  let moved = 0, maximum = 0;
  for (let vertex = 0; vertex < data.vertexCount; vertex++) {
    const offset = vertex * 3;
    const distance = Math.hypot(...[0, 1, 2].map(axis => closed[offset + axis] - positions[offset + axis]));
    assert.ok(Number.isFinite(distance));
    if (!digitVertices.has(vertex)) assert.equal(distance, 0, `vértice ${vertex}`);
    if (distance > .001) moved++;
    maximum = Math.max(maximum, distance);
  }
  assert.ok(moved > 1000, 'ambas as mãos devem articular');
  assert.ok(maximum > .05 && maximum < .2, `deslocamento ${maximum}`);
});

test('pontas dos quatro dedos aproximam-se do punho na pegada fechada', () => {
  const closed = applyGrip(positions, data);
  for (const side of ['l', 'r']) for (const digit of [2, 3, 4, 5]) {
    const tip = data.landmarks[`joint-${side}-finger-${digit}-4`];
    const wrist = data.landmarks[`joint-${side}-hand`];
    let vertex = -1, closest = Infinity;
    for (const candidate of digitVertices) {
      const distance = Math.hypot(...tip.map((value, axis) => value - positions[candidate * 3 + axis]));
      if (distance < closest) { closest = distance; vertex = candidate; }
    }
    const openDistance = Math.hypot(...wrist.map((value, axis) => value - positions[vertex * 3 + axis]));
    const closedDistance = Math.hypot(...wrist.map((value, axis) => value - closed[vertex * 3 + axis]));
    assert.ok(closedDistance < openDistance * .8, `${side}, dedo ${digit}: ${openDistance} → ${closedDistance}`);
  }
});

test('intensidade é limitada e transições de pegada são contínuas', () => {
  assert.deepEqual(applyGrip(positions, data, -2), positions);
  assert.deepEqual(applyGrip(positions, data, NaN), positions);
  assert.deepEqual(applyGrip(positions, data, 2), applyGrip(positions, data, 1));
  const before = applyGrip(positions, data, .499), after = applyGrip(positions, data, .501);
  let maximum = 0;
  for (let i = 0; i < before.length; i++) maximum = Math.max(maximum, Math.abs(before[i] - after[i]));
  assert.ok(maximum > 0 && maximum < .001);
});

test('membranas e articulações não criam triângulos excessivamente esticados', () => {
  const closed = applyGrip(positions, data);
  const body = Buffer.from(data.arrays.indicesU16.body, 'base64');
  let maximum = 0;
  for (let offset = 0; offset < body.length; offset += 6) {
    const triangle = [0, 1, 2].map(corner => body.readUInt16LE(offset + corner * 2));
    for (let corner = 0; corner < 3; corner++) {
      const first = triangle[corner], second = triangle[(corner + 1) % 3];
      if (!digitVertices.has(first) && !digitVertices.has(second)) continue;
      const length = array => Math.hypot(...[0, 1, 2].map(axis => array[first * 3 + axis] - array[second * 3 + axis]));
      const rest = length(positions);
      if (rest > 1e-5) maximum = Math.max(maximum, length(closed) / rest);
    }
  }
  assert.ok(maximum < 1.85, `alongamento máximo ${maximum}`);
});
