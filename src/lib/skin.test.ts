import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSkin, SKIN_OPTIONS } from './skin.ts'

test('normalizeSkin 将未知值回退到 default', () => {
  assert.equal(normalizeSkin('unknown'), 'default')
})

test('normalizeSkin 保留合法皮肤', () => {
  assert.equal(normalizeSkin('aurora'), 'aurora')
})

test('SKIN_OPTIONS 包含默认与五款新皮肤', () => {
  assert.equal(SKIN_OPTIONS.length, 6)
  assert.deepEqual(SKIN_OPTIONS.map((item) => item.value), [
    'default', 'aurora', 'warm-wood', 'macos', 'win11', 'minimal',
  ])
})
