import test from 'node:test'
import assert from 'node:assert/strict'
import { lookScore, rewardCompleted, upgradeCost } from './logic.js'

test('closet upgrade costs rise', () => assert.ok(upgradeCost(5) > upgradeCost(4)))
test('fast choices, streaks, and wardrobe levels raise score', () => {
  assert.ok(lookScore(2, 4, 1) > lookScore(0, 1, .2))
  assert.equal(lookScore(0, 9, 1), lookScore(0, 7, 1))
})
test('reward validation is strict', () => {
  assert.equal(rewardCompleted({ kind: 'rewarded', status: 'completed', completed: true }), true)
  assert.equal(rewardCompleted({ kind: 'rewarded', status: 'completed', completed: false }), false)
  assert.equal(rewardCompleted({ kind: 'interstitial', status: 'completed', completed: true }), false)
})
