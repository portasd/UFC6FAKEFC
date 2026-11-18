import { AiArchetype, FighterProfile, Stance } from './fighters';
import { getStrikeDuration, STRIKES, StrikeId, TargetZone } from './strikes';

export type EvadeType = 'slipLeft' | 'slipRight' | 'pullBack' | 'duck';

export type FighterActionType =
  | 'idle'
  | 'strike'
  | 'slipLeft'
  | 'slipRight'
  | 'pullBack'
  | 'duck'
  | 'hitReact'
  | 'stunned'
  | 'knockdown'
  | 'ko';

export type GuardMode = 'none' | 'high' | 'low';

export interface FighterInput {
  moveX: number; // -1..1 relative to facing (lateral strafe)
  moveZ: number; // -1..1 forward/backward toward opponent
  guard: GuardMode;
  requestedStrike: StrikeId | null;
  requestedEvade: EvadeType | null;
  heldEvade?: EvadeType | null;
  requestedLunge?: { x: number; z: number } | null;
  requestedFeint?: boolean;
}

export interface CombatEvent {
  type:
    | 'strikeStart'
    | 'feint'
    | 'lunge'
    | 'hit'
    | 'blocked'
    | 'evaded'
    | 'stunned'
    | 'knockdown'
    | 'ko'
    | 'roundEnd';
  attackerIndex: 0 | 1;
  defenderIndex: 0 | 1;
  strikeId?: StrikeId;
  zone?: TargetZone;
  damage?: number;
  isCounter?: boolean;
  isHeavy?: boolean;
  hitPosition?: { x: number; y: number; z: number };
}

export interface FighterState {
  index: 0 | 1;
  profile: FighterProfile;
  stance: Stance;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facingYaw: number;
  headHp: number;
  maxHeadHp: number;
  bodyHp: number;
  maxBodyHp: number;
  legHp: number;
  maxLegHp: number;
  stamina: number;
  maxStamina: number;
  blockHealth: number;
  maxBlockHealth: number;
  guard: GuardMode;
  action: FighterActionType;
  actionTime: number;
  actionDuration: number;
  currentStrike: StrikeId | null;
  strikeHitRegistered: boolean;
  queuedStrike: StrikeId | null;
  queuedStrikeTimer: number;
  counterWindowTimer: number;
  isCounterStrike: boolean;
  strikePowerMult: number;
  strikeReachMult: number;
  strikeLungeMult: number;
  feintCooldown: number;
  lungeTimer: number;
  lungeDirX: number;
  lungeDirZ: number;
  hitReactZone: TargetZone;
  hitReactIntensity: number;
  hitFlashTimer: number;
  rockedFlashTimer: number;
  stunMeter: number;
  knockdowns: number;
  strikesLanded: number;
  strikesThrown: number;
  headLanded: number;
  bodyLanded: number;
  legLanded: number;
  countersLanded: number;
  comboCount: number;
  comboResetTimer: number;
  gaitPhase: number;
  aiCooldown: number;
  aiThinkTimer: number;
  aiStrafeDir: number;
  aiDesiredRange: number;
  aiQueuedCombo: StrikeId[];
}

export interface BoutState {
  fighters: [FighterState, FighterState];
  round: number;
  maxRounds: number;
  roundTimeRemaining: number;
  roundDuration: number;
  hitstopTimer: number;
  slowMoTimer: number;
  rockedFlashTimer: number;
  koWinnerIndex: 0 | 1 | null;
  koMethod: 'KO' | 'TKO' | 'DECISION' | null;
  koFinishTime: string;
  momentum: number; // -1 (Red) to +1 (Blue)
  difficulty: 'pro' | 'champion' | 'legend';
  calloutText: string;
  calloutTimer: number;
  calloutCorner: 'red' | 'blue' | 'neutral';
  roundScores: Array<{ red: number; blue: number }>;
  roundDamage: [number, number];
}

export const OCTAGON_RADIUS = 5.4;

export function createFighterState(
  index: 0 | 1,
  profile: FighterProfile,
): FighterState {
  const startX = index === 0 ? -1.45 : 1.45;
  const facingYaw = index === 0 ? Math.PI / 2 : -Math.PI / 2;
  const maxHead = 100 + (profile.stats.chin - 85) * 1.1;
  const maxBody = 100 + (profile.stats.cardio - 85) * 0.8;
  const maxLeg = 100 + (profile.stats.chin - 85) * 0.6;
  const maxStam = 100 + (profile.stats.cardio - 85) * 0.9;

  return {
    index,
    profile,
    stance: profile.stance,
    x: startX,
    z: 0,
    vx: 0,
    vz: 0,
    facingYaw,
    headHp: maxHead,
    maxHeadHp: maxHead,
    bodyHp: maxBody,
    maxBodyHp: maxBody,
    legHp: maxLeg,
    maxLegHp: maxLeg,
    stamina: maxStam,
    maxStamina: maxStam,
    blockHealth: 100,
    maxBlockHealth: 100,
    guard: 'none',
    action: 'idle',
    actionTime: 0,
    actionDuration: 0,
    currentStrike: null,
    strikeHitRegistered: false,
    queuedStrike: null,
    queuedStrikeTimer: 0,
    counterWindowTimer: 0,
    isCounterStrike: false,
    strikePowerMult: 1,
    strikeReachMult: 1,
    strikeLungeMult: 1,
    feintCooldown: 0,
    lungeTimer: 0,
    lungeDirX: 0,
    lungeDirZ: 0,
    hitReactZone: 'head',
    hitReactIntensity: 0,
    hitFlashTimer: 0,
    rockedFlashTimer: 0,
    stunMeter: 0,
    knockdowns: 0,
    strikesLanded: 0,
    strikesThrown: 0,
    headLanded: 0,
    bodyLanded: 0,
    legLanded: 0,
    countersLanded: 0,
    comboCount: 0,
    comboResetTimer: 0,
    gaitPhase: index === 0 ? 0 : Math.PI * 0.5,
    aiCooldown: 0.6,
    aiThinkTimer: 0.35,
    aiStrafeDir: index === 0 ? 1 : -1,
    aiDesiredRange: 1.55,
    aiQueuedCombo: [],
  };
}

