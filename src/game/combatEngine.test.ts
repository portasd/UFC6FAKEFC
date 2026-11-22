import test from 'node:test';
import assert from 'node:assert/strict';
import { getFighterById } from './fighters';
import {
  createBoutState,
  FighterInput,
  stepBout,
  OCTAGON_RADIUS,
} from './combatEngine';

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

test('fighters stay clamped inside octagon perimeter', () => {
  const bout = createBoutState(
    getFighterById('pereira'),
    getFighterById('adesanya'),
  );
  bout.fighters[0].x = -5.2;
  bout.fighters[1].x = 5.2;

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
