import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getFighterById,
  matchesRosterFilter,
  UFC_ROSTER,
  WEIGHT_CLASS_OPTIONS,
} from './fighters';
import {
  BACKYARD_HALF_SIZE,
  BOXING_RING_HALF_SIZE,
  createBoutState,
  FighterInput,
  stepBout,
  OCTAGON_RADIUS,
} from './combatEngine';
import {
  CAMERA_PRESET_OPTIONS,
  clampTouchPosition,
  cloneDefaultControlSettings,
  getControlsForPreset,
  getDefaultTouchPositions,
  hasCustomTouchLayout,
  loadControlSettings,
} from './controlSettings';
import { InputHub } from './inputHub';
import { getFighterPortraitUrl } from './portraits';

const idleInput = (): FighterInput => ({
  moveX: 0,
  moveZ: 0,
  guard: 'none',
  requestedStrike: null,
  requestedEvade: null,
});

function advanceSeconds(
  bout: ReturnType<typeof createBoutState>,
  seconds: number,
  getInputs: (t: number) => [FighterInput, FighterInput],
) {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  const allEvents = [];
  for (let i = 0; i < steps; i++) {
    bout.hitstopTimer = 0; // skip hitstop freeze in deterministic unit checks unless tested
    const evs = stepBout(bout, getInputs(i * dt), dt);
    allEvents.push(...evs);
  }
  return allEvents;
}

test('clean cross lands at striking range and reduces headHp', () => {
  const red = getFighterById('holloway');
  const blue = getFighterById('jung');
  const bout = createBoutState(red, blue);
  bout.fighters[0].x = -0.6;
  bout.fighters[1].x = 0.6;
  const initialHead = bout.fighters[1].headHp;

  const events = advanceSeconds(bout, 0.45, (t) => [
    t < 0.02
      ? { ...idleInput(), requestedStrike: 'cross' }
      : idleInput(),
    idleInput(),
  ]);

  assert.ok(
    events.some((e) => e.type === 'hit' && e.zone === 'head'),
    'Expected head hit event',
  );
  assert.ok(
    bout.fighters[1].headHp < initialHead,
    'Expected defender headHp to decrease',
  );
  assert.equal(bout.fighters[0].strikesLanded, 1);
});

test('high guard blocks head strike and drains blockHealth instead of full damage', () => {
  const bout = createBoutState(
    getFighterById('topuria'),
    getFighterById('holloway'),
  );
  bout.fighters[0].x = -0.6;
  bout.fighters[1].x = 0.6;
  const initialHead = bout.fighters[1].headHp;

  const events = advanceSeconds(bout, 0.45, (t) => [
    t < 0.02
      ? { ...idleInput(), requestedStrike: 'rearHook' }
      : idleInput(),
    { ...idleInput(), guard: 'high' },
  ]);

  assert.ok(
    events.some((e) => e.type === 'blocked' && e.zone === 'head'),
    'Expected blocked head event',
  );
  assert.ok(
    bout.fighters[1].blockHealth < 100,
    'Expected blockHealth to drain',
  );
  assert.ok(
    initialHead - bout.fighters[1].headHp < 6,
    'Blocked head shot should deal minimal chip damage',
  );
});

test('slip evasion dodges head strike cleanly', () => {
  const bout = createBoutState(
    getFighterById('gaethje'),
    getFighterById('adesanya'),
  );
  bout.fighters[0].x = -0.65;
  bout.fighters[1].x = 0.65;
  const initialHead = bout.fighters[1].headHp;

  const events = advanceSeconds(bout, 0.45, (t) => [
    t < 0.02
      ? { ...idleInput(), requestedStrike: 'cross' }
      : idleInput(),
    t >= 0.05 && t < 0.08
      ? { ...idleInput(), requestedEvade: 'slipLeft' }
      : idleInput(),
  ]);

  assert.ok(
    events.some((e) => e.type === 'evaded'),
    'Expected slip evasion event',
  );
  assert.equal(bout.fighters[1].headHp, initialHead);
});