export function createBoutState(
  redProfile: FighterProfile,
  blueProfile: FighterProfile,
  difficulty: 'pro' | 'champion' | 'legend' = 'champion',
): BoutState {
  return {
    fighters: [
      createFighterState(0, redProfile),
      createFighterState(1, blueProfile),
    ],
    round: 1,
    maxRounds: 3,
    roundTimeRemaining: 180,
    roundDuration: 180,
    hitstopTimer: 0,
    slowMoTimer: 0,
    rockedFlashTimer: 0,
    koWinnerIndex: null,
    koMethod: null,
    koFinishTime: '0:00',
    momentum: 0,
    difficulty,
    calloutText: '',
    calloutTimer: 0,
    calloutCorner: 'neutral',
    roundScores: [],
    roundDamage: [0, 0],
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function normalizeAngle(a: number): number {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

export function formatFightClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function startStrike(
  f: FighterState,
  strikeId: StrikeId,
  moveZ = 0,
): boolean {
  const spec = STRIKES[strikeId];
  const minStam = spec.staminaCost * 0.45;
  if (f.stamina < minStam) return false;

  const isCounterWindow = f.counterWindowTimer > 0;
  const steppingForward = moveZ > 0.25;
  const steppingBackward = moveZ < -0.25;

  let extraSpeed = 1.0;
  let powerMult = 1.0;
  let reachMult = 1.0;
  let lungeMult = 1.0;

  if (steppingForward) {
    // Stepping in adds lunge distance, reach, and heavy forward weight transfer
    lungeMult = 1.38;
    reachMult = 1.12;
    powerMult = 1.16;
  } else if (steppingBackward) {
    // Moving backward fires quick check-hooks and counter-jabs on the back foot
    extraSpeed = 1.18;
    lungeMult = -0.55;
    reachMult = 0.96;
  }

  if (isCounterWindow) {
    extraSpeed *= 1.24;
    powerMult *= 1.42;
    f.counterWindowTimer = 0;
  }

  const staminaRatio = f.stamina / f.maxStamina;
  const dur = getStrikeDuration(
    spec,
    f.profile.stats.speed,
    staminaRatio,
    extraSpeed,
  );
  f.action = 'strike';
  f.actionTime = 0;
  f.actionDuration = dur;
  f.currentStrike = strikeId;
  f.strikeHitRegistered = false;
  f.queuedStrike = null;
  f.queuedStrikeTimer = 0;
  f.guard = 'none';
  f.isCounterStrike = isCounterWindow;
  f.strikePowerMult = powerMult;
  f.strikeReachMult = reachMult;
  f.strikeLungeMult = lungeMult;
  f.lungeTimer = 0;
  f.strikesThrown += 1;
  f.stamina = Math.max(0, f.stamina - spec.staminaCost * 0.55);
  return true;
}

export function startEvade(
  f: FighterState,
  evadeType: EvadeType,
): boolean {
  if (f.stamina < 5.5) return false;
  if (
    f.action !== 'idle' &&
    !(f.action === 'strike' && f.actionTime < 0.09)
  ) {
    return false;
  }
  f.action = evadeType;
  f.actionTime = 0;
  f.actionDuration =
    evadeType === 'pullBack' ? 0.34 : evadeType === 'duck' ? 0.32 : 0.3;
  f.currentStrike = null;
  f.queuedStrike = null;
  f.queuedStrikeTimer = 0;
  f.guard = 'none';
  f.lungeTimer = 0;
  f.stamina = Math.max(0, f.stamina - 6.0);
  return true;
}

export function generateAiInput(
  ai: FighterState,
  opp: FighterState,
  bout: BoutState,
  dt: number,
): FighterInput {
  const dx = opp.x - ai.x;
  const dz = opp.z - ai.z;
  const dist = Math.hypot(dx, dz);

  const diffMult =
    bout.difficulty === 'legend'
      ? 1.28
      : bout.difficulty === 'champion'
        ? 1.0
        : 0.74;

  ai.aiThinkTimer -= dt;
  ai.aiCooldown = Math.max(0, ai.aiCooldown - dt);

  const archetype: AiArchetype = ai.profile.aiArchetype;

  if (ai.aiThinkTimer <= 0) {
    ai.aiThinkTimer = 0.25 + Math.random() * 0.3;
    if (Math.random() < 0.45) {
      ai.aiStrafeDir = Math.random() < 0.5 ? -1 : 1;
    }
    if (archetype === 'counterSniper') {
      ai.aiDesiredRange = 1.68;
    } else if (archetype === 'legKickBrawler') {
      ai.aiDesiredRange = 1.6;
    } else if (archetype === 'pressureBoxer') {
      ai.aiDesiredRange = 1.28;
    } else {
      ai.aiDesiredRange = 1.42;
    }
  }

  let moveZ = 0;
  let moveX = ai.aiStrafeDir * 0.45;
  let guard: GuardMode = 'none';
  let requestedStrike: StrikeId | null = null;
  let requestedEvade: EvadeType | null = null;

  if (ai.stamina < ai.maxStamina * 0.24) {
    moveZ = -0.8;
    guard = 'high';
    return { moveX, moveZ, guard, requestedStrike, requestedEvade };
  }

  if (dist > ai.aiDesiredRange + 0.18) {
    moveZ = archetype === 'pressureBoxer' ? 0.95 : 0.78;
  } else if (dist < ai.aiDesiredRange - 0.25) {
    moveZ = archetype === 'counterSniper' ? -0.85 : -0.45;
  }

  // Defensive reaction when opponent is actively striking
  if (opp.action === 'strike' && opp.currentStrike && dist < 2.05) {
    const oppSpec = STRIKES[opp.currentStrike];
    const reactChance =
      (archetype === 'counterSniper' ? 0.72 : 0.52) * diffMult;
    if (ai.action === 'idle' && Math.random() < reactChance) {
      if (oppSpec.zone === 'head' && Math.random() < 0.36 * diffMult) {
        const r = Math.random();
        requestedEvade =
          r < 0.34 ? 'slipLeft' : r < 0.68 ? 'pullBack' : 'duck';
      } else {
        guard = oppSpec.zone === 'head' ? 'high' : 'low';
      }
    } else if (ai.guard !== 'none') {
      guard = oppSpec.zone === 'head' ? 'high' : 'low';
    }
  }

  // Immediate pull-counter trigger if AI earned a counter window
  if (ai.action === 'idle' && ai.counterWindowTimer > 0 && dist < 1.85) {
    requestedStrike = Math.random() < 0.5 ? 'cross' : 'leadHook';
    return { moveX, moveZ, guard, requestedStrike, requestedEvade };
  }

  // Continue queued combo if in strike cancel window
  if (
    ai.action === 'strike' &&
    ai.currentStrike &&
    ai.aiQueuedCombo.length > 0
  ) {
    const spec = STRIKES[ai.currentStrike];
    const progress = ai.actionTime / Math.max(0.01, ai.actionDuration);
    if (progress >= spec.cancelAt && dist < 1.95) {
      requestedStrike = ai.aiQueuedCombo.shift() ?? null;
    }
  }

  // Initiate new attack or combo
  if (
    ai.action === 'idle' &&
    ai.aiCooldown <= 0 &&
    guard === 'none' &&
    !requestedEvade &&
    dist <= 1.95
  ) {
    const aggroRoll = Math.random();
    if (aggroRoll < 0.75 * diffMult) {
      if (dist > 1.62) {
        const longRange: StrikeId[] =
          archetype === 'legKickBrawler'
            ? ['legKick', 'rearLegKick', 'bodyKick', 'jab']
            : archetype === 'counterSniper'
              ? ['bodyKick', 'headKick', 'jab', 'cross']
              : ['jab', 'bodyKick', 'rearLegKick'];
        requestedStrike =
          longRange[Math.floor(Math.random() * longRange.length)];
        if (requestedStrike === 'jab') {
          ai.aiQueuedCombo = ['cross', 'rearLegKick'];
        }
      } else {
        if (archetype === 'volumeCombo') {
          ai.aiQueuedCombo =
            Math.random() < 0.55
              ? ['cross', 'leadHook', 'rearLegKick']
              : ['cross', 'bodyHook', 'leadHook'];
          requestedStrike = 'jab';
        } else if (archetype === 'pressureBoxer') {
          const openers: StrikeId[] = [
            'jab',
            'leadHook',
            'bodyHook',
            'cross',
            'overhand',
          ];
          requestedStrike =
            openers[Math.floor(Math.random() * openers.length)];
          ai.aiQueuedCombo =
            requestedStrike === 'bodyHook'
              ? ['leadHook', 'overhand']
              : ['rearUppercut', 'leadHook'];
        } else if (archetype === 'legKickBrawler') {
          if (Math.random() < 0.48) {
            requestedStrike = 'rearLegKick';
            ai.aiQueuedCombo = ['jab', 'rearHook'];
          } else {
            requestedStrike = 'jab';
            ai.aiQueuedCombo = ['cross', 'legKick'];
          }
        } else {
          const sniper: StrikeId[] = [
            'cross',
            'headKick',
            'rearUppercut',
            'bodyKick',
            'overhand',
          ];
          requestedStrike = sniper[Math.floor(Math.random() * sniper.length)];
          ai.aiQueuedCombo = ['leadHook'];
        }
      }
      ai.aiCooldown =
        (archetype === 'volumeCombo' ? 0.36 : 0.56) / Math.max(0.75, diffMult);
    }
  }

  return { moveX, moveZ, guard, requestedStrike, requestedEvade };
}

export function stepBout(
  bout: BoutState,
  inputs: [FighterInput, FighterInput],
  rawDt: number,
): CombatEvent[] {
  const events: CombatEvent[] = [];
  const dt = Math.min(rawDt, 0.05);

  if (bout.calloutTimer > 0) {
    bout.calloutTimer = Math.max(0, bout.calloutTimer - dt);
  }
  if (bout.rockedFlashTimer > 0) {
    bout.rockedFlashTimer = Math.max(0, bout.rockedFlashTimer - dt);
  }

  // Hit flash decay runs in real dt even during hitstop
  for (const f of bout.fighters) {
    if (f.hitFlashTimer > 0) {
      f.hitFlashTimer = Math.max(0, f.hitFlashTimer - dt);
    }
    if (f.rockedFlashTimer > 0) {
      f.rockedFlashTimer = Math.max(0, f.rockedFlashTimer - dt);
    }
  }

  // Queue strike presses even during hitstop freeze so the 180ms input buffer never drops combos
  for (let i = 0; i < 2; i++) {
    const req = inputs[i].requestedStrike;
    if (req) {
      bout.fighters[i].queuedStrike = req;
      bout.fighters[i].queuedStrikeTimer = 0.18;
    }
  }

  // Hitstop freeze
  if (bout.hitstopTimer > 0) {
    bout.hitstopTimer = Math.max(0, bout.hitstopTimer - dt);
    return events;
  }

  // If bout already ended (KO celebration / replay slowmo), advance KO animation only
  if (bout.koWinnerIndex !== null) {
    const simDt = dt * (bout.slowMoTimer > 0 ? 0.32 : 1.0);
    if (bout.slowMoTimer > 0) {
      bout.slowMoTimer = Math.max(0, bout.slowMoTimer - dt);
    }
    for (const f of bout.fighters) {
      f.actionTime += simDt;
      f.vx *= Math.exp(-8 * simDt);
      f.vz *= Math.exp(-8 * simDt);
      f.x += f.vx * simDt;
      f.z += f.vz * simDt;
    }
    return events;
  }

  const timeScale = bout.slowMoTimer > 0 ? 0.45 : 1.0;
  if (bout.slowMoTimer > 0) {
    bout.slowMoTimer = Math.max(0, bout.slowMoTimer - dt);
  }
  const simDt = dt * timeScale;

  // Round clock
  bout.roundTimeRemaining = Math.max(0, bout.roundTimeRemaining - simDt);
  if (bout.roundTimeRemaining <= 0) {
    const redDmg = bout.roundDamage[0];
    const blueDmg = bout.roundDamage[1];
    const redPts = redDmg >= blueDmg ? 10 : 9;
    const bluePts = blueDmg > redDmg ? 10 : 9;
    bout.roundScores.push({ red: redPts, blue: bluePts });

    if (bout.round >= bout.maxRounds) {
      const totalRed = bout.roundScores.reduce((acc, r) => acc + r.red, 0);
      const totalBlue = bout.roundScores.reduce((acc, r) => acc + r.blue, 0);
      bout.koWinnerIndex = totalRed >= totalBlue ? 0 : 1;
      bout.koMethod = 'DECISION';
      bout.koFinishTime = '3:00';
      bout.calloutText =
        bout.koWinnerIndex === 0
          ? `${bout.fighters[0].profile.name} WINS BY DECISION`
          : `${bout.fighters[1].profile.name} WINS BY DECISION`;
      bout.calloutTimer = 4.0;
      bout.calloutCorner = bout.koWinnerIndex === 0 ? 'red' : 'blue';
      events.push({
        type: 'roundEnd',
        attackerIndex: bout.koWinnerIndex,
        defenderIndex: bout.koWinnerIndex === 0 ? 1 : 0,
      });
      return events;
    } else {
      bout.round += 1;
      bout.roundTimeRemaining = bout.roundDuration;
      bout.roundDamage = [0, 0];
      for (const f of bout.fighters) {
        f.x = f.index === 0 ? -1.45 : 1.45;
        f.z = 0;
        f.vx = 0;
        f.vz = 0;
        f.action = 'idle';
        f.actionTime = 0;
        f.currentStrike = null;
        f.queuedStrike = null;
        f.queuedStrikeTimer = 0;
        f.counterWindowTimer = 0;
        f.guard = 'none';
        f.stamina = Math.min(f.maxStamina, f.stamina + f.maxStamina * 0.45);
        f.blockHealth = Math.min(f.maxBlockHealth, f.blockHealth + 35);
        f.headHp = Math.min(f.maxHeadHp, f.headHp + 10);
        f.bodyHp = Math.min(f.maxBodyHp, f.bodyHp + 10);
        f.stunMeter = 0;
      }
      bout.calloutText = `ROUND ${bout.round}`;
      bout.calloutTimer = 2.0;
      bout.calloutCorner = 'neutral';
      events.push({
        type: 'roundEnd',
        attackerIndex: 0,
        defenderIndex: 1,
      });
      return events;
    }
  }

  // Update each fighter's facing, actions, movement, stamina
  for (let i = 0; i < 2; i++) {
    const f = bout.fighters[i];
    const opp = bout.fighters[i === 0 ? 1 : 0];
    const input = inputs[i];

    const dx = opp.x - f.x;
    const dz = opp.z - f.z;
    const targetYaw = Math.atan2(dx, dz);

    // Smooth auto-face opponent unless mid-knockdown/KO
    if (f.action !== 'knockdown' && f.action !== 'ko') {
      const yawDiff = normalizeAngle(targetYaw - f.facingYaw);
      const turnRate = f.action === 'strike' ? 4.5 : 10.5;
      f.facingYaw = normalizeAngle(
        f.facingYaw + yawDiff * (1 - Math.exp(-turnRate * simDt)),
      );
    }

    if (f.comboResetTimer > 0) {
      f.comboResetTimer = Math.max(0, f.comboResetTimer - simDt);
      if (f.comboResetTimer === 0) f.comboCount = 0;
    }
    if (f.counterWindowTimer > 0) {
      f.counterWindowTimer = Math.max(0, f.counterWindowTimer - simDt);
    }
    if (f.feintCooldown > 0) {
      f.feintCooldown = Math.max(0, f.feintCooldown - simDt);
    }
    if (f.lungeTimer > 0) {
      f.lungeTimer = Math.max(0, f.lungeTimer - simDt);
    }
    if (f.queuedStrikeTimer > 0) {
      f.queuedStrikeTimer = Math.max(0, f.queuedStrikeTimer - simDt);
      if (f.queuedStrikeTimer === 0) f.queuedStrike = null;
    }

    // Stun decay
    if (f.action !== 'stunned') {
      f.stunMeter = Math.max(0, f.stunMeter - 8 * simDt);
    }

    // Input queueing: buffer newly requested strike for 180ms during active/recovery/evade frames
    if (input.requestedStrike) {
      f.queuedStrike = input.requestedStrike;
      f.queuedStrikeTimer = 0.18;
    }

    // Advance current action timer
    if (f.action !== 'idle') {
      f.actionTime += simDt;
      if (f.action === 'strike' && f.currentStrike) {
        const spec = STRIKES[f.currentStrike];
        const dur = Math.max(0.01, f.actionDuration);
        const totalBase = spec.windup + spec.active + spec.recovery;
        const normWindup = (spec.windup / totalBase) * dur;
        const progress = f.actionTime / dur;

        // Strike Feint / Cancel: tapping RB/R1 or Space mid-windup cancels any strike into a feint!
        if (input.requestedFeint && f.actionTime < normWindup) {
          f.action = 'idle';
          f.actionTime = 0;
          f.actionDuration = 0;
          f.currentStrike = null;
          f.queuedStrike = null;
          f.queuedStrikeTimer = 0;
          f.guard = 'none';
          f.feintCooldown = 0.14;
          f.stamina = Math.min(f.maxStamina, f.stamina + spec.staminaCost * 0.25);
          bout.calloutText = 'FEINT';
          bout.calloutTimer = 0.45;
          bout.calloutCorner = f.index === 0 ? 'red' : 'blue';
          events.push({
            type: 'feint',
            attackerIndex: f.index,
            defenderIndex: opp.index,
            strikeId: spec.id,
          });
        } else if (
          f.queuedStrike &&
          progress >= spec.cancelAt &&
          (spec.comboNext.includes(f.queuedStrike) || progress >= 0.72)
        ) {
          // Seamless combo blending directly from cancel window without resetting to idle
          const nextId = f.queuedStrike;
          if (startStrike(f, nextId, input.moveZ)) {
            events.push({
              type: 'strikeStart',
              attackerIndex: f.index,
              defenderIndex: opp.index,
              strikeId: nextId,
            });
          } else {
            f.queuedStrike = null;
            f.queuedStrikeTimer = 0;
          }
        } else if (f.actionTime >= f.actionDuration) {
          f.action = 'idle';
          f.actionTime = 0;
          f.currentStrike = null;
        }
      } else if (f.action === 'knockdown') {
        if (f.actionTime >= f.actionDuration) {
          f.action = 'idle';
          f.actionTime = 0;
          f.headHp = Math.max(f.headHp, f.maxHeadHp * 0.28);
          f.bodyHp = Math.max(f.bodyHp, f.maxBodyHp * 0.35);
          f.stunMeter = 0;
          f.blockHealth = Math.max(f.blockHealth, 55);
        }
      } else if (
        f.action === 'slipLeft' ||
        f.action === 'slipRight' ||
        f.action === 'pullBack' ||
        f.action === 'duck'
      ) {
        // Support head movement hold by extending peak hold up to 0.58s while Right Stick / Arrow stays held
        const maxHoldDuration = 0.58;
        const holdingSame = input.heldEvade === f.action && f.stamina > 4;
        if (
          holdingSame &&
          f.actionTime >= f.actionDuration * 0.48 &&
          f.actionDuration < maxHoldDuration
        ) {
          f.actionDuration = Math.min(maxHoldDuration, f.actionDuration + simDt * 0.92);
          f.stamina = Math.max(0, f.stamina - 4.5 * simDt);
        }
        if (f.actionTime >= f.actionDuration) {
          f.action = 'idle';
          f.actionTime = 0;
          f.currentStrike = null;
        }
      } else if (f.actionTime >= f.actionDuration) {
        f.action = 'idle';
        f.actionTime = 0;
        f.currentStrike = null;
      }
    }

    // Idle state: handle evades, lunges, queued/fresh strikes, blocking
    if (f.action === 'idle') {
      const nextStrike = f.queuedStrike;
      if (input.requestedEvade && startEvade(f, input.requestedEvade)) {
        // Evade started
      } else if (nextStrike && startStrike(f, nextStrike, input.moveZ)) {
        events.push({
          type: 'strikeStart',
          attackerIndex: f.index,
          defenderIndex: opp.index,
          strikeId: nextStrike,
        });
      } else if (input.requestedLunge && f.lungeTimer <= 0 && f.stamina >= 5) {
        const mag = Math.hypot(input.requestedLunge.x, input.requestedLunge.z) || 1;
        f.lungeDirX = input.requestedLunge.x / mag;
        f.lungeDirZ = input.requestedLunge.z / mag;
        f.lungeTimer = 0.2;
        f.stamina = Math.max(0, f.stamina - 4.8);
        f.guard = 'none';
        events.push({
          type: 'lunge',
          attackerIndex: f.index,
          defenderIndex: opp.index,
        });
      } else {
        f.guard =
          f.blockHealth > 8 && f.feintCooldown <= 0 ? input.guard : 'none';
      }
    } else if (f.action === 'strike' && input.requestedEvade && f.actionTime < 0.09) {
      startEvade(f, input.requestedEvade);
    }

    // Stamina & block regeneration
    const staminaRegenRate =
      f.guard !== 'none'
        ? 6.5
        : f.action === 'idle' && f.lungeTimer <= 0
          ? 16.5 * (0.8 + (f.profile.stats.cardio / 100) * 0.35)
          : 0;
    const bodyFactor = 0.55 + 0.45 * (f.bodyHp / f.maxBodyHp);
    f.stamina = clamp(
      f.stamina + staminaRegenRate * bodyFactor * simDt,
      0,
      f.maxStamina,
    );

    if (f.guard === 'none' && f.action === 'idle') {
      f.blockHealth = clamp(f.blockHealth + 18 * simDt, 0, f.maxBlockHealth);
    }

    // Footwork & directional lunge velocity
    const fwdX = Math.sin(f.facingYaw);
    const fwdZ = Math.cos(f.facingYaw);
    const rightX = Math.cos(f.facingYaw);
    const rightZ = -Math.sin(f.facingYaw);

    const legMobility = 0.6 + 0.4 * (f.legHp / f.maxLegHp);
    const baseMoveSpeed =
      (2.75 + (f.profile.stats.speed - 85) * 0.025) *
      legMobility *
      (f.guard !== 'none' ? 0.56 : 1.0) *
      (f.action === 'stunned' ? 0.48 : 1.0);

    if (f.lungeTimer > 0 && f.action === 'idle') {
      const lungeSpeed = 5.35 * legMobility;
      const targetVx = (fwdX * f.lungeDirZ + rightX * f.lungeDirX) * lungeSpeed;
      const targetVz = (fwdZ * f.lungeDirZ + rightZ * f.lungeDirX) * lungeSpeed;
      const snap = 1 - Math.exp(-24 * simDt);
      f.vx += (targetVx - f.vx) * snap;
      f.vz += (targetVz - f.vz) * snap;
    } else if (f.action === 'idle' || f.action === 'stunned') {
      const targetVx = (fwdX * input.moveZ + rightX * input.moveX) * baseMoveSpeed;
      const targetVz = (fwdZ * input.moveZ + rightZ * input.moveX) * baseMoveSpeed;
      const accel = 1 - Math.exp(-14 * simDt);
      f.vx += (targetVx - f.vx) * accel;
      f.vz += (targetVz - f.vz) * accel;
    } else if (f.action === 'strike' && f.currentStrike) {
      const spec = STRIKES[f.currentStrike];
      const progress = f.actionTime / Math.max(0.01, f.actionDuration);
      const lungeMult =
        progress < 0.44 ? spec.lungeSpeed * f.strikeLungeMult : 0;
      const targetVx = fwdX * lungeMult;
      const targetVz = fwdZ * lungeMult;
      const damp = 1 - Math.exp(-11 * simDt);
      f.vx += (targetVx - f.vx) * damp;
      f.vz += (targetVz - f.vz) * damp;
    } else if (f.action === 'pullBack') {
      const damp = 1 - Math.exp(-10 * simDt);
      f.vx += (-fwdX * 1.45 - f.vx) * damp;
      f.vz += (-fwdZ * 1.45 - f.vz) * damp;
    } else {
      const damp = 1 - Math.exp(-12 * simDt);
      f.vx *= 1 - damp;
      f.vz *= 1 - damp;
    }

    f.x += f.vx * simDt;
    f.z += f.vz * simDt;

    const speed = Math.hypot(f.vx, f.vz);
    f.gaitPhase += speed * 4.2 * simDt;
  }

  // Body collision separation & Octagon boundary clamping
  {
    const a = bout.fighters[0];
    const b = bout.fighters[1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const minSeparation = 0.72;
    if (dist < minSeparation) {
      const overlap = (minSeparation - dist) * 0.5;
      const nx = dx / dist;
      const nz = dz / dist;
      a.x -= nx * overlap;
      a.z -= nz * overlap;
      b.x += nx * overlap;
      b.z += nz * overlap;
    }

    for (const f of bout.fighters) {
      const r = Math.hypot(f.x, f.z);
      const maxR = OCTAGON_RADIUS - 0.55;
      if (r > maxR) {
        const s = maxR / r;
        f.x *= s;
        f.z *= s;
      }
    }
  }

  // Strike hit resolution
  for (let i = 0; i < 2; i++) {
    const atk = bout.fighters[i];
    const def = bout.fighters[i === 0 ? 1 : 0];

    if (
      atk.action !== 'strike' ||
      !atk.currentStrike ||
      atk.strikeHitRegistered ||
      def.action === 'knockdown' ||
      def.action === 'ko'
    ) {
      continue;
    }

    const spec = STRIKES[atk.currentStrike];
    const staminaRatio = atk.stamina / atk.maxStamina;
    const dur = Math.max(0.01, atk.actionDuration);
    const totalBase = spec.windup + spec.active + spec.recovery;
    const normWindup = (spec.windup / totalBase) * dur;
    const normActiveEnd = ((spec.windup + spec.active) / totalBase) * dur;

    if (atk.actionTime < normWindup || atk.actionTime > normActiveEnd) {
      continue;
    }

    // Distance & cone check (including forward lunge reach modifier)
    const dx = def.x - atk.x;
    const dz = def.z - atk.z;
    const dist = Math.hypot(dx, dz);
    const effectiveReach =
      spec.reach * atk.strikeReachMult * (atk.profile.reachMeters / 1.82);

    if (dist > effectiveReach) {
      continue;
    }

    const dirX = dist > 0.001 ? dx / dist : Math.sin(atk.facingYaw);
    const dirZ = dist > 0.001 ? dz / dist : Math.cos(atk.facingYaw);
    const atkFwdX = Math.sin(atk.facingYaw);
    const atkFwdZ = Math.cos(atk.facingYaw);
    const alignment = dirX * atkFwdX + dirZ * atkFwdZ;

    if (alignment < 0.38) {
      continue;
    }

    // Mark strike resolution attempted so it doesn't hit multiple frames
    atk.strikeHitRegistered = true;

    // Head movement evasion check vs directional vulnerability!
    const inEvadeWindow =
      (def.action === 'slipLeft' ||
        def.action === 'slipRight' ||
        def.action === 'pullBack' ||
        def.action === 'duck') &&
      def.actionTime >= 0.02 &&
      def.actionTime <= def.actionDuration * 0.85;

    let cleanEvade = false;
    let caughtLeaning = false;

    if (inEvadeWindow) {
      if (def.action === 'duck') {
        if (
          spec.id === 'jab' ||
          spec.id === 'cross' ||
          spec.id === 'leadHook' ||
          spec.id === 'rearHook' ||
          spec.id === 'overhand' ||
          spec.id === 'leadHeadKick' ||
          spec.id === 'headKick' ||
          spec.id === 'spinningBackfist'
        ) {
          cleanEvade = true;
        } else if (
          spec.id === 'leadUppercut' ||
          spec.id === 'rearUppercut' ||
          spec.zone === 'body'
        ) {
          caughtLeaning = true;
        }
      } else if (def.action === 'slipLeft') {
        if (spec.id === 'jab' || spec.id === 'cross') {
          cleanEvade = true;
        } else if (
          !spec.isLeadSide &&
          (spec.id === 'rearHook' ||
            spec.id === 'overhand' ||
            spec.id === 'headKick')
        ) {
          caughtLeaning = true;
        } else if (spec.zone === 'head' && !spec.isKick) {
          cleanEvade = true;
        }
      } else if (def.action === 'slipRight') {
        if (spec.id === 'jab' || spec.id === 'cross') {
          cleanEvade = true;
        } else if (
          spec.isLeadSide &&
          (spec.id === 'leadHook' || spec.id === 'leadHeadKick')
        ) {
          caughtLeaning = true;
        } else if (spec.zone === 'head' && !spec.isKick) {
          cleanEvade = true;
        }
      } else if (def.action === 'pullBack') {
        if (spec.zone === 'head' && dist > effectiveReach * 0.66) {
          cleanEvade = true;
        } else if (spec.id === 'headKick' || spec.id === 'overhand') {
          caughtLeaning = true;
        }
      }
    }

    if (cleanEvade) {
      // Clean head-movement evasion! Opens a 0.3s Pull-Counter window!
      atk.stamina = Math.max(0, atk.stamina - spec.staminaCost * 0.35);
      def.counterWindowTimer = 0.3;
      events.push({
        type: 'evaded',
        attackerIndex: atk.index,
        defenderIndex: def.index,
        strikeId: spec.id,
        zone: spec.zone,
      });
      bout.calloutText =
        def.action === 'pullBack'
          ? 'PULL'
          : def.action === 'duck'
            ? 'DUCK'
            : 'SLIP';
      bout.calloutTimer = 0.65;
      bout.calloutCorner = def.index === 0 ? 'red' : 'blue';
      continue;
    }

    // Check blocking
    const isProperBlock =
      (spec.zone === 'head' && def.guard === 'high') ||
      ((spec.zone === 'body' || spec.zone === 'leg') && def.guard === 'low');

    const hitY =
      spec.zone === 'head' ? 1.54 : spec.zone === 'body' ? 1.12 : 0.62;
    const hitPos = {
      x: def.x - dirX * 0.16,
      y: hitY,
      z: def.z - dirZ * 0.16,
    };

    if (isProperBlock && def.blockHealth > 4 && !caughtLeaning) {
      const chip = spec.blockChip * (0.9 + atk.profile.stats.power / 200);
      if (spec.zone === 'head') def.headHp = Math.max(1, def.headHp - chip);
      else if (spec.zone === 'body') def.bodyHp = Math.max(1, def.bodyHp - chip);
      else def.legHp = Math.max(1, def.legHp - chip);

      def.blockHealth = Math.max(0, def.blockHealth - spec.blockDrain);
      def.vx += dirX * spec.knockback * 0.45;
      def.vz += dirZ * spec.knockback * 0.45;
      atk.stamina = Math.max(0, atk.stamina - spec.staminaCost * 0.25);

      events.push({
        type: 'blocked',
        attackerIndex: atk.index,
        defenderIndex: def.index,
        strikeId: spec.id,
        zone: spec.zone,
        damage: chip,
        hitPosition: hitPos,
      });
      continue;
    }

    // CLEAN HIT! Calculate power, pull-counter boost, vulnerability / caught-leaning bonus
    const wasDefStriking = def.action === 'strike';
    const wasDefLunging = def.lungeTimer > 0;
    const isVulnerabilityHit =
      wasDefStriking || caughtLeaning || wasDefLunging || atk.isCounterStrike;
    const isGuardMistake =
      def.action === 'stunned' ||
      (def.guard === 'high' && spec.zone !== 'head') ||
      (def.guard === 'low' && spec.zone === 'head');

    const rating = spec.isKick
      ? atk.profile.stats.kickPower
      : atk.profile.stats.power;
    const powerScale = 0.78 + (rating - 75) * 0.016;
    const counterMult = isVulnerabilityHit
      ? 1.45
      : isGuardMistake
        ? 1.15
        : 1.0;
    const fatigueMult = staminaRatio < 0.2 ? 0.78 : 1.0;
    const dmg =
      spec.baseDamage *
      powerScale *
      counterMult *
      atk.strikePowerMult *
      fatigueMult;

    if (spec.zone === 'head') {
      def.headHp = Math.max(0, def.headHp - dmg);
    } else if (spec.zone === 'body') {
      def.bodyHp = Math.max(0, def.bodyHp - dmg);
      def.stamina = Math.max(0, def.stamina - dmg * 0.55);
    } else {
      def.legHp = Math.max(0, def.legHp - dmg);
    }

    atk.strikesLanded += 1;
    if (spec.zone === 'head') atk.headLanded += 1;
    else if (spec.zone === 'body') atk.bodyLanded += 1;
    else atk.legLanded += 1;
    if (isVulnerabilityHit) atk.countersLanded += 1;

    atk.comboCount += 1;
    atk.comboResetTimer = 1.15;

    bout.roundDamage[atk.index] += dmg;
    const momentumDelta = (dmg / 45) * (atk.index === 0 ? -1 : 1);
    bout.momentum = clamp(bout.momentum + momentumDelta, -1, 1);

    def.hitFlashTimer = 0.065;
    def.lungeTimer = 0;
    def.vx += dirX * spec.knockback * (isVulnerabilityHit ? 1.42 : 1.0);
    def.vz += dirZ * spec.knockback * (isVulnerabilityHit ? 1.42 : 1.0);

    const stunAdd =
      spec.stunPower * (isVulnerabilityHit ? 1.65 : 1.0) +
      (caughtLeaning ? 16 : wasDefStriking ? 10 : 0);
    def.stunMeter += stunAdd;

    const isHeavy = dmg >= 14 || isVulnerabilityHit;
    // 2–3 frame crisp hit-stop (~0.048s) whenever opponent is caught mid-swing or leaning into punch
    const vulnHitstop = isVulnerabilityHit ? 0.048 : 0;
    bout.hitstopTimer = Math.max(
      bout.hitstopTimer,
      vulnHitstop,
      spec.hitstop * (isVulnerabilityHit ? 1.3 : 1.0),
    );

    // Check KO / Knockdown!
    const lethal =
      def.headHp <= 0 || def.bodyHp <= 0 || def.legHp <= 0;

    if (lethal) {
      def.knockdowns += 1;
      if (def.knockdowns >= 2 || def.headHp <= 0 || def.stunMeter >= 45) {
        def.action = 'ko';
        def.actionTime = 0;
        def.actionDuration = 3.0;
        def.currentStrike = null;
        def.guard = 'none';
        bout.koWinnerIndex = atk.index;
        bout.koMethod = def.headHp <= 0 ? 'KO' : 'TKO';
        const elapsed = bout.roundDuration - bout.roundTimeRemaining;
        bout.koFinishTime = `R${bout.round} · ${formatFightClock(elapsed)}`;
        bout.slowMoTimer = 1.65;
        bout.hitstopTimer = 0.085;
        bout.calloutText = def.headHp <= 0 ? 'KNOCKOUT!' : 'TKO!';
        bout.calloutTimer = 4.0;
        bout.calloutCorner = atk.index === 0 ? 'red' : 'blue';

        events.push({
          type: 'hit',
          attackerIndex: atk.index,
          defenderIndex: def.index,
          strikeId: spec.id,
          zone: spec.zone,
          damage: dmg,
          isCounter: isVulnerabilityHit,
          isHeavy: true,
          hitPosition: hitPos,
        });
        events.push({
          type: 'ko',
          attackerIndex: atk.index,
          defenderIndex: def.index,
          strikeId: spec.id,
          zone: spec.zone,
          hitPosition: hitPos,
        });
        return events;
      } else {
        def.action = 'knockdown';
        def.actionTime = 0;
        def.actionDuration = 1.45;
        def.currentStrike = null;
        def.guard = 'none';
        bout.slowMoTimer = 0.55;
        bout.calloutText = 'KNOCKDOWN!';
        bout.calloutTimer = 1.3;
        bout.calloutCorner = atk.index === 0 ? 'red' : 'blue';

        events.push({
          type: 'knockdown',
          attackerIndex: atk.index,
          defenderIndex: def.index,
          strikeId: spec.id,
          zone: spec.zone,
          damage: dmg,
          isHeavy: true,
          hitPosition: hitPos,
        });
        continue;
      }
    }

    // Stunned / Rocked stumble reaction (vulnerability catch accelerates rocked stun threshold)
    const stunThreshold = isVulnerabilityHit ? 32 : 38;
    const forceRocked =
      caughtLeaning && dmg >= 18;

    if ((def.stunMeter >= stunThreshold || forceRocked) && def.action !== 'stunned') {
      def.action = 'stunned';
      def.actionTime = 0;
      def.actionDuration = 1.85;
      def.currentStrike = null;
      def.queuedStrike = null;
      def.queuedStrikeTimer = 0;
      def.stunMeter = 12;
      def.rockedFlashTimer = 2.35;
      bout.rockedFlashTimer = 2.35;
      bout.calloutText = 'ROCKED!';
      bout.calloutTimer = 1.65;
      bout.calloutCorner = atk.index === 0 ? 'red' : 'blue';
      events.push({
        type: 'stunned',
        attackerIndex: atk.index,
        defenderIndex: def.index,
        strikeId: spec.id,
        zone: spec.zone,
        hitPosition: hitPos,
      });
    } else if (def.action !== 'stunned') {
      if (isHeavy || def.action === 'idle' || caughtLeaning) {
        def.action = 'hitReact';
        def.actionTime = 0;
        def.actionDuration = isHeavy ? 0.28 : 0.19;
        def.currentStrike = null;
        def.hitReactZone = spec.zone;
        def.hitReactIntensity = isHeavy ? 1.0 : 0.65;
      }
    }

    if (isVulnerabilityHit && def.action !== 'stunned') {
      bout.calloutText = atk.isCounterStrike
        ? 'PULL COUNTER!'
        : caughtLeaning
          ? 'CAUGHT LEANING!'
          : 'COUNTER';
      bout.calloutTimer = 0.78;
      bout.calloutCorner = atk.index === 0 ? 'red' : 'blue';
    }

    events.push({
      type: 'hit',
      attackerIndex: atk.index,
      defenderIndex: def.index,
      strikeId: spec.id,
      zone: spec.zone,
      damage: dmg,
      isCounter: isVulnerabilityHit,
      isHeavy,
      hitPosition: hitPos,
    });
  }

  return events;
}
