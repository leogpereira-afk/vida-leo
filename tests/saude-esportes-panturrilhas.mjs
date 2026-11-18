import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const folder = new URL('../publico/assets/esportes/modelos/', import.meta.url);
const source = readFileSync(new URL('humano-atletico.json', folder));
const model = JSON.parse(source);
const patch = JSON.parse(readFileSync(new URL('panturrilhas-posteriores.json', folder), 'utf8'));
const positions = Buffer.from(model.arrays.positionF32, 'base64');
const normals = Buffer.from(model.arrays.normalI8, 'base64');
const indices = Buffer.from(patch.indicesU16, 'base64');

test('correção de panturrilhas tem procedência explícita e mantém o asset original separado', () => {
  assert.equal(patch.sourceFile, 'humano-atletico.json');
  assert.equal(patch.sourceSha256, createHash('sha256').update(source).digest('hex'));
  assert.equal(patch.license, 'CC0-1.0');
  assert.equal(patch.group, 'calves');
  assert.equal(indices.length / 2, patch.indexCount);
  assert.equal(patch.indexCount % 3, 0);
  assert.notEqual(patch.indicesU16, model.arrays.indicesU16.calves);
});

test('panturrilhas destacam os compartimentos posteriores de ambas as pernas', () => {
  const body = Buffer.from(model.arrays.indicesU16.body, 'base64');
  const bodyTriangles = new Set();
  for (let offset = 0; offset < body.length; offset += 6) bodyTriangles.add(body.subarray(offset, offset + 6).toString('hex'));
  const counts = {left: 0, right: 0, upper: 0, lower: 0};
  for (let offset = 0; offset < indices.length; offset += 6) {
    assert.ok(bodyTriangles.has(indices.subarray(offset, offset + 6).toString('hex')), 'a superfície deve pertencer ao corpo');
    const triangle = [0, 1, 2].map(corner => indices.readUInt16LE(offset + corner * 2));
    const center = [0, 1, 2].map(axis => triangle.reduce((sum, vertex) => sum + positions.readFloatLE((vertex * 3 + axis) * 4), 0) / 3);
    const normalZ = triangle.reduce((sum, vertex) => sum + normals.readInt8(vertex * 3 + 2) / 127, 0) / 3;
    const side = center[0] > 0 ? 'Left' : 'Right';
    const bone = model.bones.find(item => item.name === `lowerLeg${side}`);
    const height = (center[1] - bone.end[1]) / (bone.start[1] - bone.end[1]);
    const shaftZ = bone.end[2] + height * (bone.start[2] - bone.end[2]);
    assert.ok(center[2] < shaftZ - .008, 'nenhuma face pode cobrir a tíbia anterior');
    assert.ok(normalZ < .20, 'a seleção deve envolver somente faces posteriores e posterolaterais');
    counts[side.toLowerCase()]++;
    counts[center[1] > .3 ? 'upper' : 'lower']++;
  }
  assert.equal(counts.left, counts.right);
  assert.ok(counts.left > 100 && counts.right > 100);
  assert.ok(counts.upper > 100 && counts.lower > 50, 'cobertura da barriga da panturrilha e região inferior');
});