test('jab chains smoothly into cross combo', () => {
  const bout = createBoutState(
    getFighterById('holloway'),
    getFighterById('jung'),
  );
  bout.fighters[0].x = -0.6;
  bout.fighters[1].x = 0.6;

  const events = advanceSeconds(bout, 0.9, (t) => [
    t < 0.02
      ? { ...idleInput(), requestedStrike: 'jab' }
      : t >= 0.14 && t < 0.18
        ? { ...idleInput(), requestedStrike: 'cross' }
        : idleInput(),
    idleInput(),
  ]);

  const hits = events.filter((e) => e.type === 'hit');
  assert.equal(hits.length, 2, 'Expected both jab and cross to land in combo');
  assert.equal(bout.fighters[0].comboCount, 2);
});

test('fighters stay clamped inside enlarged 7.4m octagon perimeter and can fight out past 5.4m', () => {
  assert.equal(OCTAGON_RADIUS, 7.4);
  const bout = createBoutState(
    getFighterById('pereira'),
    getFighterById('adesanya'),
  );
  bout.fighters[0].x = -6.2;
  bout.fighters[1].x = 6.2;

  advanceSeconds(bout, 0.4, () => [idleInput(), idleInput()]);
  assert.ok(
    Math.abs(bout.fighters[0].x) > 5.8,
    'Larger cage should let fighters stand past old 5.4m wall without premature clamping',
  );

  bout.fighters[0].x = -8.2;
  bout.fighters[1].x = 8.2;
  advanceSeconds(bout, 1.0, () => [
    { ...idleInput(), moveZ: -1 },
    { ...idleInput(), moveZ: -1 },
  ]);

  for (const f of bout.fighters) {
    assert.ok(Math.hypot(f.x, f.z) <= OCTAGON_RADIUS - 0.5);
  }
});

test('lethal head damage triggers KO victory state', () => {
  const bout = createBoutState(
    getFighterById('pereira'),
    getFighterById('jung'),
  );
  bout.fighters[0].x = -0.6;
  bout.fighters[1].x = 0.6;
  bout.fighters[1].headHp = 8;

  const events = advanceSeconds(bout, 0.5, (t) => [
    t < 0.02
      ? { ...idleInput(), requestedStrike: 'rearHook' }
      : idleInput(),
    idleInput(),
  ]);

  assert.ok(events.some((e) => e.type === 'ko'));
  assert.equal(bout.koWinnerIndex, 0);
  assert.equal(bout.koMethod, 'KO');
});

test('high stun buildup rocks defender and activates rockedFlashTimer', () => {
  const bout = createBoutState(
    getFighterById('jones'),
    getFighterById('aspinall'),
  );
  bout.fighters[0].x = -0.6;
  bout.fighters[1].x = 0.6;
  bout.fighters[1].stunMeter = 30;
  bout.fighters[1].headHp = 95;

  const events = advanceSeconds(bout, 0.4, (t) => [
    t < 0.02
      ? { ...idleInput(), requestedStrike: 'rearHook' }
      : idleInput(),
    idleInput(),
  ]);

  assert.ok(events.some((e) => e.type === 'stunned'));
  assert.equal(bout.fighters[1].action, 'stunned');
  assert.ok(bout.rockedFlashTimer > 0);
  assert.ok(bout.fighters[1].rockedFlashTimer > 0);
});

test('180ms input buffer queues and blends multi-strike combo without resetting to idle', () => {
  const bout = createBoutState(
    getFighterById('holloway'),
    getFighterById('jung'),
  );
  bout.fighters[0].x = -0.52;
  bout.fighters[1].x = 0.52;

  let returnedToIdleMidCombo = false;
  const dt = 1 / 60;
  const events: ReturnType<typeof stepBout> = [];
  for (let i = 0; i < 65; i++) {
    bout.hitstopTimer = 0;
    const t = i * dt;
    let req: FighterInput['requestedStrike'] = null;
    if (i === 0) req = 'jab';
    else if (i === 6) req = 'cross'; // queued mid-jab (~0.10s) within 180ms buffer
    else if (i === 18) req = 'leadHook'; // queued during cross

    const evs = stepBout(
      bout,
      [{ ...idleInput(), requestedStrike: req }, idleInput()],
      dt,
    );
    events.push(...evs);
    if (t > 0.05 && t < 0.72 && bout.fighters[0].action === 'idle') {
      returnedToIdleMidCombo = true;
    }
  }

  const hits = events.filter((e) => e.type === 'hit');
  assert.equal(hits.length, 3, 'Expected all 3 queued combo strikes to land');
  assert.equal(returnedToIdleMidCombo, false, 'Combo should blend without returning to idle');
});

