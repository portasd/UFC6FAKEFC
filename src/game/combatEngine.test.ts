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
  bout.fighters[0].x = -0.62;
  bout.fighters[1].x = 0.62;

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
