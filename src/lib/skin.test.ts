import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSkin, SKIN_OPTIONS } from './skin.ts'

test('normalizeSkin 将未知值回退到 minimal', () => {
  assert.equal(normalizeSkin('unknown'), 'minimal')
})

test('normalizeSkin 保留合法皮肤', () => {
  assert.equal(normalizeSkin('neu'), 'neu')
})

test('SKIN_OPTIONS 包含三款目标皮肤', () => {
  assert.equal(SKIN_OPTIONS.length, 3)
  assert.deepEqual(SKIN_OPTIONS.map((item) => item.value), [
    'minimal', 'neu', 'warm-wood',
  ])
})
