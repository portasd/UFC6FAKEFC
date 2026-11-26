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

export type DifficultyLevel =
  | 'rookie'
  | 'pro'
  | 'champion'
  | 'hallOfFamer'
  | 'legend';

export interface DifficultyConfig {
  id: DifficultyLevel;
  label: string;
  shortLabel: string;
  diffMult: number;
  evadeSkill: number;
  feintRate: number;
  comboMax: number;
  cooldownScale: number;
}

export const DIFFICULTY_LEVELS: Record<DifficultyLevel, DifficultyConfig> = {
  rookie: {
    id: 'rookie',
    label: 'Rookie',
    shortLabel: 'RKE',
    diffMult: 0.52,
    evadeSkill: 0.08,
    feintRate: 0.04,
    comboMax: 1,
    cooldownScale: 1.48,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    shortLabel: 'PRO',
    diffMult: 0.76,
    evadeSkill: 0.24,
    feintRate: 0.12,
    comboMax: 2,
    cooldownScale: 1.18,
  },
  champion: {
    id: 'champion',
    label: 'Champion',
    shortLabel: 'CMP',
    diffMult: 1.0,
    evadeSkill: 0.42,
    feintRate: 0.2,
    comboMax: 3,
    cooldownScale: 1.0,
  },
  hallOfFamer: {
    id: 'hallOfFamer',
    label: 'Hall of Famer',
    shortLabel: 'HOF',
    diffMult: 1.18,
    evadeSkill: 0.62,
    feintRate: 0.34,
    comboMax: 3,
    cooldownScale: 0.85,
  },
  legend: {
    id: 'legend',
    label: 'Legend',
    shortLabel: 'LEG',
    diffMult: 1.38,
    evadeSkill: 0.8,
    feintRate: 0.48,
    comboMax: 4,
    cooldownScale: 0.72,
  },
};

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
  cutSeverity?: number;
  hitPosition?: { x: number; y: number; z: number };
}

export type GameplayMode = 'arcade' | 'simulation';

export type ArenaType = 'octagon' | 'boxingRing' | 'backyard';

export type KoStyle = 'backward' | 'crumple' | 'twisted';

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
  prevActionTime: number;
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
  hitReactSide: -1 | 0 | 1;
  hitReactIntensity: number;
  useUppercutReact: boolean;
  koStyle: KoStyle;
  hitFlashTimer: number;
  rockedFlashTimer: number;
  headCutSeverity: number;
  bodyBruiseSeverity: number;
  bleedSide: -1 | 0 | 1;
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
  difficulty: DifficultyLevel;
  simulationMode: boolean;
  arena: ArenaType;
  calloutText: string;
  calloutTimer: number;
  calloutCorner: 'red' | 'blue' | 'neutral';
  roundScores: Array<{ red: number; blue: number }>;
  roundDamage: [number, number];
}

export const OCTAGON_RADIUS = 7.4;
export const BOXING_RING_HALF_SIZE = 4.5;
export const BACKYARD_HALF_SIZE = 4.6;

export interface CardioProfile {
  cardioNorm: number;
  maxStamina: number;
  strikeDrainMult: number;
  evadeDrainMult: number;
  whiffTaxFraction: number;
  regenMult: number;
  roundRecoveryFraction: number;
  bodyDamageStamMult: number;
  maxStaminaFloorRatio: number;
  cumulativeDrainPerCost: number;
}

export function getCardioProfile(
  cardio: number,
  simulationMode: boolean,
): CardioProfile {
  const cardioNorm = clamp((cardio - 88) / 11, -1.15, 1.0);
  if (!simulationMode) {
    // Arcade mode: zero fatigue penalties, zero whiff tax, zero ceiling drain, uniform fast recovery
    return {
      cardioNorm: 0,
      maxStamina: 100,
      strikeDrainMult: 1.0,
      evadeDrainMult: 1.0,
      whiffTaxFraction: 0,
      regenMult: 1.0,
      roundRecoveryFraction: 0.8,
      bodyDamageStamMult: 0,
      maxStaminaFloorRatio: 1.0,
      cumulativeDrainPerCost: 0,
    };
  }
  return {
    cardioNorm,
    maxStamina: 100 + (cardio - 85) * 1.45,
    strikeDrainMult: 1 - cardioNorm * 0.27,
    evadeDrainMult: 1 - cardioNorm * 0.24,
    whiffTaxFraction: 0.36 * (1 - cardioNorm * 0.35),
    regenMult: 1 + cardioNorm * 0.36,
    roundRecoveryFraction: 0.42 + cardioNorm * 0.14,
    bodyDamageStamMult: 1 - cardioNorm * 0.22,
    maxStaminaFloorRatio: 0.62 + cardioNorm * 0.1,
    cumulativeDrainPerCost: 0.075 * (1 - cardioNorm * 0.32),
  };
}