test('tapping block mid-windup feints and cancels strike without dealing damage', () => {
  const bout = createBoutState(
    getFighterById('mcgregor'),
    getFighterById('poirier'),
  );
  bout.fighters[0].x = -0.6;
  bout.fighters[1].x = 0.6;
  const initialHead = bout.fighters[1].headHp;

  const events = advanceSeconds(bout, 0.35, (t) => [
    t < 0.02
      ? { ...idleInput(), requestedStrike: 'overhand' }
      : t >= 0.05 && t < 0.07
        ? { ...idleInput(), requestedFeint: true }
        : idleInput(),
    idleInput(),
  ]);

  assert.ok(events.some((e) => e.type === 'feint'), 'Expected feint event');
  assert.equal(events.some((e) => e.type === 'hit'), false, 'Feinted strike must not hit');
  assert.equal(bout.fighters[1].headHp, initialHead);
  assert.equal(bout.fighters[0].action, 'idle');
});

test('forward momentum boosts strike power while backward step triggers faster check-hook', () => {
  const fwdBout = createBoutState(getFighterById('topuria'), getFighterById('holloway'));
  fwdBout.fighters[0].x = -0.65;
  fwdBout.fighters[1].x = 0.65;

  const backBout = createBoutState(getFighterById('topuria'), getFighterById('holloway'));
  backBout.fighters[0].x = -0.65;
  backBout.fighters[1].x = 0.65;

  advanceSeconds(fwdBout, 0.05, () => [
    { ...idleInput(), moveZ: 1, requestedStrike: 'leadHook' },
    idleInput(),
  ]);
  advanceSeconds(backBout, 0.05, () => [
    { ...idleInput(), moveZ: -1, requestedStrike: 'leadHook' },
    idleInput(),
  ]);

  assert.ok(
    fwdBout.fighters[0].strikePowerMult > 1.1,
    'Forward step should increase strike power multiplier',
  );
  assert.ok(
    backBout.fighters[0].actionDuration < fwdBout.fighters[0].actionDuration,
    'Backward check-hook should execute faster than lunging forward hook',
  );
  assert.ok(
    backBout.fighters[0].strikeLungeMult < 0,
    'Backward step should pull weight back on check-hook',
  );
});

test('evading opens 0.3s counter window while ducking into uppercut triggers vulnerability hitstop and rocked stumble', () => {
  // Part A: clean pull-back evade opens counterWindowTimer (~0.3s) and boosts next counter
  const evadeBout = createBoutState(
    getFighterById('adesanya'),
    getFighterById('pereira'),
  );
  evadeBout.fighters[0].x = -0.7;
  evadeBout.fighters[1].x = 0.7;

  const evadeEvents = advanceSeconds(evadeBout, 0.32, (t) => [
    t < 0.02
      ? { ...idleInput(), requestedStrike: 'cross' }
      : idleInput(),
    t >= 0.04 && t < 0.07
      ? { ...idleInput(), requestedEvade: 'pullBack' }
      : idleInput(),
  ]);
  assert.ok(evadeEvents.some((e) => e.type === 'evaded'));
  assert.ok(
    evadeBout.fighters[1].counterWindowTimer > 0.1,
    'Clean evade should open a 0.3s counter window',
  );

  // Part B: ducking into an uppercut causes vulnerability, 2-3 frame hitstop, and rocked stumble!
  const vulnBout = createBoutState(
    getFighterById('pereira'),
    getFighterById('jung'),
  );
  vulnBout.fighters[0].x = -0.58;
  vulnBout.fighters[1].x = 0.58;

  let observedHitstop = 0;
  const dt = 1 / 60;
  for (let i = 0; i < 30; i++) {
    const t = i * dt;
    const evs = stepBout(
      vulnBout,
      [
        t < 0.02 ? { ...idleInput(), requestedStrike: 'leadUppercut' } : idleInput(),
        t >= 0.08 && t < 0.12 ? { ...idleInput(), requestedEvade: 'duck' } : idleInput(),
      ],
      dt,
    );
    if (vulnBout.hitstopTimer > observedHitstop) {
      observedHitstop = vulnBout.hitstopTimer;
    }
    if (evs.some((e) => e.type === 'stunned')) break;
  }

  assert.ok(observedHitstop >= 0.04, 'Caught-leaning counter must trigger 2-3 frame hitstop');
  assert.equal(
    vulnBout.fighters[1].action,
    'stunned',
    'Ducking into uppercut should rock defender into stunned stumble',
  );
});

