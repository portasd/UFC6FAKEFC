import type { FighterState } from './combatEngine';
import type { Stance } from './fighters';
import { STRIKES, StrikeId } from './strikes';

export interface PoseAngles {
  pelvisY: number;
  pelvisX: number;
  pelvisZ: number;
  pelvisRot: [number, number, number];
  abdomenRot: [number, number, number];
  chestRot: [number, number, number];
  neckRot: [number, number, number];
  headRot: [number, number, number];
  clavicleL: [number, number, number];
  shoulderL: [number, number, number];
  elbowL: [number, number, number];
  fistL: [number, number, number];
  clavicleR: [number, number, number];
  shoulderR: [number, number, number];
  elbowR: [number, number, number];
  fistR: [number, number, number];
  hipL: [number, number, number];
  kneeL: [number, number, number];
  ankleL: [number, number, number];
  hipR: [number, number, number];
  kneeR: [number, number, number];
  ankleR: [number, number, number];
}

export type EaseKind = 'linear' | 'cubicIn' | 'cubicOut' | 'cubicInOut';

export interface PoseKeyframe {
  t: number;
  ease?: EaseKind;
  pose: Partial<PoseAngles>;
}

export function createZeroPose(): PoseAngles {
  return {
    pelvisY: 0.93,
    pelvisX: 0,
    pelvisZ: 0,
    pelvisRot: [0, 0, 0],
    abdomenRot: [0, 0, 0],
    chestRot: [0, 0, 0],
    neckRot: [0, 0, 0],
    headRot: [0, 0, 0],
    clavicleL: [0, 0, 0],
    shoulderL: [0, 0, 0],
    elbowL: [0, 0, 0],
    fistL: [0, 0, 0],
    clavicleR: [0, 0, 0],
    shoulderR: [0, 0, 0],
    elbowR: [0, 0, 0],
    fistR: [0, 0, 0],
    hipL: [0, 0, 0],
    kneeL: [0, 0, 0],
    ankleL: [0, 0, 0],
    hipR: [0, 0, 0],
    kneeR: [0, 0, 0],
    ankleR: [0, 0, 0],
  };
}