function spendStamina(
  f: FighterState,
  amount: number,
  cardioProf: CardioProfile,
): void {
  const actualCost = Math.max(0, amount);
  f.stamina = Math.max(0, f.stamina - actualCost);
  if (cardioProf.cumulativeDrainPerCost > 0) {
    const floor = cardioProf.maxStamina * cardioProf.maxStaminaFloorRatio;
    f.maxStamina = Math.max(
      floor,
      f.maxStamina - actualCost * cardioProf.cumulativeDrainPerCost,
    );
    f.stamina = Math.min(f.stamina, f.maxStamina);
  }
}

export function createFighterState(
  index: 0 | 1,
  profile: FighterProfile,
  simulationMode = false,
): FighterState {
  const startX = index === 0 ? -2.45 : 2.45;
  const facingYaw = index === 0 ? Math.PI / 2 : -Math.PI / 2;
  const simVitalityMult = simulationMode ? 1.5 : 1.0;
  const maxHead = (100 + (profile.stats.chin - 85) * 1.1) * simVitalityMult;
  const maxBody = (100 + (profile.stats.cardio - 85) * 0.8) * simVitalityMult;
  const maxLeg = 100 + (profile.stats.chin - 85) * 0.6;
  const maxStam = getCardioProfile(profile.stats.cardio, simulationMode).maxStamina;

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
    prevActionTime: 0,
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
    hitReactSide: 0,
    hitReactIntensity: 0,
    useUppercutReact: false,
    koStyle: 'backward',
    hitFlashTimer: 0,
    rockedFlashTimer: 0,
    headCutSeverity: 0,
    bodyBruiseSeverity: 0,
    bleedSide: 0,
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
  difficulty: DifficultyLevel = 'champion',
  simulationMode = false,
  arena: ArenaType = 'octagon',
  maxRounds = 3,
): BoutState {
  return {
    fighters: [
      createFighterState(0, redProfile, simulationMode),
      createFighterState(1, blueProfile, simulationMode),
    ],
    round: 1,
    maxRounds,
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
    simulationMode,
    arena,
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
  simulationMode = false,
): boolean {
  const spec = STRIKES[strikeId];
  const cardioProf = getCardioProfile(f.profile.stats.cardio, simulationMode);
  const strikeCost = spec.staminaCost * 0.55 * cardioProf.strikeDrainMult;
  const minStam = strikeCost * 0.78;
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
    lungeMult = 1.32;
    reachMult = 1.05;
    powerMult = 1.16;
  } else if (steppingBackward) {
    // Moving backward fires quick check-hooks and counter-jabs on the back foot
    extraSpeed = 1.18;
    lungeMult = -0.55;
    reachMult = 0.95;
  }

  if (isCounterWindow) {
    extraSpeed *= 1.24;
    powerMult *= 1.42;
    f.counterWindowTimer = 0;
  }

  const staminaRatio = f.stamina / Math.max(1, f.maxStamina);
  const dur = getStrikeDuration(
    spec,
    f.profile.stats.speed,
    staminaRatio,
    extraSpeed,
    simulationMode,
  );
  f.action = 'strike';
  f.actionTime = 0;
  f.prevActionTime = 0;
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
  spendStamina(f, strikeCost, cardioProf);
  return true;
}