test('directional lunge bursts fighter across octagon', () => {
  const bout = createBoutState(
    getFighterById('holloway'),
    getFighterById('mcgregor'),
  );
  const startX = bout.fighters[0].x;
  const events = advanceSeconds(bout, 0.25, (t) => [
    t < 0.02
      ? { ...idleInput(), requestedLunge: { x: 0, z: 1 } }
      : idleInput(),
    idleInput(),
  ]);
  assert.ok(events.some((e) => e.type === 'lunge'));
  assert.ok(
    bout.fighters[0].x - startX > 0.45,
    'Directional forward lunge should cover significant octagon distance rapidly',
  );
});

test('5 difficulty tiers configure distinct AI speed, evade skill, and cooldown scaling', async () => {
  const { DIFFICULTY_LEVELS } = await import('./combatEngine');
  const tiers = ['rookie', 'pro', 'champion', 'hallOfFamer', 'legend'] as const;
  for (let i = 1; i < tiers.length; i++) {
    const prev = DIFFICULTY_LEVELS[tiers[i - 1]];
    const curr = DIFFICULTY_LEVELS[tiers[i]];
    assert.ok(curr.diffMult > prev.diffMult, `${curr.id} should scale diffMult above ${prev.id}`);
    assert.ok(curr.evadeSkill > prev.evadeSkill, `${curr.id} should evade more skillfully than ${prev.id}`);
    assert.ok(curr.cooldownScale < prev.cooldownScale, `${curr.id} should attack faster than ${prev.id}`);
  }
  const rookieBout = createBoutState(getFighterById('holloway'), getFighterById('mcgregor'), 'rookie');
  const hofBout = createBoutState(getFighterById('holloway'), getFighterById('mcgregor'), 'hallOfFamer');
  assert.equal(rookieBout.difficulty, 'rookie');
  assert.equal(hofBout.difficulty, 'hallOfFamer');
});

test('head strikes record hitReactSide for directional skeletal recoil', () => {
  const bout = createBoutState(
    getFighterById('mcgregor'),
    getFighterById('poirier'),
  );
  bout.fighters[0].x = -0.6;
  bout.fighters[1].x = 0.6;

  advanceSeconds(bout, 0.4, (t) => [
    t < 0.02 ? { ...idleInput(), requestedStrike: 'jab' } : idleInput(),
    idleInput(),
  ]);

  assert.notEqual(
    bout.fighters[1].hitReactSide,
    0,
    'Clean strike should set non-zero directional hitReactSide (-1 or 1)',
  );
});

test('swept active-frame hit detection catches fast strikes even at coarse 20fps frame steps', () => {
  const bout = createBoutState(
    getFighterById('holloway'),
    getFighterById('jung'),
  );
  bout.fighters[0].x = -0.6;
  bout.fighters[1].x = 0.6;

  // Step at coarse dt=0.05s (20fps) and verify fast jab never skips its ~0.07s active window
  const dt = 0.05;
  let hit = false;
  for (let i = 0; i < 12; i++) {
    const evs = stepBout(
      bout,
      [i === 0 ? { ...idleInput(), requestedStrike: 'jab' } : idleInput(), idleInput()],
      dt,
    );
    if (evs.some((e) => e.type === 'hit')) {
      hit = true;
      break;
    }
  }
  assert.ok(hit, 'Fast jab must register hit even at coarse 50ms frame intervals');
});

