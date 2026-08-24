import test from 'node:test'
import assert from 'node:assert/strict'
import { getDayCellState } from './dayCellState.ts'

test('选中状态优先于今天和本月', () => {
  assert.equal(getDayCellState({ isSelected: true, isToday: true, isCurrentMonth: false }), 'selected')
})

test('今天状态优先于非本月', () => {
  assert.equal(getDayCellState({ isSelected: false, isToday: true, isCurrentMonth: false }), 'today')
})

test('非本月状态优先于普通当月', () => {
  assert.equal(getDayCellState({ isSelected: false, isToday: false, isCurrentMonth: false }), 'outside')
})

test('普通状态返回 normal', () => {
  assert.equal(getDayCellState({ isSelected: false, isToday: false, isCurrentMonth: true }), 'normal')
})