export function clonePose(src: PoseAngles): PoseAngles {
  return {
    pelvisY: src.pelvisY,
    pelvisX: src.pelvisX,
    pelvisZ: src.pelvisZ,
    pelvisRot: [...src.pelvisRot],
    abdomenRot: [...src.abdomenRot],
    chestRot: [...src.chestRot],
    neckRot: [...src.neckRot],
    headRot: [...src.headRot],
    clavicleL: [...src.clavicleL],
    shoulderL: [...src.shoulderL],
    elbowL: [...src.elbowL],
    fistL: [...src.fistL],
    clavicleR: [...src.clavicleR],
    shoulderR: [...src.shoulderR],
    elbowR: [...src.elbowR],
    fistR: [...src.fistR],
    hipL: [...src.hipL],
    kneeL: [...src.kneeL],
    ankleL: [...src.ankleL],
    hipR: [...src.hipR],
    kneeR: [...src.kneeR],
    ankleR: [...src.ankleR],
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeInCubic(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * t;
}

export function easeOutCubic(x: number): number {
  const t = clamp(x, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(x: number): number {
  const t = clamp(x, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function applyEase(u: number, ease: EaseKind = 'cubicInOut'): number {
  switch (ease) {
    case 'linear':
      return clamp(u, 0, 1);
    case 'cubicIn':
      return easeInCubic(u);
    case 'cubicOut':
      return easeOutCubic(u);
    case 'cubicInOut':
    default:
      return easeInOutCubic(u);
  }
}

const VEC3_KEYS = [
  'pelvisRot',
  'abdomenRot',
  'chestRot',
  'neckRot',
  'headRot',
  'clavicleL',
  'shoulderL',
  'elbowL',
  'fistL',
  'clavicleR',
  'shoulderR',
  'elbowR',
  'fistR',
  'hipL',
  'kneeL',
  'ankleL',
  'hipR',
  'kneeR',
  'ankleR',
] as const;

function resolvePartial(base: PoseAngles, p: Partial<PoseAngles>): PoseAngles {
  const out = clonePose(base);
  if (p.pelvisY !== undefined) out.pelvisY = p.pelvisY;
  if (p.pelvisX !== undefined) out.pelvisX = p.pelvisX;
  if (p.pelvisZ !== undefined) out.pelvisZ = p.pelvisZ;
  for (const key of VEC3_KEYS) {
    const v = p[key];
    if (v) {
      out[key] = [v[0], v[1], v[2]];
    }
  }
  return out;
}

export function sampleKeyframeTrack(
  base: PoseAngles,
  keyframes: PoseKeyframe[],
  progress: number,
): PoseAngles {
  const u = clamp(progress, 0, 1);
  if (keyframes.length === 0) return clonePose(base);
  if (u <= keyframes[0].t) return resolvePartial(base, keyframes[0].pose);
  const last = keyframes[keyframes.length - 1];
  if (u >= last.t) return resolvePartial(base, last.pose);

  let idx = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (u >= keyframes[i].t && u <= keyframes[i + 1].t) {
      idx = i;
      break;
    }
  }

  const k0 = keyframes[idx];
  const k1 = keyframes[idx + 1];
  const span = Math.max(0.0001, k1.t - k0.t);
  const alpha = applyEase((u - k0.t) / span, k1.ease ?? 'cubicInOut');

  const p0 = resolvePartial(base, k0.pose);
  const p1 = resolvePartial(base, k1.pose);
  const out = createZeroPose();
  out.pelvisY = lerp(p0.pelvisY, p1.pelvisY, alpha);
  out.pelvisX = lerp(p0.pelvisX, p1.pelvisX, alpha);
  out.pelvisZ = lerp(p0.pelvisZ, p1.pelvisZ, alpha);

  for (const key of VEC3_KEYS) {
    out[key] = [
      lerp(p0[key][0], p1[key][0], alpha),
      lerp(p0[key][1], p1[key][1], alpha),
      lerp(p0[key][2], p1[key][2], alpha),
    ];
  }
  return out;
}

/**
 * Multi-layer Idle & Footwork Guard Pose:
 * - Authentic bladed MMA stance (+Y rotation puts lead side forward)
 * - Cubic-shaped bounce on balls of feet + chest breathing cycle
 * - Subtle lead-hand feint twitch & tight rear chin-guard
 */
export function getIdleGuardPose(
  stance: Stance,
  gaitPhase: number,
  speed: number,
  timeSec: number,
  staminaRatio = 1,
): PoseAngles {
  const s = stance === 'orthodox' ? 1 : -1;
  const moveBlend = Math.min(1, speed / 2.2);

  // Smooth cubic-shaped bounce phase (0..1 -> soft pause at bottom, crisp pop up)
  const bounceRaw = (Math.sin(timeSec * 5.8) + 1) * 0.5;
  const bounce = (easeInOutCubic(bounceRaw) - 0.5) * 0.032;

  // Thoracic breathing cycle slows and deepens when fatigued
  const breathFreq = staminaRatio < 0.35 ? 3.4 : 2.1;
  const breathAmp = staminaRatio < 0.35 ? 0.032 : 0.017;
  const breath = Math.sin(timeSec * breathFreq) * breathAmp;

  // Rhythm weight transfer between lead & rear leg
  const shiftPhase = (Math.sin(timeSec * 2.9) + 1) * 0.5;
  const weightShift = (easeInOutCubic(shiftPhase) - 0.5) * 0.08;

  const stride = Math.sin(gaitPhase) * moveBlend;
  const kneeLift = Math.max(0, Math.cos(gaitPhase)) * moveBlend;

  const pose = createZeroPose();
  pose.pelvisY = 0.895 + bounce - moveBlend * 0.022;
  pose.pelvisZ = weightShift * 0.42;
  pose.pelvisX = -s * 0.015;
  // Positive Y rotation advances left (-X) side forward for orthodox, negative Y advances right (+X) for southpaw
  pose.pelvisRot = [0.04, 0.38 * s + stride * 0.12, 0];
  pose.abdomenRot = [0.11 + Math.abs(weightShift) * 0.2 + breath * 0.7, 0.08 * s, weightShift * 0.25];
  pose.chestRot = [0.085 - breath * 0.85, 0.09 * s - stride * 0.06, weightShift * 0.22];
  pose.neckRot = [-0.05, -0.14 * s, 0];
  // Counter-rotate head toward opponent with chin tucked behind lead shoulder
  pose.headRot = [-0.11 + breath * 0.3, -0.4 * s, -weightShift * 0.42];

  const handBob = Math.sin(timeSec * 5.8 + 0.6) * 0.045;
  const roll = Math.cos(timeSec * 2.9) * 0.028;

  // Lead vs Rear arm configurations (built cleanly in stance-agnostic lead/rear space then mapped to L/R)
  const leadClav: [number, number, number] = [0.05 + breath * 0.4, 0.08 * s, -0.05 * s];
  const rearClav: [number, number, number] = [0.03 + breath * 0.3, -0.05 * s, 0.04 * s];

  const leadShoulder: [number, number, number] = [
    -0.96 + handBob,
    -0.16 * s + roll,
    -0.22 * s,
  ];
  const leadElbow: [number, number, number] = [
    -1.56 - handBob * 0.5,
    0.14 * s,
    0.22 * s,
  ];
  const leadFist: [number, number, number] = [-0.08, 0.25 * s, 0];

  const rearShoulder: [number, number, number] = [
    -0.86 - handBob * 0.75,
    0.18 * s - roll,
    0.24 * s,
  ];
  const rearElbow: [number, number, number] = [
    -1.84 + handBob * 0.45,
    -0.16 * s,
    -0.2 * s,
  ];
  const rearFist: [number, number, number] = [-0.06, -0.22 * s, 0];

  const leadHip: [number, number, number] = [
    -0.33 + stride * 0.28 - kneeLift * 0.14,
    0.12 * s,
    -0.08 * s,
  ];
  const leadKnee: [number, number, number] = [
    0.42 - stride * 0.08 + kneeLift * 0.22,
    0,
    0,
  ];
  const leadAnkle: [number, number, number] = [-0.09 + kneeLift * 0.08, 0.1 * s, 0];

  const rearHip: [number, number, number] = [
    0.24 - stride * 0.28,
    -0.14 * s,
    0.1 * s,
  ];
  const rearKnee: [number, number, number] = [0.32 + stride * 0.14, 0, 0];
  const rearAnkle: [number, number, number] = [-0.22 - bounce * 1.4, -0.14 * s, 0];

  if (stance === 'orthodox') {
    pose.clavicleL = leadClav;
    pose.shoulderL = leadShoulder;
    pose.elbowL = leadElbow;
    pose.fistL = leadFist;
    pose.clavicleR = rearClav;
    pose.shoulderR = rearShoulder;
    pose.elbowR = rearElbow;
    pose.fistR = rearFist;

    pose.hipL = leadHip;
    pose.kneeL = leadKnee;
    pose.ankleL = leadAnkle;
    pose.hipR = rearHip;
    pose.kneeR = rearKnee;
    pose.ankleR = rearAnkle;
  } else {
    pose.clavicleR = leadClav;
    pose.shoulderR = leadShoulder;
    pose.elbowR = leadElbow;
    pose.fistR = leadFist;
    pose.clavicleL = rearClav;
    pose.shoulderL = rearShoulder;
    pose.elbowL = rearElbow;
    pose.fistL = rearFist;

    pose.hipR = leadHip;
    pose.kneeR = leadKnee;
    pose.ankleR = leadAnkle;
    pose.hipL = rearHip;
    pose.kneeL = rearKnee;
    pose.ankleL = rearAnkle;
  }

  return pose;
}

/**
 * Multi-Phase Procedural Keyframe Strike Animations:
 * Uses explicit timing checkpoints derived from STRIKES[strikeId] and cubic easing
 * across hip rotation, spinal twist, clavicle protraction, shoulder, elbow, fist, and foot pivot.
 */
export function getStrikeKeyframePose(
  strikeId: StrikeId,
  stance: Stance,
  progress: number,
  base: PoseAngles,
): PoseAngles {
  const spec = STRIKES[strikeId];
  const total = spec.windup + spec.active + spec.recovery;
  const wEnd = spec.windup / total;
  const aEnd = (spec.windup + spec.active) / total;
  const s = stance === 'orthodox' ? 1 : -1;

  const useLeft =
    (stance === 'orthodox' && spec.isLeadSide) ||
    (stance === 'southpaw' && !spec.isLeadSide);
  // +1 when striking with Left (-X) limb, -1 when striking with Right (+X) limb
  const limbSign = useLeft ? 1 : -1;

  // Helpers to assign left/right limb tracks cleanly
  const setArm = (
    p: Partial<PoseAngles>,
    strikeLeft: boolean,
    clav: [number, number, number],
    sh: [number, number, number],
    el: [number, number, number],
    fi: [number, number, number],
    offClav: [number, number, number],
    offSh: [number, number, number],
    offEl: [number, number, number],
    offFi: [number, number, number],
  ) => {
    if (strikeLeft) {
      p.clavicleL = clav;
      p.shoulderL = sh;
      p.elbowL = el;
      p.fistL = fi;
      p.clavicleR = offClav;
      p.shoulderR = offSh;
      p.elbowR = offEl;
      p.fistR = offFi;
    } else {
      p.clavicleR = clav;
      p.shoulderR = sh;
      p.elbowR = el;
      p.fistR = fi;
      p.clavicleL = offClav;
      p.shoulderL = offSh;
      p.elbowL = offEl;
      p.fistL = offFi;
    }
  };

  if (strikeId === 'jab' || strikeId === 'cross') {
    const isCross = strikeId === 'cross';
    // Rotation target: Left (-X) forward punch twists +Y, Right (+X) rear cross twists violently -Y
    const targetPelvisY = isCross ? -0.52 * s : 0.62 * s;
    const targetChestY = isCross ? -0.58 * s : 0.42 * s;
    const midImpactT = (wEnd + aEnd) * 0.55;

    const loadArmSh: [number, number, number] = isCross
      ? [-0.92, -0.05 * limbSign, 0.25 * limbSign]
      : [-1.04, -0.1 * limbSign, -0.16 * limbSign];
    const snapSh: [number, number, number] = [
      -1.56,
      limbSign * -0.06,
      0,
    ];
    const snapEl: [number, number, number] = [-0.07, 0, 0];
    const snapFist: [number, number, number] = [0.05, limbSign * 1.15, 0];

    const pWindup: Partial<PoseAngles> = {
      pelvisY: base.pelvisY - (isCross ? 0.035 : 0.015),
      pelvisZ: isCross ? -0.02 : 0.03,
      pelvisRot: [0.08, isCross ? 0.48 * s : 0.34 * s, 0],
      abdomenRot: [0.16, isCross ? 0.16 * s : 0.04 * s, 0],
      chestRot: [0.11, isCross ? 0.22 * s : 0.02 * s, 0],
      headRot: [-0.18, isCross ? -0.45 * s : -0.35 * s, 0],
    };
    setArm(
      pWindup,
      useLeft,
      [0.04, -0.08 * limbSign, 0],
      loadArmSh,
      [isCross ? -1.9 : -1.6, 0, 0],
      [0, 0, 0],
      base.clavicleR,
      [-1.08, 0.22 * limbSign, -0.18 * limbSign],
      [-1.98, 0, 0],
      [0, 0, 0],
    );

    const pImpact: Partial<PoseAngles> = {
      pelvisY: base.pelvisY - (isCross ? 0.072 : 0.03),
      pelvisZ: isCross ? 0.12 : 0.075,
      pelvisRot: [0.09, targetPelvisY, 0],
      abdomenRot: [isCross ? 0.28 : 0.18, (targetChestY + targetPelvisY) * 0.28, -limbSign * 0.06],
      chestRot: [isCross ? 0.18 : 0.12, targetChestY, -limbSign * 0.05],
      neckRot: [-0.06, -(targetPelvisY + targetChestY) * 0.35, 0],
      headRot: [-0.26, -limbSign * 0.58, limbSign * 0.09],
      ...(stance === 'orthodox'
        ? isCross
          ? {
              hipL: [-0.46, 0.12, -0.08],
              kneeL: [0.56, 0, 0],
              hipR: [0.38, -0.36, 0.1],
              kneeR: [0.36, 0, 0],
              ankleR: [-0.52, 0.36, 0],
            }
          : {
              hipL: [-0.42, 0.1, -0.08],
              kneeL: [0.5, 0, 0],
              hipR: [0.32, -0.14, 0.1],
            }
        : isCross
          ? {
              hipR: [-0.46, -0.12, 0.08],
              kneeR: [0.56, 0, 0],
              hipL: [0.38, 0.36, -0.1],
              kneeL: [0.36, 0, 0],
              ankleL: [-0.52, -0.36, 0],
            }
          : {
              hipR: [-0.42, -0.1, 0.08],
              kneeR: [0.5, 0, 0],
              hipL: [0.32, 0.14, -0.1],
            }),
    };
    setArm(
      pImpact,
      useLeft,
      [0.14, limbSign * 0.36, limbSign * -0.14],
      snapSh,
      snapEl,
      snapFist,
      [-0.04, -limbSign * 0.2, limbSign * 0.08],
      [-1.18, limbSign * 0.28, limbSign * -0.2],
      [-2.14, 0, 0],
      [-0.08, -limbSign * 0.2, 0],
    );

    const pChamberReturn: Partial<PoseAngles> = {
      ...pImpact,
      pelvisZ: isCross ? 0.05 : 0.03,
      pelvisRot: [0.05, lerp(targetPelvisY, base.pelvisRot[1], 0.5), 0],
      chestRot: [0.1, lerp(targetChestY, base.chestRot[1], 0.55), 0],
    };
    setArm(
      pChamberReturn,
      useLeft,
      [0.06, limbSign * 0.12, 0],
      [-1.22, 0, -0.12 * limbSign],
      [-1.35, 0, 0],
      [0, limbSign * 0.35, 0],
      [0.02, 0, 0],
      [-1.08, limbSign * 0.24, limbSign * -0.18],
      [-1.95, 0, 0],
      [0, 0, 0],
    );

    return sampleKeyframeTrack(
      base,
      [
        { t: 0, pose: {} },
        { t: wEnd * 0.72, ease: 'cubicInOut', pose: pWindup },
        { t: midImpactT, ease: 'cubicOut', pose: pImpact },
        { t: aEnd, ease: 'linear', pose: pImpact },
        { t: aEnd + (1 - aEnd) * 0.45, ease: 'cubicIn', pose: pChamberReturn },
        { t: 1, ease: 'cubicOut', pose: {} },
      ],
      progress,
    );
  }

  if (
    strikeId === 'leadHook' ||
    strikeId === 'rearHook' ||
    strikeId === 'overhand' ||
    strikeId === 'bodyHook' ||
    strikeId === 'rearBodyHook'
  ) {
    const isBody = strikeId === 'bodyHook' || strikeId === 'rearBodyHook';
    const isOverhand = strikeId === 'overhand';

    // To sweep Left (-X) arm horizontally across to the right (+X), torso rotates toward +Y!
    // To sweep Right (+X) arm horizontally across to the left (-X), torso rotates toward -Y!
    const sweepPelvisY = limbSign * 0.74;
    const sweepChestY = limbSign * (isOverhand ? 0.88 : 0.82);
    const coilPelvisY = -limbSign * (isOverhand ? 0.38 : 0.26);
    const coilChestY = -limbSign * (isOverhand ? 0.48 : 0.36);

    const pCoil: Partial<PoseAngles> = {
      pelvisY: base.pelvisY - (isBody ? 0.15 : 0.075),
      pelvisRot: [0.08, base.pelvisRot[1] + coilPelvisY, 0],
      abdomenRot: [isBody ? 0.32 : 0.2, coilChestY * 0.45, limbSign * 0.14],
      chestRot: [0.12, coilChestY * 0.65, limbSign * 0.12],
      headRot: [-0.14, -base.pelvisRot[1] * 0.5, limbSign * 0.08],
    };
    setArm(
      pCoil,
      useLeft,
      [-0.04, -limbSign * 0.22, -limbSign * 0.08],
      [isOverhand ? -0.45 : -0.88, -limbSign * 0.35, -limbSign * 0.72],
      [-1.38, 0, 0],
      [0, 0, 0],
      [0.04, limbSign * 0.1, 0],
      [-1.12, limbSign * 0.24, limbSign * -0.18],
      [-2.04, 0, 0],
      [0, 0, 0],
    );

    const pImpact: Partial<PoseAngles> = {
      pelvisY: base.pelvisY - (isBody ? 0.18 : isOverhand ? 0.13 : 0.06),
      pelvisZ: isOverhand ? 0.14 : 0.085,
      pelvisRot: [0.1, sweepPelvisY, 0],
      abdomenRot: [
        isBody ? 0.44 : isOverhand ? 0.38 : 0.22,
        sweepChestY * 0.35,
        -limbSign * (isOverhand ? 0.32 : 0.2),
      ],
      chestRot: [
        isBody ? 0.28 : isOverhand ? 0.24 : 0.14,
        sweepChestY * 0.65,
        -limbSign * (isOverhand ? 0.22 : 0.14),
      ],
      headRot: [
        -0.22,
        -(sweepPelvisY + sweepChestY) * 0.55,
        -limbSign * (isOverhand ? 0.2 : 0.08),
      ],
      ...(useLeft
        ? {
            hipL: [-0.44, 0.36, -0.1],
            kneeL: [0.54, 0, 0],
            ankleL: [-0.14, -0.34, 0],
          }
        : {
            hipR: [0.36, -0.38, 0.12],
            kneeR: [0.34, 0, 0],
            ankleR: [-0.48, 0.38, 0],
          }),
    };
    setArm(
      pImpact,
      useLeft,
      [0.12, limbSign * 0.34, limbSign * (isOverhand ? 0.18 : -0.12)],
      [
        isBody ? -0.94 : isOverhand ? -1.84 : -1.48,
        limbSign * (isOverhand ? 0.52 : 0.78),
        limbSign * (isOverhand ? -0.68 : -0.96),
      ],
      [isOverhand ? -0.82 : -1.48, limbSign * 0.38, 0],
      [0, limbSign * 0.6, 0],
      [0.06, -limbSign * 0.16, 0],
      [-1.24, limbSign * 0.26, limbSign * -0.16],
      [-2.14, 0, 0],
      [0, 0, 0],
    );

    const pFollow: Partial<PoseAngles> = {
      ...pImpact,
      pelvisRot: [0.08, sweepPelvisY + limbSign * 0.14, 0],
      chestRot: [0.16, sweepChestY * 0.74, -limbSign * 0.16],
    };

    return sampleKeyframeTrack(
      base,
      [
        { t: 0, pose: {} },
        { t: wEnd * 0.85, ease: 'cubicInOut', pose: pCoil },
        { t: (wEnd + aEnd) * 0.55, ease: 'cubicOut', pose: pImpact },
        { t: aEnd + 0.04, ease: 'cubicOut', pose: pFollow },
        { t: 1, ease: 'cubicInOut', pose: {} },
      ],
      progress,
    );
  }

  if (strikeId === 'leadUppercut' || strikeId === 'rearUppercut') {
    const twistY = limbSign * 0.56;
    const pDip: Partial<PoseAngles> = {
      pelvisY: base.pelvisY - 0.16,
      pelvisRot: [0.12, base.pelvisRot[1] - limbSign * 0.25, 0],
      abdomenRot: [0.34, -limbSign * 0.18, limbSign * 0.12],
      chestRot: [0.2, -limbSign * 0.24, limbSign * 0.14],
      hipL: [-0.56, base.hipL[1], base.hipL[2]],
      kneeL: [0.72, 0, 0],
      hipR: [-0.38, base.hipR[1], base.hipR[2]],
      kneeR: [0.64, 0, 0],
    };
    setArm(
      pDip,
      useLeft,
      [0.05, 0, 0],
      [-0.48, 0, -limbSign * 0.18],
      [-1.65, 0, 0],
      [0, 0, 0],
      base.clavicleR,
      [-1.16, limbSign * 0.22, limbSign * -0.14],
      [-2.08, 0, 0],
      [0, 0, 0],
    );

    const pRise: Partial<PoseAngles> = {
      pelvisY: base.pelvisY + 0.04,
      pelvisZ: 0.08,
      pelvisRot: [-0.04, twistY, 0],
      abdomenRot: [-0.05, twistY * 0.45, -limbSign * 0.08],
      chestRot: [-0.22, twistY * 0.65, -limbSign * 0.08],
      headRot: [-0.18, -twistY * 0.85, 0],
      hipL: [-0.24, base.hipL[1], base.hipL[2]],
      kneeL: [0.22, 0, 0],
      hipR: [0.12, base.hipR[1], base.hipR[2]],
      kneeR: [0.16, 0, 0],
    };
    setArm(
      pRise,
      useLeft,
      [-0.14, limbSign * 0.28, limbSign * -0.16],
      [-1.48, -limbSign * 0.12, 0],
      [-1.72, 0, 0],
      [-0.12, 0, 0],
      [0.04, 0, 0],
      [-1.22, limbSign * 0.24, limbSign * -0.16],
      [-2.12, 0, 0],
      [0, 0, 0],
    );

    return sampleKeyframeTrack(
      base,
      [
        { t: 0, pose: {} },
        { t: wEnd * 0.85, ease: 'cubicInOut', pose: pDip },
        { t: (wEnd + aEnd) * 0.6, ease: 'cubicOut', pose: pRise },
        { t: aEnd + 0.05, ease: 'linear', pose: pRise },
        { t: 1, ease: 'cubicInOut', pose: {} },
      ],
      progress,
    );
  }

  if (strikeId === 'spinningBackfist') {
    const hipSpin = easeInOutCubic(smoothstep(0.02, 0.84, progress)) * Math.PI * 2 * s;
    const chestSpin = easeInOutCubic(smoothstep(0.08, 0.9, progress)) * Math.PI * 2 * s;
    const power = Math.sin(smoothstep(0.15, 0.82, progress) * Math.PI);
    const out = clonePose(base);
    out.pelvisY = base.pelvisY - 0.06 * Math.sin(progress * Math.PI);
    out.pelvisRot = [0.06, base.pelvisRot[1] + hipSpin, 0];
    out.chestRot = [0.12, base.chestRot[1] + (chestSpin - hipSpin) * 0.55, 0];
    out.clavicleR = [0, -0.3 * power, 0];
    out.shoulderR = [-1.48, -0.38 * s, 0.94 * s * power];
    out.elbowR = [-0.2 - (1 - power) * 0.85, 0, 0];
    out.shoulderL = [-1.18, -0.25, -0.15];
    out.elbowL = [-2.05, 0, 0];
    return out;
  }

  // Authentic Muay Thai / UFC Multi-Phase Roundhouse Kick:
  // 1. Base pivot & knee chamber -> 2. Hip turnover -> 3. Shin whip & arm counter-swing -> 4. Re-chamber -> 5. Touchdown
  const isHigh = strikeId === 'headKick' || strikeId === 'leadHeadKick';
  const isBody = strikeId === 'bodyKick' || strikeId === 'rearBodyKick';
  const kickLeft = useLeft;
  // dir = -1 when kicking with Left (-X) leg, +1 when kicking with Right (+X) leg
  const dir = kickLeft ? -1 : 1;

  // Height on kicking thigh abduction & flexion after hip turns sideways
  const thighSideLift = dir * (isHigh ? 1.56 : isBody ? 1.24 : 0.72);
  const thighFwdAngle = isHigh ? -0.58 : isBody ? -0.44 : -0.3;
  // Counter-balance lean toward the standing leg (opposite dir: -dir * rz turns torso away)
  const torsoSideLean = -dir * (isHigh ? 0.44 : isBody ? 0.32 : 0.16);
  // Pelvis turns toward the standing leg (-dir * Y) so kicking hip opens directly at target
  const hipTurnYaw = -dir * 1.12;

  const makeKickFrame = (
    liftFraction: number,
    hipTurnFraction: number,
    kneeBend: number,
    armWhip: number,
    plantPivot: number,
  ): Partial<PoseAngles> => {
    const p: Partial<PoseAngles> = {
      pelvisY: base.pelvisY - 0.03 * liftFraction,
      pelvisZ: 0.08 * hipTurnFraction,
      pelvisRot: [0, lerp(base.pelvisRot[1], hipTurnYaw, hipTurnFraction), torsoSideLean * hipTurnFraction],
      abdomenRot: [-0.08 * hipTurnFraction, -dir * 0.18 * hipTurnFraction, torsoSideLean * 0.35 * hipTurnFraction],
      chestRot: [-0.14 * hipTurnFraction, -dir * 0.16 * hipTurnFraction, torsoSideLean * 0.42 * hipTurnFraction],
      headRot: [-0.1, dir * 0.78 * hipTurnFraction, -torsoSideLean * 0.72 * hipTurnFraction],
    };

    const kickHip: [number, number, number] = [
      lerp(kickLeft ? base.hipL[0] : base.hipR[0], thighFwdAngle, liftFraction),
      lerp(0, -dir * 0.36, hipTurnFraction),
      lerp(0, thighSideLift, liftFraction),
    ];
    const kickKnee: [number, number, number] = [kneeBend, 0, 0];
    const kickAnkle: [number, number, number] = [0.46 * liftFraction, 0, 0];

    const standHip: [number, number, number] = [
      -0.12 * plantPivot,
      dir * 0.48 * plantPivot,
      -dir * 0.06,
    ];
    const standKnee: [number, number, number] = [0.18, 0, 0];
    const standAnkle: [number, number, number] = [-0.26 * plantPivot, -dir * 0.48 * plantPivot, 0];

    const whipShoulder: [number, number, number] = [
      lerp(-0.9, 0.72, armWhip),
      0,
      lerp(dir * 0.2, dir * 0.88, armWhip),
    ];
    const whipElbow: [number, number, number] = [lerp(-1.5, -0.22, armWhip), 0, 0];

    const guardShoulder: [number, number, number] = [-1.26, -dir * 0.28, -dir * 0.18];
    const guardElbow: [number, number, number] = [-2.14, 0, 0];

    if (kickLeft) {
      p.hipL = kickHip;
      p.kneeL = kickKnee;
      p.ankleL = kickAnkle;
      p.hipR = standHip;
      p.kneeR = standKnee;
      p.ankleR = standAnkle;
      p.shoulderL = whipShoulder;
      p.elbowL = whipElbow;
      p.shoulderR = guardShoulder;
      p.elbowR = guardElbow;
    } else {
      p.hipR = kickHip;
      p.kneeR = kickKnee;
      p.ankleR = kickAnkle;
      p.hipL = standHip;
      p.kneeL = standKnee;
      p.ankleL = standAnkle;
      p.shoulderR = whipShoulder;
      p.elbowR = whipElbow;
      p.shoulderL = guardShoulder;
      p.elbowL = guardElbow;
    }
    return p;
  };

  const fChamber = makeKickFrame(0.68, 0.52, 1.32, 0.28, 0.65);
  const fTurnOver = makeKickFrame(0.95, 0.94, 1.05, 0.72, 0.95);
  const fWhipPeak = makeKickFrame(1.0, 1.0, 0.06, 1.0, 1.0);
  const fReChamber = makeKickFrame(0.58, 0.56, 1.15, 0.42, 0.6);

  return sampleKeyframeTrack(
    base,
    [
      { t: 0, pose: {} },
      { t: wEnd * 0.62, ease: 'cubicInOut', pose: fChamber },
      { t: wEnd * 0.96, ease: 'cubicOut', pose: fTurnOver },
      { t: (wEnd + aEnd) * 0.55, ease: 'cubicOut', pose: fWhipPeak },
      { t: aEnd + 0.02, ease: 'linear', pose: fWhipPeak },
      { t: aEnd + (1 - aEnd) * 0.45, ease: 'cubicIn', pose: fReChamber },
      { t: 1, ease: 'cubicOut', pose: {} },
    ],
    progress,
  );
}

/**
 * Multi-Phase Guard / Block Pose (High Shell or Low Body/Leg Check):
 * Clamps chin behind elevated forearms, shrugs clavicles, bends elbows tight,
 * and subtly absorbs blocked strikes with a damped brace bounce.
 */
export function getBlockPose(
  guard: 'high' | 'low',
  stance: Stance,
  base: PoseAngles,
  timeSec: number,
): PoseAngles {
  const s = stance === 'orthodox' ? 1 : -1;
  const brace = Math.sin(timeSec * 4.2) * 0.015;
  const out = clonePose(base);

  if (guard === 'high') {
    out.pelvisY = base.pelvisY - 0.032;
    out.pelvisRot = [0.06, 0.3 * s, 0];
    out.abdomenRot = [0.2 + brace, 0.04 * s, 0];
    out.chestRot = [0.16 - brace, 0.05 * s, 0];
    out.neckRot = [0.08, -0.06 * s, 0];
    out.headRot = [0.17, -0.28 * s, 0]; // Chin deeply tucked inside gloves

    out.clavicleL = [0.14, 0.18, -0.14];
    out.clavicleR = [0.14, -0.18, 0.14];
    out.shoulderL = [-1.26, 0.3, -0.06];
    out.elbowL = [-2.16, 0.08, 0.14];
    out.fistL = [-0.08, 0.2, 0];
    out.shoulderR = [-1.26, -0.3, 0.06];
    out.elbowR = [-2.16, -0.08, -0.14];
    out.fistR = [-0.08, -0.2, 0];
  } else {
    out.pelvisY = base.pelvisY - 0.08;
    out.pelvisRot = [0.08, 0.34 * s, 0];
    out.abdomenRot = [0.27 + brace, 0.05 * s, 0];
    out.chestRot = [0.18, 0.06 * s, 0];
    out.headRot = [-0.02, -0.34 * s, 0];

    out.clavicleL = [0.08, 0.12, 0.04];
    out.clavicleR = [0.08, -0.12, -0.04];
    out.shoulderL = [-0.64, 0.24, -0.14];
    out.elbowL = [-1.48, 0.22, 0.12];
    out.shoulderR = [-0.64, -0.24, 0.14];
    out.elbowR = [-1.48, -0.22, -0.12];

    // Slight lead shin check posture
    if (stance === 'orthodox') {
      out.hipL = [-0.46, 0.16, -0.14];
      out.kneeL = [0.64, 0, 0];
    } else {
      out.hipR = [-0.46, -0.16, 0.14];
      out.kneeR = [0.64, 0, 0];
    }
  }

  return out;
}

/**
 * Multi-Phase Knockdown Keyframe Sequence:
 * 1. Shock whiplash & knee buckle -> 2. Heavy fall onto canvas -> 3. Mat impact bounce ->
 * 4. Sit-up onto forearm -> 5. Climb back up to fighting stance.
 */
export function getKnockdownPose(
  state: FighterState,
  base: PoseAngles,
): PoseAngles {
  const duration = Math.max(0.8, state.actionDuration);
  const progress = clamp(state.actionTime / duration, 0, 1);
  const side = state.hitReactSide === 0 ? 1 : state.hitReactSide;

  const pBuckle: Partial<PoseAngles> = {
    pelvisY: base.pelvisY - 0.18,
    pelvisRot: [-0.14, base.pelvisRot[1] + 0.18 * side, 0.14 * side],
    abdomenRot: [-0.08, 0, 0.12 * side],
    chestRot: [-0.28, 0.2 * side, 0.1 * side],
    headRot: [-0.56, 0.4 * side, -0.18 * side],
    shoulderL: [-0.65, -0.35, -0.62],
    elbowL: [-0.72, 0, 0],
    shoulderR: [-0.65, 0.35, 0.62],
    elbowR: [-0.72, 0, 0],
    hipL: [-0.68, 0.08, -0.14],
    kneeL: [0.95, 0, 0],
    hipR: [-0.48, -0.08, 0.14],
    kneeR: [0.82, 0, 0],
  };

  const pMatHit: Partial<PoseAngles> = {
    pelvisY: 0.145,
    pelvisZ: -0.16,
    pelvisRot: [-Math.PI * 0.48, 0.24 * side, 0.22 * side],
    abdomenRot: [-0.08, 0, 0.08 * side],
    chestRot: [-0.14, 0, 0],
    headRot: [0.24, 0.36 * side, -0.18 * side],
    shoulderL: [-0.28, -0.46, -0.95],
    elbowL: [-0.36, 0, 0],
    shoulderR: [-0.22, 0.48, 0.92],
    elbowR: [-0.38, 0, 0],
    hipL: [-0.18, -0.06, -0.2],
    kneeL: [0.28, 0, 0],
    hipR: [0.06, 0.06, 0.18],
    kneeR: [0.14, 0, 0],
  };

  const pMatBounce: Partial<PoseAngles> = {
    ...pMatHit,
    pelvisY: 0.185,
    headRot: [-0.06, 0.32 * side, -0.14 * side],
    shoulderL: [-0.36, -0.44, -0.82],
    elbowL: [-0.58, 0, 0],
    shoulderR: [-0.34, 0.44, 0.82],
    elbowR: [-0.55, 0, 0],
  };

  const pBraceSitUp: Partial<PoseAngles> = {
    pelvisY: 0.19,
    pelvisZ: -0.06,
    pelvisRot: [-0.62, 0.2 * side, 0.12 * side],
    abdomenRot: [0.42, 0, 0],
    chestRot: [0.34, 0, 0],
    headRot: [0.16, 0.12 * side, 0],
    shoulderL: [-0.72, -0.25, -0.52],
    elbowL: [-1.1, 0, 0],
    shoulderR: [0.24, 0.22, 0.44],
    elbowR: [-1.2, 0, 0],
    hipL: [-0.78, 0.12, -0.18],
    kneeL: [1.18, 0, 0],
    hipR: [-0.28, -0.12, 0.18],
    kneeR: [0.58, 0, 0],
  };

  const pPushStand: Partial<PoseAngles> = {
    pelvisY: 0.64,
    pelvisRot: [0.26, base.pelvisRot[1], 0],
    abdomenRot: [0.38, 0, 0],
    chestRot: [0.22, 0, 0],
    headRot: [-0.22, base.headRot[1] * 0.5, 0],
    shoulderL: [-0.95, 0.15, -0.22],
    elbowL: [-1.45, 0, 0],
    shoulderR: [-0.88, -0.15, 0.22],
    elbowR: [-1.62, 0, 0],
    hipL: [-0.76, 0.12, -0.1],
    kneeL: [0.92, 0, 0],
    hipR: [0.18, -0.1, 0.1],
    kneeR: [0.55, 0, 0],
  };

  return sampleKeyframeTrack(
    base,
    [
      { t: 0, pose: {} },
      { t: 0.18, ease: 'cubicOut', pose: pBuckle },
      { t: 0.44, ease: 'cubicIn', pose: pMatHit },
      { t: 0.54, ease: 'cubicOut', pose: pMatBounce },
      { t: 0.66, ease: 'cubicInOut', pose: pMatHit },
      { t: 0.82, ease: 'cubicInOut', pose: pBraceSitUp },
      { t: 0.93, ease: 'cubicInOut', pose: pPushStand },
      { t: 1.0, ease: 'cubicOut', pose: {} },
    ],
    progress,
  );
}

/**
 * Multi-Phase Knockout Pose (crumple, twisted, backward)
 */
export function getKnockoutPose(
  state: FighterState,
  base: PoseAngles,
): PoseAngles {
  const t = state.actionTime;
  const side = state.hitReactSide === 0 ? 1 : state.hitReactSide;
  const whiplash = Math.sin(clamp(t / 0.19, 0, 1) * Math.PI);
  const kneeGive = smoothstep(0.02, 0.24, t);
  const dropRaw = clamp((t - 0.1) / 0.42, 0, 1);
  const drop = clamp(dropRaw * dropRaw * (2 - dropRaw * 0.85), 0, 1);
  const bounce =
    t > 0.48 && t < 0.84
      ? Math.sin(((t - 0.48) / 0.36) * Math.PI) * 0.055 * (1 - (t - 0.48) / 0.36)
      : 0;
  const settle = smoothstep(0.5, 0.86, t);
  const headSlamBounce =
    t > 0.52 && t < 0.88 ? Math.sin(((t - 0.52) / 0.36) * Math.PI) * 0.26 : 0;

  const target = clonePose(base);

  if (state.koStyle === 'crumple') {
    const crumpleDrop = smoothstep(0.08, 0.55, t);
    target.pelvisY = lerp(base.pelvisY - kneeGive * 0.32, 0.15, crumpleDrop) + bounce * 0.7;
    target.pelvisRot = [
      lerp(0, -Math.PI * 0.42, crumpleDrop),
      base.pelvisRot[1],
      lerp(0, 0.42 * side, crumpleDrop),
    ];
    target.abdomenRot = [
      lerp(base.abdomenRot[0], 0.45 * (1 - settle * 0.5), crumpleDrop),
      0,
      0,
    ];
    target.chestRot = [
      lerp(base.chestRot[0], 0.25 * (1 - settle * 0.6), crumpleDrop),
      0,
      0.28 * side * crumpleDrop,
    ];
    target.headRot = [
      -0.65 * whiplash + lerp(0, 0.44, settle) - headSlamBounce,
      0.52 * side * drop,
      -0.35 * side * settle,
    ];
    target.hipL = [-1.15 * kneeGive * (1 - settle * 0.55), -0.18 * side, -0.28 * settle];
    target.kneeL = [1.85 * kneeGive * (1 - settle * 0.65), 0, 0];
    target.hipR = [-0.95 * kneeGive * (1 - settle * 0.5), 0.16 * side, 0.26 * settle];
    target.kneeR = [1.55 * kneeGive * (1 - settle * 0.55), 0, 0];
    target.shoulderL = [lerp(-0.1, 0.18, settle), -0.38 * drop, -0.78 * drop];
    target.shoulderR = [lerp(-0.15, -0.34, settle), 0.48 * drop, 1.05 * drop];
    target.elbowL = [-0.35 - 0.3 * bounce, 0.15, 0];
    target.elbowR = [-0.25 - 0.25 * bounce, -0.15, 0];
  } else if (state.koStyle === 'twisted') {
    target.pelvisY = lerp(base.pelvisY - kneeGive * 0.12, 0.145, drop) + bounce;
    target.pelvisRot = [
      lerp(0, -Math.PI * 0.48, drop),
      lerp(0, 0.48 * side, drop),
      lerp(0, 0.36 * side, drop),
    ];
    target.abdomenRot = [base.abdomenRot[0] * (1 - drop), lerp(0, 0.22 * side, drop), 0];
    target.chestRot = [lerp(-0.32 * whiplash, -0.12, drop), 0.35 * side * whiplash, 0];
    target.headRot = [
      -0.92 * whiplash - headSlamBounce + 0.18 * settle,
      0.68 * side * clamp(whiplash + settle * 0.85, 0, 1),
      -0.4 * side * drop,
    ];
    target.shoulderL = [
      lerp(-0.85 * whiplash, -0.12, settle),
      lerp(-0.4, -0.58, settle),
      lerp(-1.25 * drop, -1.12, settle),
    ];
    target.shoulderR = [
      lerp(-1.05 * whiplash, -0.38, settle),
      lerp(0.35, 0.62, settle),
      lerp(1.18 * drop, 0.94, settle),
    ];
    target.elbowL = [lerp(-0.18, -0.45, settle) - bounce * 2.5, 0, 0.15];
    target.elbowR = [lerp(-0.55, -0.18, settle) - bounce * 2.2, 0, -0.15];
    target.hipL = [lerp(-0.32 * kneeGive, -0.24, settle), -0.14 * settle, -0.26 * settle];
    target.hipR = [lerp(-0.15 * kneeGive, 0.12, settle), 0.16 * settle, 0.14 * settle];
    target.kneeL = [lerp(0.55 * kneeGive, 0.48, settle), 0, 0];
    target.kneeR = [lerp(0.28 * kneeGive, 0.16, settle), 0, 0];
  } else {
    target.pelvisY = lerp(base.pelvisY - kneeGive * 0.14, 0.145, drop) + bounce;
    target.pelvisRot = [
      lerp(0, -Math.PI * 0.49, drop),
      base.pelvisRot[1] * (1 - drop),
      lerp(0, 0.16 * side, drop),
    ];
    target.chestRot = [lerp(-0.38 * whiplash, -0.1, drop), 0, 0];
    target.headRot = [
      -0.88 * whiplash - headSlamBounce + 0.16 * settle,
      0.46 * side * settle,
      -0.24 * side * settle,
    ];
    target.shoulderL = [
      lerp(-0.45 * whiplash, -0.22, settle),
      -0.55 * drop,
      lerp(-0.95, -1.16, settle) * drop,
    ];
    target.shoulderR = [
      lerp(-0.92 * whiplash, -0.08, settle),
      0.5 * drop,
      lerp(1.05, 0.88, settle) * drop,
    ];
    target.elbowL = [-0.28 - bounce * 2.4, 0, 0];
    target.elbowR = [-0.52 - bounce * 2.2, 0, 0];
    target.hipL = [lerp(-0.28 * kneeGive, -0.22, settle), 0, -0.22 * drop];
    target.hipR = [lerp(-0.14 * kneeGive, 0.08, settle), 0, 0.16 * drop];
    target.kneeL = [lerp(0.48 * kneeGive, 0.36, settle), 0, 0];
    target.kneeR = [lerp(0.24 * kneeGive, 0.14, settle), 0, 0];
  }

  return target;
}
