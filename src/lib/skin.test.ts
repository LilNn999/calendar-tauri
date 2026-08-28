import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSkin, SKIN_OPTIONS } from './skin.ts'

test('normalizeSkin 将未知值回退到 minimal', () => {
  assert.equal(normalizeSkin('unknown'), 'minimal')
})

test('normalizeSkin 保留合法皮肤', () => {
  assert.equal(normalizeSkin('neu'), 'neu')
})

test('SKIN_OPTIONS 包含全部目标皮肤', () => {
  assert.equal(SKIN_OPTIONS.length, 6)
  assert.deepEqual(SKIN_OPTIONS.map((item) => item.value), [
    'minimal', 'neu', 'warm-wood', 'cny', 'press', 'vapor',
  ])
})

test('normalizeSkin 保留新增的 cny、press 与 vapor', () => {
  assert.equal(normalizeSkin('cny'), 'cny')
  assert.equal(normalizeSkin('press'), 'press')
  assert.equal(normalizeSkin('vapor'), 'vapor')
})
