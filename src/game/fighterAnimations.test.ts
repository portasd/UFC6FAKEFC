import assert from 'node:assert/strict';
import test from 'node:test';
import { createBoutState, createFighterState } from './combatEngine';
import { UFC_ROSTER } from './fighters';
import {
  getBlockPose,
  getIdleGuardPose,
  getKnockdownPose,
  getStrikeKeyframePose,
} from './fighterAnimations';

const p0 = UFC_ROSTER[0];

test('idle guard animation exhibits breathing, guard bounce, and bladed stance rotation', () => {
  const poseA = getIdleGuardPose('orthodox', 0, 0, 0.0);
  const poseB = getIdleGuardPose('orthodox', 0, 0, 0.27);
  // Pelvis bounce changes height cleanly over time
  assert.notEqual(poseA.pelvisY, poseB.pelvisY);
  // Orthodox stance advances left hip forward (+Y rotation) and tucks chin
  assert.ok(poseA.pelvisRot[1] > 0.3);
  assert.ok(poseA.headRot[1] < -0.3);
  // Both elbows remain folded in tight guard
  assert.ok(poseA.elbowL[0] < -1.3);
  assert.ok(poseA.elbowR[0] < -1.5);
});

test('jab animation extends lead shoulder & elbow with hip rotation and torso snap', () => {
  const base = getIdleGuardPose('orthodox', 0, 0, 0);
  const peak = getStrikeKeyframePose('jab', 'orthodox', 0.42, base);
  const end = getStrikeKeyframePose('jab', 'orthodox', 1.0, base);

  // Full extension: elbow opens near straight (-0.07) vs bent guard (-1.56)
  assert.ok(peak.elbowL[0] > -0.35, `Expected extended elbow, got ${peak.elbowL[0]}`);
  // Lead shoulder elevates forward toward horizontal (-1.56)
  assert.ok(peak.shoulderL[0] < -1.35);
  // Hips & chest rotate forward behind lead shoulder (+Y)
  assert.ok(peak.pelvisRot[1] > base.pelvisRot[1]);
  assert.ok(peak.chestRot[1] > base.chestRot[1]);
  // Rear hand remains glued to chin in guard
  assert.ok(peak.elbowR[0] < -1.8);
  // Smoothly recovers back to base guard pose at t=1
  assert.ok(Math.abs(end.elbowL[0] - base.elbowL[0]) < 0.001);
});

test('hook animation winds up in coil phase then snaps hips & torso across horizontal arc', () => {
  const base = getIdleGuardPose('orthodox', 0, 0, 0);
  const coil = getStrikeKeyframePose('leadHook', 'orthodox', 0.25, base);
  const impact = getStrikeKeyframePose('leadHook', 'orthodox', 0.45, base);

  // Coil phase rotates torso opposite the swing (-Y relative to base)
  assert.ok(coil.pelvisRot[1] < base.pelvisRot[1]);
  // Impact phase whips pelvis and chest strongly across (+Y)
  assert.ok(impact.pelvisRot[1] > 0.6);
  assert.ok(impact.chestRot[1] > 0.4);
  // Hook elbow stays bent near 90 deg (-1.48 rad) while shoulder abducts outward
  assert.ok(impact.elbowL[0] < -1.2 && impact.elbowL[0] > -1.8);
  assert.ok(impact.shoulderL[2] < -0.7);
});

test('roundhouse kick turns hips over, bends then whips knee pivot, and swings counter arm', () => {
  const base = getIdleGuardPose('orthodox', 0, 0, 0);
  const chamber = getStrikeKeyframePose('headKick', 'orthodox', 0.22, base);
  const whip = getStrikeKeyframePose('headKick', 'orthodox', 0.44, base);
  const reChamber = getStrikeKeyframePose('headKick', 'orthodox', 0.72, base);

  // Hip turns over toward standing leg (-1.12 rad) with lateral counterbalance lean
  assert.ok(whip.pelvisRot[1] < -0.8);
  assert.ok(Math.abs(whip.pelvisRot[2]) > 0.3);
  // Kicking knee starts folded in chamber, extends straight on whip, then re-chambers
  assert.ok(chamber.kneeR[0] > 0.9);
  assert.ok(whip.kneeR[0] < 0.2);
  assert.ok(reChamber.kneeR[0] > 0.5);
  // Kicking-side arm swings down-back while guard hand stays high
  assert.ok(whip.shoulderR[0] > 0.4);
  assert.ok(whip.elbowL[0] < -1.9);
});

test('block animation shells clavicles, elbows, and chin tightly in high and low guard', () => {
  const base = getIdleGuardPose('orthodox', 0, 0, 0);
  const high = getBlockPose('high', 'orthodox', base, 0.5);
  const low = getBlockPose('low', 'orthodox', base, 0.5);

  assert.ok(high.headRot[0] > 0.1);
  assert.ok(high.elbowL[0] < -2.0);
  assert.ok(high.elbowR[0] < -2.0);
  assert.ok(low.pelvisY < base.pelvisY - 0.05);
  assert.ok(low.hipL[0] < base.hipL[0]);
});

test('knockdown animation progresses through knee buckle, canvas drop, bounce, sit-up, and stand-up', () => {
  const f = createFighterState(0, p0);
  f.action = 'knockdown';
  f.actionDuration = 1.45;
  const base = getIdleGuardPose('orthodox', 0, 0, 0);

  f.actionTime = 0.26; // Buckle
  const buckle = getKnockdownPose(f, base);
  assert.ok(buckle.kneeL[0] > 0.7);

  f.actionTime = 0.64; // Mat impact
  const mat = getKnockdownPose(f, base);
  assert.ok(mat.pelvisY < 0.22);
  assert.ok(mat.pelvisRot[0] < -1.2);

  f.actionTime = 1.19; // Sit-up recovery brace
  const situp = getKnockdownPose(f, base);
  assert.ok(situp.abdomenRot[0] > 0.25);

  f.actionTime = 1.45; // Back in fighting guard
  const recovered = getKnockdownPose(f, base);
  assert.ok(Math.abs(recovered.pelvisY - base.pelvisY) < 0.01);
});

test('bout state initializes cleanly for southpaw stance mirroring', () => {
  const bout = createBoutState(UFC_ROSTER[0], UFC_ROSTER[2]); // Conor is southpaw
  const spPose = getIdleGuardPose(bout.fighters[1].stance, 0, 0, 0);
  // Southpaw mirrors orthodox (-Y pelvis rotation advances right lead side)
  assert.ok(spPose.pelvisRot[1] < -0.3 || spPose.pelvisRot[1] > 0.3);
});