export function startEvade(
  f: FighterState,
  evadeType: EvadeType,
  simulationMode = false,
): boolean {
  const cardioProf = getCardioProfile(f.profile.stats.cardio, simulationMode);
  const evadeCost = 6.0 * cardioProf.evadeDrainMult;
  if (f.stamina < Math.max(4.5, evadeCost * 0.85)) return false;
  if (
    f.action !== 'idle' &&
    !(f.action === 'strike' && f.actionTime < 0.11)
  ) {
    return false;
  }
  f.action = evadeType;
  f.actionTime = 0;
  f.prevActionTime = 0;
  f.actionDuration =
    evadeType === 'pullBack' ? 0.33 : evadeType === 'duck' ? 0.31 : 0.29;
  f.currentStrike = null;
  f.queuedStrike = null;
  f.queuedStrikeTimer = 0;
  f.guard = 'none';
  f.lungeTimer = 0;
  spendStamina(f, evadeCost, cardioProf);
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

  const diffCfg = DIFFICULTY_LEVELS[bout.difficulty] ?? DIFFICULTY_LEVELS.champion;
  const diffMult = diffCfg.diffMult;
  const paceScale = bout.simulationMode ? 0.78 : 0.83;
  const aiDt = dt * paceScale;

  ai.aiThinkTimer -= aiDt;
  ai.aiCooldown = Math.max(0, ai.aiCooldown - aiDt);

  const archetype: AiArchetype = ai.profile.aiArchetype;

  if (ai.aiThinkTimer <= 0) {
    ai.aiThinkTimer = 0.2 + Math.random() * (0.38 / Math.max(0.55, diffMult));
    if (Math.random() < 0.45) {
      ai.aiStrafeDir = Math.random() < 0.5 ? -1 : 1;
    }
    if (archetype === 'counterSniper') {
      ai.aiDesiredRange = 1.24;
    } else if (archetype === 'legKickBrawler') {
      ai.aiDesiredRange = 1.18;
    } else if (archetype === 'pressureBoxer') {
      ai.aiDesiredRange = 0.95;
    } else {
      ai.aiDesiredRange = 1.06;
    }
  }

  let moveZ = 0;
  let moveX = ai.aiStrafeDir * 0.45 * Math.min(1.15, diffMult);
  let guard: GuardMode = 'none';
  let requestedStrike: StrikeId | null = null;
  let requestedEvade: EvadeType | null = null;
  let requestedFeint = false;

  if (bout.simulationMode) {
    const lowStamThresh = ai.profile.stats.cardio < 85 ? 0.32 : 0.25;
    if (ai.stamina < ai.maxStamina * lowStamThresh) {
      moveZ = -0.8;
      guard = 'high';
      return { moveX, moveZ, guard, requestedStrike, requestedEvade, requestedFeint };
    }
  }

  if (dist > ai.aiDesiredRange + 0.14) {
    moveZ = archetype === 'pressureBoxer' ? 0.95 : 0.78;
  } else if (dist < ai.aiDesiredRange - 0.2) {
    moveZ = archetype === 'counterSniper' ? -0.85 : -0.45;
  }

  // Defensive reaction when opponent is actively striking
  if (opp.action === 'strike' && opp.currentStrike && dist < 1.56) {
    const oppSpec = STRIKES[opp.currentStrike];
    const reactChance = Math.min(
      0.94,
      (archetype === 'counterSniper' ? 0.72 : 0.52) * diffMult,
    );
    if (ai.action === 'idle' && Math.random() < reactChance) {
      if (oppSpec.zone === 'head' && Math.random() < diffCfg.evadeSkill) {
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
  if (
    ai.action === 'idle' &&
    ai.counterWindowTimer > 0 &&
    dist < 1.38 &&
    Math.random() < Math.min(0.95, 0.35 + diffCfg.evadeSkill)
  ) {
    requestedStrike = Math.random() < 0.5 ? 'cross' : 'leadHook';
    return { moveX, moveZ, guard, requestedStrike, requestedEvade, requestedFeint };
  }

  // High-difficulty strike feints mid-windup to bait opponent guard
  if (
    ai.action === 'strike' &&
    ai.currentStrike &&
    ai.actionTime > 0.04 &&
    ai.actionTime < 0.11 &&
    opp.guard !== 'none' &&
    ai.feintCooldown <= 0 &&
    Math.random() < diffCfg.feintRate * dt * 10
  ) {
    requestedFeint = true;
    ai.aiQueuedCombo = opp.guard === 'high' ? ['bodyHook', 'leadHook'] : ['headKick'];
    return { moveX, moveZ, guard, requestedStrike, requestedEvade, requestedFeint };
  }

  // Continue queued combo if in strike cancel window
  if (
    ai.action === 'strike' &&
    ai.currentStrike &&
    ai.aiQueuedCombo.length > 0
  ) {
    const spec = STRIKES[ai.currentStrike];
    const progress = ai.actionTime / Math.max(0.01, ai.actionDuration);
    if (progress >= spec.cancelAt && dist < 1.42) {
      requestedStrike = ai.aiQueuedCombo.shift() ?? null;
    }
  }

  // Initiate new attack or combo
  if (
    ai.action === 'idle' &&
    ai.aiCooldown <= 0 &&
    guard === 'none' &&
    !requestedEvade &&
    dist <= 1.48
  ) {
    const aggroRoll = Math.random();
    if (aggroRoll < Math.min(0.96, 0.72 * diffMult)) {
      let plannedFollowups: StrikeId[] = [];
      if (dist > 1.18) {
        const longRange: StrikeId[] =
          archetype === 'legKickBrawler'
            ? ['legKick', 'rearLegKick', 'bodyKick', 'jab']
            : archetype === 'counterSniper'
              ? ['bodyKick', 'headKick', 'jab', 'cross']
              : ['jab', 'bodyKick', 'rearLegKick'];
        requestedStrike =
          longRange[Math.floor(Math.random() * longRange.length)];
        if (requestedStrike === 'jab') {
          plannedFollowups = ['cross', 'rearLegKick'];
        }
      } else {
        if (archetype === 'volumeCombo') {
          plannedFollowups =
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
          plannedFollowups =
            requestedStrike === 'bodyHook'
              ? ['leadHook', 'overhand']
              : ['rearUppercut', 'leadHook'];
        } else if (archetype === 'legKickBrawler') {
          if (Math.random() < 0.48) {
            requestedStrike = 'rearLegKick';
            plannedFollowups = ['jab', 'rearHook'];
          } else {
            requestedStrike = 'jab';
            plannedFollowups = ['cross', 'legKick'];
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
          plannedFollowups = ['leadHook'];
        }
      }
      ai.aiQueuedCombo = plannedFollowups.slice(
        0,
        Math.max(0, diffCfg.comboMax - 1),
      );
      ai.aiCooldown =
        (archetype === 'volumeCombo' ? 0.36 : 0.56) * diffCfg.cooldownScale;
    }
  }

  return { moveX, moveZ, guard, requestedStrike, requestedEvade, requestedFeint };
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

  // Queue strike presses even during hitstop freeze so the input buffer never drops combos
  for (let i = 0; i < 2; i++) {
    const req = inputs[i].requestedStrike;
    if (req) {
      bout.fighters[i].queuedStrike = req;
      bout.fighters[i].queuedStrikeTimer = 0.26;
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

  const simPaceScale = bout.simulationMode ? 0.78 : 0.83;
  const timeScale = (bout.slowMoTimer > 0 ? 0.45 : 1.0) * simPaceScale;
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
        f.x = f.index === 0 ? -2.45 : 2.45;
        f.z = 0;
        f.vx = 0;
        f.vz = 0;
        f.action = 'idle';
        f.actionTime = 0;
        f.prevActionTime = 0;
        f.currentStrike = null;
        f.queuedStrike = null;
        f.queuedStrikeTimer = 0;
        f.counterWindowTimer = 0;
        f.useUppercutReact = false;
        f.guard = 'none';
        const roundCardio = getCardioProfile(
          f.profile.stats.cardio,
          bout.simulationMode,
        );
        f.stamina = Math.min(
          f.maxStamina,
          f.stamina + f.maxStamina * roundCardio.roundRecoveryFraction,
        );
        f.blockHealth = Math.min(f.maxBlockHealth, f.blockHealth + 35);
        f.headHp = Math.min(f.maxHeadHp, f.headHp + (bout.simulationMode ? 14 : 10));
        f.bodyHp = Math.min(f.maxBodyHp, f.bodyHp + (bout.simulationMode ? 14 : 10));
        f.headCutSeverity = f.headCutSeverity * 0.85;
        f.bodyBruiseSeverity = f.bodyBruiseSeverity * 0.9;
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
    const cardioProf = getCardioProfile(f.profile.stats.cardio, bout.simulationMode);

    const dx = opp.x - f.x;
    const dz = opp.z - f.z;
    const targetYaw = Math.atan2(dx, dz);

    // Smooth auto-face opponent unless mid-knockdown/KO (responsive tracking during footwork & windup)
    if (f.action !== 'knockdown' && f.action !== 'ko') {
      const yawDiff = normalizeAngle(targetYaw - f.facingYaw);
      const strikeProgress =
        f.action === 'strike' && f.actionDuration > 0
          ? f.actionTime / f.actionDuration
          : 1;
      const turnRate =
        f.action === 'strike' ? (strikeProgress < 0.35 ? 9.5 : 5.0) : 12.5;
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

    // Input queueing: buffer newly requested strike for 260ms during active/recovery/evade frames
    if (input.requestedStrike) {
      f.queuedStrike = input.requestedStrike;
      f.queuedStrikeTimer = 0.26;
    }

    // Advance current action timer (record prevActionTime for swept hit detection)
    f.prevActionTime = f.actionTime;
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
          (spec.comboNext.includes(f.queuedStrike) || progress >= 0.65)
        ) {
          // Whiff tax on missed strike if chaining late recovery without landing
          if (!f.strikeHitRegistered && f.actionTime > normWindup) {
            spendStamina(
              f,
              spec.staminaCost * cardioProf.whiffTaxFraction,
              cardioProf,
            );
          }
          // Seamless combo blending directly from cancel window without resetting to idle
          const nextId = f.queuedStrike;
          if (startStrike(f, nextId, input.moveZ, bout.simulationMode)) {
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
        } else if (
          input.guard !== 'none' &&
          !f.queuedStrike &&
          progress >= 0.76
        ) {
          // Responsive defensive block cancel out of late strike recovery
          f.action = 'idle';
          f.actionTime = 0;
          f.currentStrike = null;
          f.useUppercutReact = false;
        } else if (f.actionTime >= f.actionDuration) {
          if (!f.strikeHitRegistered && cardioProf.whiffTaxFraction > 0) {
            spendStamina(
              f,
              spec.staminaCost * cardioProf.whiffTaxFraction,
              cardioProf,
            );
          }
          f.action = 'idle';
          f.actionTime = 0;
          f.currentStrike = null;
          f.useUppercutReact = false;
        }
      } else if (f.action === 'knockdown') {
        if (f.actionTime >= f.actionDuration) {
          f.action = 'idle';
          f.actionTime = 0;
          f.useUppercutReact = false;
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
          spendStamina(f, 4.5 * cardioProf.evadeDrainMult * simDt, cardioProf);
        }
        // Fluid evade-to-counter strike chain once past peak displacement
        if (
          f.queuedStrike &&
          f.actionTime >= f.actionDuration * 0.72 &&
          startStrike(f, f.queuedStrike, input.moveZ, bout.simulationMode)
        ) {
          events.push({
            type: 'strikeStart',
            attackerIndex: f.index,
            defenderIndex: opp.index,
            strikeId: f.currentStrike!,
          });
        } else if (f.actionTime >= f.actionDuration) {
          f.action = 'idle';
          f.actionTime = 0;
          f.currentStrike = null;
          f.useUppercutReact = false;
        }
      } else if (f.actionTime >= f.actionDuration) {
        f.action = 'idle';
        f.actionTime = 0;
        f.currentStrike = null;
        f.useUppercutReact = false;
      }
    }

    // Idle state: handle evades, lunges, queued/fresh strikes, blocking
    if (f.action === 'idle') {
      const nextStrike = f.queuedStrike;
      if (
        input.requestedEvade &&
        startEvade(f, input.requestedEvade, bout.simulationMode)
      ) {
        // Evade started
      } else if (
        nextStrike &&
        startStrike(f, nextStrike, input.moveZ, bout.simulationMode)
      ) {
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
        spendStamina(f, 4.8 * cardioProf.evadeDrainMult, cardioProf);
        f.guard = 'none';
        events.push({
          type: 'lunge',
          attackerIndex: f.index,
          defenderIndex: opp.index,
        });
      } else {
        // Keep guard raised whenever block is held (even if blockHealth is low/empty)
        f.guard = f.feintCooldown <= 0 ? input.guard : 'none';
      }
    } else if (f.action === 'stunned' || f.action === 'hitReact') {
      // Allow raising, switching, or holding high/low guard while rocked or reacting to strikes
      f.guard = f.feintCooldown <= 0 ? input.guard : 'none';
    } else if (f.action === 'strike' && input.requestedEvade && f.actionTime < 0.11) {
      startEvade(f, input.requestedEvade, bout.simulationMode);
    }

    // Stamina & block regeneration (no fatigue in Arcade; realistic cardio & body-wear in Simulation)
    const simStaminaRegenMult = bout.simulationMode ? 0.64 : 1.0;
    const guardRegenBase = bout.simulationMode ? 5.2 : 11.5;
    const idleRegenBase = bout.simulationMode ? 16.5 : 22.0;
    const staminaRegenRate =
      (f.guard !== 'none'
        ? guardRegenBase * cardioProf.regenMult
        : f.action === 'idle' && f.lungeTimer <= 0
          ? idleRegenBase * cardioProf.regenMult
          : 0) * simStaminaRegenMult;
    const bodyFactor = bout.simulationMode
      ? 0.55 + 0.45 * (f.bodyHp / f.maxBodyHp)
      : 1.0;
    f.stamina = clamp(
      f.stamina + staminaRegenRate * bodyFactor * simDt,
      0,
      f.maxStamina,
    );

    if (f.guard === 'none' && (f.action === 'idle' || f.action === 'stunned')) {
      const blockRegenRate = f.action === 'stunned' ? 12 : 21;
      f.blockHealth = clamp(
        f.blockHealth + blockRegenRate * simDt,
        0,
        f.maxBlockHealth,
      );
    }

    // Footwork & directional lunge velocity (fluid weight transfer; fatigue affects low-gas mobility in Simulation)
    const fwdX = Math.sin(f.facingYaw);
    const fwdZ = Math.cos(f.facingYaw);
    const rightX = Math.cos(f.facingYaw);
    const rightZ = -Math.sin(f.facingYaw);

    const stamRatioNow = f.stamina / Math.max(1, f.maxStamina);
    const simFatigueMoveMult =
      bout.simulationMode && stamRatioNow < 0.3
        ? 0.84 + 0.16 * (stamRatioNow / 0.3)
        : 1.0;
    const legMobility = 0.6 + 0.4 * (f.legHp / f.maxLegHp);
    const simMoveMult = bout.simulationMode ? 0.96 : 1.0;
    const baseMoveSpeed =
      (1.48 + (f.profile.stats.speed - 85) * 0.012) *
      legMobility *
      simMoveMult *
      simFatigueMoveMult *
      (f.guard !== 'none' ? 0.56 : 1.0) *
      (f.action === 'stunned' ? 0.48 : 1.0);

    if (f.lungeTimer > 0 && f.action === 'idle') {
      const lungeSpeed = 3.35 * legMobility * simMoveMult * simFatigueMoveMult;
      const targetVx = (fwdX * f.lungeDirZ + rightX * f.lungeDirX) * lungeSpeed;
      const targetVz = (fwdZ * f.lungeDirZ + rightZ * f.lungeDirX) * lungeSpeed;
      const snap = 1 - Math.exp(-22 * simDt);
      f.vx += (targetVx - f.vx) * snap;
      f.vz += (targetVz - f.vz) * snap;
    } else if (f.action === 'idle' || f.action === 'stunned') {
      const targetVx = (fwdX * input.moveZ + rightX * input.moveX) * baseMoveSpeed;
      const targetVz = (fwdZ * input.moveZ + rightZ * input.moveX) * baseMoveSpeed;
      const accel = 1 - Math.exp(-15 * simDt);
      f.vx += (targetVx - f.vx) * accel;
      f.vz += (targetVz - f.vz) * accel;
    } else if (f.action === 'strike' && f.currentStrike) {
      const spec = STRIKES[f.currentStrike];
      const progress = f.actionTime / Math.max(0.01, f.actionDuration);
      const lungeMult =
        progress < 0.44 ? spec.lungeSpeed * f.strikeLungeMult : 0;
      const targetVx = fwdX * lungeMult;
      const targetVz = fwdZ * lungeMult;
      const damp = 1 - Math.exp(-13 * simDt);
      f.vx += (targetVx - f.vx) * damp;
      f.vz += (targetVz - f.vz) * damp;
    } else if (f.action === 'pullBack') {
      const damp = 1 - Math.exp(-12 * simDt);
      f.vx += (-fwdX * 1.08 - f.vx) * damp;
      f.vz += (-fwdZ * 1.08 - f.vz) * damp;
    } else {
      const damp = 1 - Math.exp(-14 * simDt);
      f.vx *= 1 - damp;
      f.vz *= 1 - damp;
    }

    f.x += f.vx * simDt;
    f.z += f.vz * simDt;

    const speed = Math.hypot(f.vx, f.vz);
    f.gaitPhase += speed * 4.8 * simDt;
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

    if (bout.arena === 'boxingRing' || bout.arena === 'backyard') {
      const half =
        bout.arena === 'backyard'
          ? BACKYARD_HALF_SIZE
          : BOXING_RING_HALF_SIZE;
      const maxCoord = half - 0.52;
      for (const f of bout.fighters) {
        f.x = clamp(f.x, -maxCoord, maxCoord);
        f.z = clamp(f.z, -maxCoord, maxCoord);
      }
    } else {
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

    // Swept interval overlap: never miss fast strikes on coarse mobile frame steps
    if (atk.actionTime < normWindup || atk.prevActionTime > normActiveEnd) {
      continue;
    }

    // Compute defender anatomical target center (accounting for active head movement displacement)
    const defFwdX = Math.sin(def.facingYaw);
    const defFwdZ = Math.cos(def.facingYaw);
    const defRightX = Math.cos(def.facingYaw);
    const defRightZ = -Math.sin(def.facingYaw);
    let tx = def.x;
    let tz = def.z;

    if (spec.zone === 'head') {
      if (def.action === 'slipLeft') {
        tx -= defRightX * 0.2;
        tz -= defRightZ * 0.2;
      } else if (def.action === 'slipRight') {
        tx += defRightX * 0.2;
        tz += defRightZ * 0.2;
      } else if (def.action === 'pullBack') {
        tx -= defFwdX * 0.24;
        tz -= defFwdZ * 0.24;
      } else if (def.action === 'duck') {
        tx += defFwdX * 0.08;
        tz += defFwdZ * 0.08;
      }
    }

    // Anatomical capsule radius per zone + tight swept strike capsule test
    const defenderRadius =
      spec.zone === 'head' ? 0.16 : spec.zone === 'body' ? 0.2 : 0.18;
    const isArcStrike =
      spec.isKick ||
      spec.id === 'leadHook' ||
      spec.id === 'rearHook' ||
      spec.id === 'overhand' ||
      spec.id === 'bodyHook' ||
      spec.id === 'rearBodyHook' ||
      spec.id === 'spinningBackfist';
    const arcTolerance = isArcStrike ? 0.16 : 0.05;

    const effectiveReach =
      spec.reach * atk.strikeReachMult * (atk.profile.reachMeters / 1.82);
    const atkFwdX = Math.sin(atk.facingYaw);
    const atkFwdZ = Math.cos(atk.facingYaw);

    const checkPointInStrikeBox = (px: number, pz: number) => {
      const pdx = px - atk.x;
      const pdz = pz - atk.z;
      const pDist = Math.hypot(pdx, pdz);
      const pProj = pdx * atkFwdX + pdz * atkFwdZ;
      const cProj = clamp(pProj, 0, effectiveReach);
      const cx = atk.x + atkFwdX * cProj;
      const cz = atk.z + atkFwdZ * cProj;
      const pPerp = Math.hypot(px - cx, pz - cz);
      return (
        pProj >= 0 &&
        pDist <= effectiveReach + defenderRadius * 0.45 &&
        pPerp <= defenderRadius + arcTolerance
      );
    };

    const inShiftedBox = checkPointInStrikeBox(tx, tz);
    const inBaseBox = checkPointInStrikeBox(def.x, def.z);

    // Head movement evasion window
    const inEvadeWindow =
      (def.action === 'slipLeft' ||
        def.action === 'slipRight' ||
        def.action === 'pullBack' ||
        def.action === 'duck') &&
      def.actionTime >= 0.02 &&
      def.actionTime <= def.actionDuration * 0.85;

    if (!inShiftedBox && !(inEvadeWindow && inBaseBox)) {
      continue;
    }

    const dx = tx - atk.x;
    const dz = tz - atk.z;
    const dist = Math.hypot(dx, dz);
    const dirX = dist > 0.001 ? dx / dist : atkFwdX;
    const dirZ = dist > 0.001 ? dz / dist : atkFwdZ;

    // Mark strike resolution attempted so it doesn't hit multiple frames
    atk.strikeHitRegistered = true;

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
        if (spec.zone === 'head' && (!inShiftedBox || dist > effectiveReach * 0.62)) {
          cleanEvade = true;
        } else if (spec.id === 'headKick' || spec.id === 'overhand') {
          caughtLeaning = true;
        }
      }
      // If physical displacement moved target outside strike box and opponent didn't lean into it, grant clean evade
      if (!inShiftedBox && !caughtLeaning) {
        cleanEvade = true;
      }
    }

    const atkCardio = getCardioProfile(
      atk.profile.stats.cardio,
      bout.simulationMode,
    );
    const defCardio = getCardioProfile(
      def.profile.stats.cardio,
      bout.simulationMode,
    );

    if (cleanEvade) {
      // Clean head-movement evasion! Opens a 0.3s Pull-Counter window!
      spendStamina(
        atk,
        spec.staminaCost * 0.35 * atkCardio.strikeDrainMult,
        atkCardio,
      );
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
      spec.zone === 'head'
        ? def.action === 'duck'
          ? 1.24
          : 1.54
        : spec.zone === 'body'
          ? 1.12
          : 0.62;
    const hitPos = {
      x: tx - dirX * defenderRadius * 0.55,
      y: hitY,
      z: tz - dirZ * defenderRadius * 0.55,
    };

    if (isProperBlock && !caughtLeaning) {
      const powerFactor = 0.9 + atk.profile.stats.power / 200;
      // Guard stays raised even at low blockHealth (bleed-through damage without stun/rocked)
      const blockAbsorbedClean = def.blockHealth > 4;
      const chip = blockAbsorbedClean
        ? spec.blockChip * powerFactor
        : spec.baseDamage * 0.24 * powerFactor;
      if (spec.zone === 'head') def.headHp = Math.max(1, def.headHp - chip);
      else if (spec.zone === 'body') def.bodyHp = Math.max(1, def.bodyHp - chip);
      else def.legHp = Math.max(1, def.legHp - chip);

      def.blockHealth = Math.max(0, def.blockHealth - spec.blockDrain * 0.85);
      def.stunMeter = Math.max(0, def.stunMeter - 2);
      def.vx += dirX * spec.knockback * (blockAbsorbedClean ? 0.45 : 0.6);
      def.vz += dirZ * spec.knockback * (blockAbsorbedClean ? 0.45 : 0.6);
      spendStamina(
        atk,
        spec.staminaCost * 0.25 * atkCardio.strikeDrainMult,
        atkCardio,
      );

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
    const fatigueFloor = 0.72;
    const fatigueMult =
      !bout.simulationMode || staminaRatio >= 0.3
        ? 1.0
        : fatigueFloor + (1 - fatigueFloor) * (staminaRatio / 0.3);
    const dmg =
      spec.baseDamage *
      powerScale *
      counterMult *
      atk.strikePowerMult *
      fatigueMult;

    const hitFromLeft =
      (atk.stance === 'orthodox' && spec.isLeadSide) ||
      (atk.stance === 'southpaw' && !spec.isLeadSide);

    if (spec.zone === 'head') {
      def.headHp = Math.max(0, def.headHp - dmg);
      const isSharpStrike =
        spec.id === 'leadHook' ||
        spec.id === 'rearHook' ||
        spec.id === 'overhand' ||
        spec.id === 'leadUppercut' ||
        spec.id === 'rearUppercut' ||
        spec.id === 'spinningBackfist' ||
        spec.id === 'headKick' ||
        spec.id === 'leadHeadKick';
      const sharpnessMult = isSharpStrike ? 1.55 : spec.id === 'jab' ? 0.72 : 1.05;
      const lowHeadBoost = def.headHp / Math.max(1, def.maxHeadHp) < 0.72 ? 1.38 : 1.0;
      const cutGain =
        (dmg / 95) *
        sharpnessMult *
        lowHeadBoost *
        (isVulnerabilityHit ? 1.35 : 1.0);
      def.headCutSeverity = clamp(def.headCutSeverity + cutGain, 0, 1);
      if (def.bleedSide === 0) {
        def.bleedSide = hitFromLeft ? -1 : 1;
      }
    } else if (spec.zone === 'body') {
      def.bodyHp = Math.max(0, def.bodyHp - dmg);
      if (bout.simulationMode && defCardio.bodyDamageStamMult > 0) {
        spendStamina(
          def,
          dmg * 0.55 * defCardio.bodyDamageStamMult,
          defCardio,
        );
      }
      def.bodyBruiseSeverity = clamp(
        def.bodyBruiseSeverity + (dmg / 110) * 1.15,
        0,
        1,
      );
    } else {
      def.legHp = Math.max(0, def.legHp - dmg);
      def.bodyBruiseSeverity = clamp(
        def.bodyBruiseSeverity + (dmg / 140) * 0.85,
        0,
        1,
      );
    }

    const activeCutSeverity =
      spec.zone === 'head' ? def.headCutSeverity : def.bodyBruiseSeverity;

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

    const isHoldingBlock = def.guard !== 'none';
    const rawStunAdd =
      spec.stunPower * (isVulnerabilityHit ? 1.65 : 1.0) +
      (caughtLeaning ? 16 : wasDefStriking ? 10 : 0);
    const stunAdd = isHoldingBlock ? rawStunAdd * 0.2 : rawStunAdd;
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
        if (spec.zone === 'head') {
          def.headCutSeverity = clamp(Math.max(def.headCutSeverity, 0.58) + 0.18, 0, 1);
        }
        def.action = 'ko';
        def.actionTime = 0;
        def.actionDuration = 3.2;
        def.currentStrike = null;
        def.guard = 'none';
        def.hitReactZone = spec.zone;
        def.hitReactSide = hitFromLeft ? -1 : 1;
        def.hitReactIntensity = 1.25;
        def.koStyle =
          spec.zone !== 'head' ||
          spec.id === 'leadUppercut' ||
          spec.id === 'rearUppercut'
            ? 'crumple'
            : spec.id === 'leadHook' ||
                spec.id === 'rearHook' ||
                spec.id === 'spinningBackfist' ||
                spec.id === 'headKick' ||
                spec.id === 'leadHeadKick'
              ? 'twisted'
              : 'backward';
        def.vx += dirX * Math.max(2.6, spec.knockback * 1.45);
        def.vz += dirZ * Math.max(2.6, spec.knockback * 1.45);
        bout.koWinnerIndex = atk.index;
        bout.koMethod = def.headHp <= 0 ? 'KO' : 'TKO';
        const elapsed = bout.roundDuration - bout.roundTimeRemaining;
        bout.koFinishTime = `R${bout.round} · ${formatFightClock(elapsed)}`;
        bout.slowMoTimer = 1.95;
        bout.hitstopTimer = 0.095;
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
          cutSeverity: def.headCutSeverity,
          hitPosition: hitPos,
        });
        events.push({
          type: 'ko',
          attackerIndex: atk.index,
          defenderIndex: def.index,
          strikeId: spec.id,
          zone: spec.zone,
          cutSeverity: def.headCutSeverity,
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
          cutSeverity: activeCutSeverity,
          hitPosition: hitPos,
        });
        continue;
      }
    }

    // Stunned / Rocked stumble reaction (never triggers while holding block!)
    const stunThreshold = isVulnerabilityHit ? 32 : 38;
    const forceRocked = caughtLeaning && dmg >= 18;
    const canRockDefender = !isHoldingBlock || caughtLeaning;

    if (
      canRockDefender &&
      (def.stunMeter >= stunThreshold || forceRocked) &&
      def.action !== 'stunned'
    ) {
      def.action = 'stunned';
      def.actionTime = 0;
      def.actionDuration = 1.85;
      def.currentStrike = null;
      def.queuedStrike = null;
      def.queuedStrikeTimer = 0;
      def.stunMeter = 12;
      def.blockHealth = Math.max(def.blockHealth, 24);
      def.rockedFlashTimer = 2.35;
      def.useUppercutReact = spec.zone === 'head' && Math.random() < 0.42;
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
        cutSeverity: activeCutSeverity,
        hitPosition: hitPos,
      });
    } else if (def.action !== 'stunned') {
      if (isHeavy || def.action === 'idle' || caughtLeaning) {
        const uppercutEligible =
          isHeavy &&
          (spec.zone === 'head' ||
            spec.id === 'leadUppercut' ||
            spec.id === 'rearUppercut' ||
            spec.id === 'overhand' ||
            spec.id === 'leadHook' ||
            spec.id === 'rearHook');
        def.useUppercutReact = uppercutEligible && Math.random() < 0.42;
        def.action = 'hitReact';
        def.actionTime = 0;
        def.actionDuration = def.useUppercutReact ? 0.46 : isHeavy ? 0.28 : 0.19;
        def.currentStrike = null;
        def.hitReactZone = spec.zone;
        def.hitReactSide = hitFromLeft ? -1 : 1;
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
      cutSeverity: activeCutSeverity,
      hitPosition: hitPos,
    });
  }

  return events;
}