test('arcing hook connects on slightly offset opponent inside anatomical capsule', () => {
  const bout = createBoutState(
    getFighterById('pereira'),
    getFighterById('adesanya'),
  );
  bout.fighters[0].x = -0.55;
  bout.fighters[1].x = 0.55;
  // Slightly circle opponent off-centerline
  bout.fighters[1].z = 0.34;

  const events = advanceSeconds(bout, 0.45, (t) => [
    t < 0.02 ? { ...idleInput(), requestedStrike: 'leadHook' } : idleInput(),
    idleInput(),
  ]);

  assert.ok(
    events.some((e) => e.type === 'hit'),
    'Sweeping lead hook should catch laterally circling opponent within anatomical capsule',
  );
});

test('pull-back evades head strike at range while leaving body target vulnerable to body kick', () => {
  const bout = createBoutState(
    getFighterById('adesanya'),
    getFighterById('mcgregor'),
  );
  bout.fighters[0].x = -0.78;
  bout.fighters[1].x = 0.78;

  const events = advanceSeconds(bout, 0.5, (t) => [
    t < 0.02 ? { ...idleInput(), requestedStrike: 'bodyKick' } : idleInput(),
    t >= 0.12 && t < 0.16 ? { ...idleInput(), requestedEvade: 'pullBack' } : idleInput(),
  ]);

  assert.ok(
    events.some((e) => e.type === 'hit' && e.zone === 'body'),
    'Body kick should punish defender leaning head back with pullBack',
  );
});

test('fighters start 4.9m apart at the opening bell', () => {
  const bout = createBoutState(
    getFighterById('holloway'),
    getFighterById('mcgregor'),
  );
  const gap = bout.fighters[1].x - bout.fighters[0].x;
  assert.ok(gap >= 4.8, `Expected >= 4.8m opening separation, got ${gap}`);
});

test('simulation mode slows gameplay pace, movement speed, and stamina regeneration', () => {
  const arcBout = createBoutState(
    getFighterById('holloway'),
    getFighterById('mcgregor'),
    'champion',
    false,
  );
  const simBout = createBoutState(
    getFighterById('holloway'),
    getFighterById('mcgregor'),
    'champion',
    true,
  );

  arcBout.fighters[0].stamina = 40;
  simBout.fighters[0].stamina = 40;

  const arcStartX = arcBout.fighters[0].x;
  const simStartX = simBout.fighters[0].x;

  advanceSeconds(arcBout, 0.5, () => [
    { ...idleInput(), moveZ: 1 },
    idleInput(),
  ]);
  advanceSeconds(simBout, 0.5, () => [
    { ...idleInput(), moveZ: 1 },
    idleInput(),
  ]);

  const arcMoved = arcBout.fighters[0].x - arcStartX;
  const simMoved = simBout.fighters[0].x - simStartX;
  assert.ok(
    simMoved < arcMoved * 0.78,
    `Expected simulation move (${simMoved.toFixed(3)}) < arcade move (${arcMoved.toFixed(3)})`,
  );

  const arcStamGained = arcBout.fighters[0].stamina - 40;
  const simStamGained = simBout.fighters[0].stamina - 40;
  assert.ok(
    simStamGained < arcStamGained * 0.72,
    `Expected simulation stamina gain (${simStamGained.toFixed(2)}) < arcade stamina gain (${arcStamGained.toFixed(2)})`,
  );
  assert.ok(
    simBout.roundTimeRemaining > arcBout.roundTimeRemaining,
    'Simulation mode should tick round clock slightly slower',
  );
});

test('knockout assigns distinct koStyle by finishing strike', () => {
  const makeKoBout = (strike: NonNullable<FighterInput['requestedStrike']>) => {
    const bout = createBoutState(
      getFighterById('pereira'),
      getFighterById('jung'),
    );
    bout.fighters[0].x = -0.58;
    bout.fighters[1].x = 0.58;
    bout.fighters[1].headHp = 6;
    advanceSeconds(bout, 0.5, (t) => [
      t < 0.02 ? { ...idleInput(), requestedStrike: strike } : idleInput(),
      idleInput(),
    ]);
    return bout;
  };

  assert.equal(makeKoBout('leadUppercut').fighters[1].koStyle, 'crumple');
  assert.equal(makeKoBout('leadHook').fighters[1].koStyle, 'twisted');
  assert.equal(makeKoBout('cross').fighters[1].koStyle, 'backward');
});

test('punches and kicks thrown from far away whiff without phantom hits', () => {
  const bout = createBoutState(
    getFighterById('holloway'),
    getFighterById('mcgregor'),
  );
  // Standing 1.85m apart is visually outside realistic striking range even with lunge
  bout.fighters[0].x = -0.925;
  bout.fighters[1].x = 0.925;

  const punchEvents = advanceSeconds(bout, 0.45, (t) => [
    t < 0.02 ? { ...idleInput(), requestedStrike: 'cross' } : idleInput(),
    idleInput(),
  ]);
  assert.equal(
    punchEvents.some((e) => e.type === 'hit'),
    false,
    'Cross from 1.85m away should whiff',
  );

  // Reset distance to 1.95m and verify head kick also whiffs cleanly
  bout.fighters[0].x = -0.975;
  bout.fighters[1].x = 0.975;
  const kickEvents = advanceSeconds(bout, 0.55, (t) => [
    t < 0.02 ? { ...idleInput(), requestedStrike: 'headKick' } : idleInput(),
    idleInput(),
  ]);
  assert.equal(
    kickEvents.some((e) => e.type === 'hit'),
    false,
    'Head kick from 1.95m away should whiff cleanly',
  );
});

test('boxing ring arena clamps fighters to square ring bounds and supports 5 rounds', () => {
  const bout = createBoutState(
    getFighterById('holloway'),
    getFighterById('topuria'),
    'champion',
    false,
    'boxingRing',
    5,
  );
  assert.equal(bout.arena, 'boxingRing');
  assert.equal(bout.maxRounds, 5);

  bout.fighters[0].x = -4.9;
  bout.fighters[0].z = 4.9;
  bout.fighters[1].x = 4.9;
  bout.fighters[1].z = -4.9;

  advanceSeconds(bout, 0.25, () => [idleInput(), idleInput()]);

  const maxCoord = BOXING_RING_HALF_SIZE - 0.5;
  for (const f of bout.fighters) {
    assert.ok(Math.abs(f.x) <= maxCoord, `Expected |x| <= ${maxCoord}, got ${f.x}`);
    assert.ok(Math.abs(f.z) <= maxCoord, `Expected |z| <= ${maxCoord}, got ${f.z}`);
  }
});

test('virtual touch joystick maps up/down/left/right cleanly without inversion on either side', () => {
  const hub = new InputHub();

  // Pushing stick UP (screenY = -1) while facing right (+PI/2) must move fighter UP on screen (-Z)
  const bout = createBoutState(getFighterById('holloway'), getFighterById('mcgregor'));
  const startZ = bout.fighters[0].z;
  hub.setTouchStick(0, -1);
  advanceSeconds(bout, 0.32, () => [
    hub.samplePlayerInput(1 / 60, bout.fighters[0].facingYaw),
    idleInput(),
  ]);
  assert.ok(
    bout.fighters[0].z < startZ - 0.18,
    `Pushing stick UP should move fighter away from camera (-Z), got z=${bout.fighters[0].z}`,
  );

  // Pushing stick DOWN (screenY = +1) must move fighter DOWN toward camera (+Z)
  const zBeforeDown = bout.fighters[0].z;
  hub.setTouchStick(0, 1);
  advanceSeconds(bout, 0.45, () => [
    hub.samplePlayerInput(1 / 60, bout.fighters[0].facingYaw),
    idleInput(),
  ]);
  assert.ok(
    bout.fighters[0].z > zBeforeDown + 0.2,
    `Pushing stick DOWN should move fighter toward camera (+Z), got z=${bout.fighters[0].z}`,
  );

  // Even when fighters swap sides (Red on right facing -PI/2), pushing RIGHT moves +X and UP moves -Z
  const swappedBout = createBoutState(getFighterById('holloway'), getFighterById('mcgregor'));
  swappedBout.fighters[0].x = 2.0;
  swappedBout.fighters[0].facingYaw = -Math.PI / 2;
  swappedBout.fighters[1].x = -2.0;
  swappedBout.fighters[1].facingYaw = Math.PI / 2;
  const swapStartX = swappedBout.fighters[0].x;
  const swapStartZ = swappedBout.fighters[0].z;

  hub.setTouchStick(1, -1);
  advanceSeconds(swappedBout, 0.2, () => [
    hub.samplePlayerInput(1 / 60, swappedBout.fighters[0].facingYaw),
    idleInput(),
  ]);
  assert.ok(swappedBout.fighters[0].x > swapStartX + 0.1, 'Right stick moves +X even on right side');
  assert.ok(swappedBout.fighters[0].z < swapStartZ - 0.1, 'Up stick moves -Z even on right side');
});

test('every weight class option in setup matches at least two fighters accurately', () => {
  for (const opt of WEIGHT_CLASS_OPTIONS) {
    const matches = UFC_ROSTER.filter((f) => matchesRosterFilter(f, opt.id));
    assert.ok(
      matches.length >= 2,
      `Weight class ${opt.id} should match at least 2 fighters, found ${matches.length}`,
    );
  }
  const lwMatches = UFC_ROSTER.filter((f) => matchesRosterFilter(f, 'lightweight'));
  assert.equal(
    lwMatches.some((f) => f.weightClass.toLowerCase().includes('light heavyweight')),
    false,
    'Lightweight filter must not include Light Heavyweights',
  );
});

test('blocking while rocked/stunned blocks incoming head and body strikes instead of letting them through', () => {
  const bout = createBoutState(
    getFighterById('pereira'),
    getFighterById('holloway'),
  );
  bout.fighters[0].x = -0.58;
  bout.fighters[1].x = 0.58;
  // Simulate defender already rocked after an exchange with low remaining block health
  bout.fighters[1].action = 'stunned';
  bout.fighters[1].actionTime = 0.1;
  bout.fighters[1].actionDuration = 1.85;
  bout.fighters[1].guard = 'none';
  bout.fighters[1].blockHealth = 35;
  const headBefore = bout.fighters[1].headHp;

  const events = advanceSeconds(bout, 0.6, (t) => [
    t < 0.02 ? { ...idleInput(), requestedStrike: 'rearHook' } : idleInput(),
    { ...idleInput(), guard: 'high' },
  ]);

  assert.equal(bout.fighters[1].guard, 'high', 'Defender should be able to raise high guard while rocked');
  assert.ok(
    events.some((e) => e.type === 'blocked' && e.zone === 'head'),
    'Head hook should be blocked while rocked and holding block',
  );
  assert.equal(
    events.some((e) => e.type === 'hit'),
    false,
    'Strike must not bypass active guard while rocked',
  );
  assert.ok(
    headBefore - bout.fighters[1].headHp < 6,
    'Only minimal block chip should occur while blocking rocked',
  );
});

test('fighter movement speed and gameplay pace are calibrated to deliberate slower pace', () => {
  const bout = createBoutState(
    getFighterById('holloway'),
    getFighterById('mcgregor'),
  );
  const startX = bout.fighters[0].x;
  const startClock = bout.roundTimeRemaining;

  advanceSeconds(bout, 1.0, () => [{ ...idleInput(), moveZ: 1 }, idleInput()]);

  const moved = bout.fighters[0].x - startX;
  const clockElapsed = startClock - bout.roundTimeRemaining;

  assert.ok(
    moved > 0.72 && moved < 1.32,
    `Expected deliberate slower footwork distance in 1s (0.72m..1.32m), got ${moved.toFixed(3)}m`,
  );
  assert.ok(
    clockElapsed < 0.85,
    `Expected gameplay pace scale < 0.85x real time, got ${clockElapsed.toFixed(3)}s`,
  );
});

test('backyard arena clamps fighters inside square backyard pit bounds', () => {
  const bout = createBoutState(
    getFighterById('holloway'),
    getFighterById('mcgregor'),
    'champion',
    false,
    'backyard',
    3,
  );
  assert.equal(bout.arena, 'backyard');

  bout.fighters[0].x = -5.2;
  bout.fighters[0].z = 5.2;
  bout.fighters[1].x = 5.2;
  bout.fighters[1].z = -5.2;

  advanceSeconds(bout, 0.25, () => [idleInput(), idleInput()]);

  const maxCoord = BACKYARD_HALF_SIZE - 0.5;
  for (const f of bout.fighters) {
    assert.ok(Math.abs(f.x) <= maxCoord, `Expected |x| <= ${maxCoord}, got ${f.x}`);
    assert.ok(Math.abs(f.z) <= maxCoord, `Expected |z| <= ${maxCoord}, got ${f.z}`);
  }
});

test('custom touch control layout helpers clamp bounds, mirror handedness, and detect overrides', () => {
  const arcControls = getControlsForPreset('arc');
  const fourLimbControls = getControlsForPreset('fourLimb');
  assert.equal(arcControls.length, 7);
  assert.equal(fourLimbControls.length, 9);

  const stdPos = getDefaultTouchPositions('arc', 'standard');
  const leftPos = getDefaultTouchPositions('arc', 'leftHanded');
  assert.ok(stdPos.stick.x < 0.3 && leftPos.stick.x > 0.7, 'Left-handed layout should mirror stick to right side');
  assert.ok(stdPos.punch.x > 0.7 && leftPos.punch.x < 0.3, 'Left-handed layout should mirror strike cluster to left side');

  const clamped = clampTouchPosition({ x: -0.2, y: 0.99 });
  assert.equal(clamped.x, 0.06);
  assert.equal(clamped.y, 0.92);

  const defaults = cloneDefaultControlSettings();
  assert.equal(hasCustomTouchLayout(defaults.touch), false);
  defaults.touch.customPositions = { punch: { x: 0.82, y: 0.62 } };
  assert.equal(hasCustomTouchLayout(defaults.touch), true);
});

test('expanded UFC roster has unique IDs and deep coverage across all 7 weight divisions', () => {
  assert.ok(
    UFC_ROSTER.length >= 44,
    `Expected expanded roster >= 44 fighters, got ${UFC_ROSTER.length}`,
  );
  const uniqueIds = new Set(UFC_ROSTER.map((f) => f.id));
  assert.equal(uniqueIds.size, UFC_ROSTER.length, 'All fighter IDs must be unique');

  for (const div of WEIGHT_CLASS_OPTIONS) {
    if (div.id === 'all') continue;
    const count = UFC_ROSTER.filter((f) => matchesRosterFilter(f, div.id)).length;
    assert.ok(
      count >= 5,
      `Expected at least 5 fighters in ${div.label}, got ${count}`,
    );
  }
});

test('all 6 camera presets exist and perspective-follow cameras remap stick forward/strafe cleanly', () => {
  const expectedIds = [
    'default',
    'wide',
    'close',
    'firstPerson',
    'thirdPerson',
    'topToSide',
  ];
  assert.deepEqual(
    CAMERA_PRESET_OPTIONS.map((c) => c.id),
    expectedIds,
  );
  assert.equal(cloneDefaultControlSettings().cameraPreset, 'default');
  assert.equal(loadControlSettings().cameraPreset, 'default');

  const hub = new InputHub();
  hub.setTouchStick(0, -1); // push up
  const followUp = hub.samplePlayerInput(1 / 60, Math.PI / 2, true);
  assert.ok(
    followUp.moveZ > 0.9,
    `Pushing up in 1st/3rd person must advance forward toward opponent (+moveZ), got ${followUp.moveZ}`,
  );

  hub.setTouchStick(1, 0); // push right
  const followRight = hub.samplePlayerInput(1 / 60, Math.PI / 2, true);
  assert.ok(
    followRight.moveX < -0.9,
    `Pushing right in 1st/3rd person must strafe right (-moveX), got ${followRight.moveX}`,
  );
});

test('every fighter in UFC_ROSTER maps to a real non-empty photo file in public/assets/fighters', () => {
  for (const fighter of UFC_ROSTER) {
    const url = getFighterPortraitUrl(fighter);
    assert.equal(url, `/assets/fighters/${fighter.id}.jpg`);
    const diskPath = path.resolve(
      process.cwd(),
      'public',
      'assets',
      'fighters',
      `${fighter.id}.jpg`,
    );
    assert.ok(
      fs.existsSync(diskPath),
      `Missing real fighter photo on disk: ${diskPath}`,
    );
    const stat = fs.statSync(diskPath);
    assert.ok(
      stat.size > 2000,
      `Fighter photo looks corrupted/too small (${stat.size} bytes): ${diskPath}`,
    );
  }
});



