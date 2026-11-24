import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkinnedHierarchy } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const MIXAMO_SCALE = 0.01;

export type MixamoClipKey =
  | 'jabPunch'
  | 'hookPunch'
  | 'walkNeutral'
  | 'walkGuard'
  | 'mmaKick'
  | 'knockedOut';

export type MixamoActionKind = 'none' | MixamoClipKey;

export interface MixamoClipSource {
  key: MixamoClipKey;
  clipName: string;
  cdnUrl: string;
  localUrl: string;
  inPlace?: boolean;
}

export const MIXAMO_ANIMATION_SOURCES: Record<MixamoClipKey, MixamoClipSource> = {
  jabPunch: {
    key: 'jabPunch',
    clipName: 'JabPunch',
    cdnUrl: 'https://cdn.jsdelivr.net/gh/portasd/AnimationsOFC6@main/Punching.fbx',
    localUrl: '/assets/animations/Punching.fbx',
    inPlace: false,
  },
  hookPunch: {
    key: 'hookPunch',
    clipName: 'HookPunch',
    cdnUrl: 'https://cdn.jsdelivr.net/gh/portasd/AnimationsOFC6@main/Punching(1).fbx',
    localUrl: '/assets/animations/Punching(1).fbx',
    inPlace: false,
  },
  walkNeutral: {
    key: 'walkNeutral',
    clipName: 'NeutralWalking',
    cdnUrl: 'https://cdn.jsdelivr.net/gh/portasd/AnimationsOFC6@main/Walking%20(1).fbx',
    localUrl: '/assets/animations/Walking (1).fbx',
    inPlace: true,
  },
  walkGuard: {
    key: 'walkGuard',
    clipName: 'WalkingGuardUp',
    cdnUrl: 'https://cdn.jsdelivr.net/gh/portasd/AnimationsOFC6@main/Walking.fbx',
    localUrl: '/assets/animations/Walking.fbx',
    inPlace: true,
  },
  mmaKick: {
    key: 'mmaKick',
    clipName: 'MmaHeadKick',
    cdnUrl: 'https://cdn.jsdelivr.net/gh/portasd/AnimationsOFC6@main/Mma%20Kick.fbx',
    localUrl: '/assets/animations/Mma Kick.fbx',
    inPlace: false,
  },
  knockedOut: {
    key: 'knockedOut',
    clipName: 'KnockedOut',
    cdnUrl: 'https://cdn.jsdelivr.net/gh/portasd/AnimationsOFC6@main/Knocked%20Out.fbx',
    localUrl: '/assets/animations/Knocked Out.fbx',
    inPlace: false,
  },
};

export const MIXAMO_KEY_BONE_NAMES = [
  'Hips',
  'Spine2',
  'Head',
  'LeftArm',
  'LeftForeArm',
  'RightArm',
  'RightForeArm',
  'LeftUpLeg',
  'LeftLeg',
  'RightUpLeg',
  'RightLeg',
] as const;

export type MixamoKeyBoneName = (typeof MIXAMO_KEY_BONE_NAMES)[number];

export interface MixamoClipBundle {
  templateRoot: THREE.Group;
  clips: Record<MixamoClipKey, THREE.AnimationClip | null>;
}

export interface MixamoBoneAttachments {
  bones: Partial<Record<MixamoKeyBoneName, THREE.Object3D>>;
  wrappers: Partial<Record<MixamoKeyBoneName, THREE.Group>>;
  anchors: Partial<Record<MixamoKeyBoneName, THREE.Group>>;
}

export interface BoneAttachmentOptions {
  mixamoScale?: number;
  offsets?: Partial<Record<MixamoKeyBoneName, [number, number, number]>>;
  scales?: Partial<Record<MixamoKeyBoneName, [number, number, number]>>;
}

export interface MixamoRigController {
  skeletonRoot: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<MixamoClipKey, THREE.AnimationAction | null>;
  // Convenience aliases preserved for direct inspection
  kickAction: THREE.AnimationAction | null;
  koAction: THREE.AnimationAction | null;
  attachments: MixamoBoneAttachments;
  activeMode: MixamoActionKind;
  triggerJabPunch: (strikeDurationSec: number) => void;
  triggerHookPunch: (strikeDurationSec: number) => void;
  triggerMmaKick: (strikeDurationSec: number) => void;
  triggerKnockedOut: () => void;
  playWalkNeutral: (speedScale?: number) => void;
  playWalkGuard: (speedScale?: number) => void;
  stop: () => void;
  update: (dt: number) => void;
  dispose: () => void;
}

/**
 * Finds a Mixamo bone regardless of prefix convention (`mixamorigHips`, `mixamorig:Hips`, or `Hips`).
 */
export function findMixamoBone(
  root: THREE.Object3D,
  key: MixamoKeyBoneName,
): THREE.Object3D | null {
  const candidates = [`mixamorig${key}`, `mixamorig:${key}`, key];
  for (const candidate of candidates) {
    const found = root.getObjectByName(candidate);
    if (found) return found;
  }
  return null;
}

/**
 * Strips horizontal root-motion drift from `mixamorigHips.position` tracks while preserving
 * vertical hip bounce so looping locomotion clips animate cleanly in-place.
 */
export function makeClipInPlace(clip: THREE.AnimationClip): THREE.AnimationClip {
  for (const track of clip.tracks) {
    if (/Hips\.position$/i.test(track.name) && track.values.length >= 3) {
      const baseX = track.values[0];
      const baseZ = track.values[2];
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = baseX;
        track.values[i + 2] = baseZ;
      }
    }
  }
  return clip;
}

/**
 * Picks the non-empty animation clip from an FBX (skipping empty `Take 001` tracks).
 */
export function extractActiveMixamoClip(
  fbx: THREE.Object3D & { animations?: THREE.AnimationClip[] },
  clipName: string,
  inPlace = false,
): THREE.AnimationClip | null {
  const clips = fbx.animations ?? [];
  const valid = clips.find((c) => c.tracks.length > 0 && c.duration > 0.05);
  if (!valid) return null;
  const cloned = valid.clone();
  cloned.name = clipName;
  return inPlace ? makeClipInPlace(cloned) : cloned;
}

function makeBasisQuat(
  xAxis: [number, number, number],
  yAxis: [number, number, number],
  zAxis: [number, number, number],
): THREE.Quaternion {
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...xAxis),
    new THREE.Vector3(...yAxis),
    new THREE.Vector3(...zAxis),
  );
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

// Target world-space basis for each `-Y`-hanging / upright meter-scale fighter segment
// when the Mixamo skeleton stands in rest T-pose facing `+Z`.
const DESIRED_WORLD_BASIS: Record<MixamoKeyBoneName, THREE.Quaternion> = {
  Hips: makeBasisQuat([1, 0, 0], [0, 1, 0], [0, 0, 1]),
  Spine2: makeBasisQuat([1, 0, 0], [0, 1, 0], [0, 0, 1]),
  Head: makeBasisQuat([1, 0, 0], [0, 1, 0], [0, 0, 1]),
  // Mixamo LeftArm extends along +X: align segment -Y -> +X (so +Y -> -X) and +Z -> +Z
  LeftArm: makeBasisQuat([0, 1, 0], [-1, 0, 0], [0, 0, 1]),
  LeftForeArm: makeBasisQuat([0, 1, 0], [-1, 0, 0], [0, 0, 1]),
  // Mixamo RightArm extends along -X: align segment -Y -> -X (so +Y -> +X) and +Z -> +Z
  RightArm: makeBasisQuat([0, -1, 0], [1, 0, 0], [0, 0, 1]),
  RightForeArm: makeBasisQuat([0, -1, 0], [1, 0, 0], [0, 0, 1]),
  // Mixamo legs extend down along -Y: align upright/hanging segment cleanly with +Z forward
  LeftUpLeg: makeBasisQuat([1, 0, 0], [0, 1, 0], [0, 0, 1]),
  LeftLeg: makeBasisQuat([1, 0, 0], [0, 1, 0], [0, 0, 1]),
  RightUpLeg: makeBasisQuat([1, 0, 0], [0, 1, 0], [0, 0, 1]),
  RightLeg: makeBasisQuat([1, 0, 0], [0, 1, 0], [0, 0, 1]),
};

/**
 * Bone-attachment helper:
 * 1) Finds the 11 key Mixamo bones (Hips, Spine2, Head, LeftArm, LeftForeArm, RightArm,
 *    RightForeArm, LeftUpLeg, LeftLeg, RightUpLeg, RightLeg).
 * 2) Hides Mixamo's placeholder Beta_Surface/Beta_Joints skinned meshes.
 * 3) Creates scale-compensated (1 / 0.01 = 100) and rest-pose orientation-aligned wrappers
 *    directly on each animated Mixamo bone and attaches fighter segment meshes.
 */
export function attachSegmentsToMixamoBones(
  skeletonRoot: THREE.Object3D,
  segments: Partial<Record<MixamoKeyBoneName, THREE.Object3D>>,
  options: BoneAttachmentOptions = {},
): MixamoBoneAttachments {
  const mixamoScale = options.mixamoScale ?? MIXAMO_SCALE;
  skeletonRoot.scale.setScalar(mixamoScale);
  skeletonRoot.position.set(0, 0, 0);
  skeletonRoot.rotation.set(0, 0, 0);
  skeletonRoot.updateMatrixWorld(true);

  skeletonRoot.traverse((child) => {
    const maybeMesh = child as THREE.Mesh;
    if (maybeMesh.isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
      maybeMesh.visible = false;
    }
  });

  const bones: Partial<Record<MixamoKeyBoneName, THREE.Object3D>> = {};
  const wrappers: Partial<Record<MixamoKeyBoneName, THREE.Group>> = {};
  const anchors: Partial<Record<MixamoKeyBoneName, THREE.Group>> = {};

  const invScale = 1 / mixamoScale;
  const boneWorldQ = new THREE.Quaternion();

  for (const key of MIXAMO_KEY_BONE_NAMES) {
    const bone = findMixamoBone(skeletonRoot, key);
    if (!bone) continue;
    bones[key] = bone;

    bone.getWorldQuaternion(boneWorldQ);
    const offsetQuat = boneWorldQ
      .clone()
      .invert()
      .multiply(DESIRED_WORLD_BASIS[key]);

    const wrapper = new THREE.Group();
    wrapper.name = `mixamoAttach_${key}`;
    wrapper.quaternion.copy(offsetQuat);
    wrapper.scale.setScalar(invScale);
    bone.add(wrapper);

    const anchor = new THREE.Group();
    anchor.name = `mixamoAnchor_${key}`;
    const posOffset = options.offsets?.[key];
    if (posOffset) {
      anchor.position.set(posOffset[0], posOffset[1], posOffset[2]);
    }
    const segScale = options.scales?.[key];
    if (segScale) {
      anchor.scale.set(segScale[0], segScale[1], segScale[2]);
    }
    wrapper.add(anchor);

    const segment = segments[key];
    if (segment) {
      segment.position.set(0, 0, 0);
      segment.rotation.set(0, 0, 0);
      anchor.add(segment);
    }

    wrappers[key] = wrapper;
    anchors[key] = anchor;
  }

  return { bones, wrappers, anchors };
}

let cachedBundlePromise: Promise<MixamoClipBundle | null> | null = null;
let resolvedBundle: MixamoClipBundle | null = null;

async function loadFbxWithFallback(
  loader: FBXLoader,
  primaryUrl: string,
  fallbackUrl: string,
): Promise<THREE.Group | null> {
  try {
    return await loader.loadAsync(primaryUrl);
  } catch {
    try {
      return await loader.loadAsync(fallbackUrl);
    } catch {
      return null;
    }
  }
}

export function getResolvedMixamoBundle(): MixamoClipBundle | null {
  return resolvedBundle;
}

export function preloadMixamoAnimations(): Promise<MixamoClipBundle | null> {
  if (resolvedBundle) return Promise.resolve(resolvedBundle);
  if (cachedBundlePromise) return cachedBundlePromise;

  const loader = new FBXLoader();
  cachedBundlePromise = (async () => {
    try {
      const keys = Object.keys(MIXAMO_ANIMATION_SOURCES) as MixamoClipKey[];
      const loadedEntries = await Promise.all(
        keys.map(async (k) => {
          const src = MIXAMO_ANIMATION_SOURCES[k];
          const fbx = await loadFbxWithFallback(loader, src.cdnUrl, src.localUrl);
          return [k, fbx, src] as const;
        }),
      );

      let templateRoot: THREE.Group | null = null;
      const clips: Record<MixamoClipKey, THREE.AnimationClip | null> = {
        jabPunch: null,
        hookPunch: null,
        walkNeutral: null,
        walkGuard: null,
        mmaKick: null,
        knockedOut: null,
      };

      for (const [key, fbx, src] of loadedEntries) {
        if (!fbx) continue;
        if (!templateRoot) {
          templateRoot = fbx;
        }
        clips[key] = extractActiveMixamoClip(fbx, src.clipName, Boolean(src.inPlace));
      }

      if (!templateRoot) return null;

      templateRoot.scale.setScalar(MIXAMO_SCALE);
      templateRoot.updateMatrixWorld(true);

      const bundle: MixamoClipBundle = {
        templateRoot,
        clips,
      };
      resolvedBundle = bundle;
      return bundle;
    } catch {
      return null;
    }
  })();

  return cachedBundlePromise;
}

/**
 * Instantiates a cloned Mixamo skeleton (scale = 0.01) + AnimationMixer bound to all 6 clips
 * (Jab Punch, Neutral Walking, Walking with Guard Up, Knocked Out, Hook Punch, MMA Kick).
 */
export function createMixamoRigController(
  bundle: MixamoClipBundle,
  options: BoneAttachmentOptions = {},
): MixamoRigController {
  const skeletonRoot = cloneSkinnedHierarchy(bundle.templateRoot) as THREE.Group;
  skeletonRoot.visible = false;

  const attachments = attachSegmentsToMixamoBones(skeletonRoot, {}, options);
  const mixer = new THREE.AnimationMixer(skeletonRoot);

  const actions: Record<MixamoClipKey, THREE.AnimationAction | null> = {
    jabPunch: bundle.clips.jabPunch ? mixer.clipAction(bundle.clips.jabPunch) : null,
    hookPunch: bundle.clips.hookPunch ? mixer.clipAction(bundle.clips.hookPunch) : null,
    walkNeutral: bundle.clips.walkNeutral ? mixer.clipAction(bundle.clips.walkNeutral) : null,
    walkGuard: bundle.clips.walkGuard ? mixer.clipAction(bundle.clips.walkGuard) : null,
    mmaKick: bundle.clips.mmaKick ? mixer.clipAction(bundle.clips.mmaKick) : null,
    knockedOut: bundle.clips.knockedOut ? mixer.clipAction(bundle.clips.knockedOut) : null,
  };

  for (const key of ['jabPunch', 'hookPunch', 'mmaKick', 'knockedOut'] as const) {
    const a = actions[key];
    if (a) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
  }
  for (const key of ['walkNeutral', 'walkGuard'] as const) {
    const a = actions[key];
    if (a) {
      a.setLoop(THREE.LoopRepeat, Infinity);
    }
  }

  const transitionToOneShot = (
    key: MixamoClipKey,
    startTime: number,
    timeScale: number,
  ) => {
    const next = actions[key];
    if (!next) return;
    const prevKey = controller.activeMode;
    const prev = prevKey !== 'none' && prevKey !== key ? actions[prevKey] : null;

    controller.activeMode = key;
    skeletonRoot.visible = true;

    next.reset();
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    next.time = startTime;
    next.timeScale = timeScale;
    next.setEffectiveWeight(1);
    if (prev && prev !== next) {
      prev.fadeOut(0.06);
      next.fadeIn(0.06).play();
    } else {
      for (const k of Object.keys(actions) as MixamoClipKey[]) {
        if (k !== key) actions[k]?.stop();
      }
      next.play();
    }
    mixer.update(0);
  };

  const transitionToLoop = (key: 'walkNeutral' | 'walkGuard', timeScale: number) => {
    const next = actions[key];
    if (!next) return;
    skeletonRoot.visible = true;

    if (controller.activeMode === key && next.isRunning()) {
      next.timeScale = timeScale;
      return;
    }

    const prevKey = controller.activeMode;
    const prev = prevKey !== 'none' && prevKey !== key ? actions[prevKey] : null;
    controller.activeMode = key;

    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.timeScale = timeScale;
    next.setEffectiveWeight(1);

    if (prev && prev !== next) {
      prev.crossFadeTo(next, 0.12, false);
      next.play();
    } else {
      for (const k of Object.keys(actions) as MixamoClipKey[]) {
        if (k !== key) actions[k]?.stop();
      }
      next.fadeIn(0.1).play();
    }
    mixer.update(0);
  };

  const controller: MixamoRigController = {
    skeletonRoot,
    mixer,
    actions,
    kickAction: actions.mmaKick,
    koAction: actions.knockedOut,
    attachments,
    activeMode: 'none',
    triggerJabPunch(strikeDurationSec: number) {
      const clipDur = bundle.clips.jabPunch?.duration ?? 1.07;
      transitionToOneShot(
        'jabPunch',
        0.04,
        (clipDur - 0.08) / Math.max(0.24, strikeDurationSec),
      );
    },
    triggerHookPunch(strikeDurationSec: number) {
      const clipDur = bundle.clips.hookPunch?.duration ?? 1.03;
      transitionToOneShot(
        'hookPunch',
        0.04,
        (clipDur - 0.08) / Math.max(0.28, strikeDurationSec),
      );
    },
    triggerMmaKick(strikeDurationSec: number) {
      transitionToOneShot(
        'mmaKick',
        0.08,
        1.5 / Math.max(0.35, strikeDurationSec),
      );
    },
    triggerKnockedOut() {
      transitionToOneShot('knockedOut', 1.25, 1.18);
    },
    playWalkNeutral(speedScale = 1) {
      transitionToLoop('walkNeutral', speedScale);
    },
    playWalkGuard(speedScale = 1) {
      transitionToLoop('walkGuard', speedScale);
    },
    stop() {
      controller.activeMode = 'none';
      for (const k of Object.keys(actions) as MixamoClipKey[]) {
        actions[k]?.stop();
      }
      skeletonRoot.visible = false;
    },
    update(dt: number) {
      if (controller.activeMode === 'none') return;
      mixer.update(dt);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(skeletonRoot);
    },
  };

  return controller;
}

// ============================================================================
// Conor McGregor Full 3D Character Model (ConorMcgregr.fbx) Auto-Rigging & Skinned Binding
// ============================================================================

export const CONOR_MODEL_SOURCE = {
  cdnUrl: 'https://cdn.jsdelivr.net/gh/portasd/AnimationsOFC6@main/ConorMcgregr.fbx',
  localUrl: '/assets/models/ConorMcgregr.fbx',
  meterScale: 0.01809,
} as const;

const CONOR_SKIN_BONE_NAMES = [
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Neck',
  'Head',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
] as const;

type ConorSkinBoneName = (typeof CONOR_SKIN_BONE_NAMES)[number];

export interface ConorModelTemplate {
  geometry: THREE.BufferGeometry;
  materials: THREE.MeshStandardMaterial[];
  textures: THREE.Texture[];
  skinComputed: boolean;
}

export interface ConorMixamoController extends MixamoRigController {
  displayRoot: THREE.Group;
  skinnedMesh: THREE.SkinnedMesh;
  flashMaterials: THREE.MeshStandardMaterial[];
  headBone: THREE.Object3D | null;
  neckBone: THREE.Object3D | null;
  hipsBone: THREE.Object3D | null;
}

let cachedConorPromise: Promise<ConorModelTemplate | null> | null = null;
let resolvedConorModel: ConorModelTemplate | null = null;

export function getResolvedConorModel(): ConorModelTemplate | null {
  return resolvedConorModel;
}

function clampVal(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lerpVal(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstepVal(edge0: number, edge1: number, x: number): number {
  const t = clampVal((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function findNamedMixamoBone(root: THREE.Object3D, key: string): THREE.Bone | null {
  for (const cand of [`mixamorig${key}`, `mixamorig:${key}`, key]) {
    const found = root.getObjectByName(cand);
    if (found) return found as THREE.Bone;
  }
  return null;
}

function alignBoneChainToConorAPose(
  holderRoot: THREE.Object3D,
  bones: THREE.Bone[],
  boneIdx: Record<ConorSkinBoneName, number>,
): void {
  const pb = new THREE.Vector3();
  const pc = new THREE.Vector3();
  const curDir = new THREE.Vector3();
  const desDir = new THREE.Vector3();
  const qDelta = new THREE.Quaternion();
  const qWorld = new THREE.Quaternion();
  const qParent = new THREE.Quaternion();

  const alignToward = (
    boneName: ConorSkinBoneName,
    childName: ConorSkinBoneName,
    targetX: number,
    targetY: number,
    targetZ: number,
  ) => {
    holderRoot.updateMatrixWorld(true);
    const bone = bones[boneIdx[boneName]];
    const child = bones[boneIdx[childName]];
    if (!bone || !child || !bone.parent) return;

    bone.getWorldPosition(pb);
    child.getWorldPosition(pc);
    curDir.copy(pc).sub(pb).normalize();
    desDir.set(targetX, targetY, targetZ).sub(pb).normalize();
    qDelta.setFromUnitVectors(curDir, desDir);

    bone.getWorldQuaternion(qWorld);
    bone.parent.getWorldQuaternion(qParent);
    bone.quaternion.copy(qParent.invert().multiply(qDelta.multiply(qWorld)));
    holderRoot.updateMatrixWorld(true);
  };

  // Match ConorMcgregr.fbx's relaxed A-pose arms and 6-degree wide fighting stance legs
  alignToward('LeftArm', 'LeftForeArm', 0.295, 1.13, -0.066);
  alignToward('LeftForeArm', 'LeftHand', 0.323, 0.85, 0.115);
  alignToward('RightArm', 'RightForeArm', -0.285, 1.13, -0.055);
  alignToward('RightForeArm', 'RightHand', -0.325, 0.85, 0.115);
  alignToward('LeftUpLeg', 'LeftLeg', 0.144, 0.52, -0.03);
  alignToward('LeftLeg', 'LeftFoot', 0.173, 0.095, -0.061);
  alignToward('RightUpLeg', 'RightLeg', -0.138, 0.52, -0.035);
  alignToward('RightLeg', 'RightFoot', -0.172, 0.096, -0.064);
}

function buildConorSkinningAttributes(
  geometry: THREE.BufferGeometry,
  bones: THREE.Bone[],
  boneIdx: Record<ConorSkinBoneName, number>,
): void {
  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const vCount = posAttr.count;
  const numBones = bones.length;

  const pLSh = new THREE.Vector3();
  const pLEl = new THREE.Vector3();
  const pLWr = new THREE.Vector3(0.323, 0.85, 0.115);
  const pRSh = new THREE.Vector3();
  const pREl = new THREE.Vector3();
  const pRWr = new THREE.Vector3(-0.325, 0.85, 0.115);

  bones[boneIdx.LeftArm].getWorldPosition(pLSh);
  bones[boneIdx.LeftForeArm].getWorldPosition(pLEl);
  bones[boneIdx.RightArm].getWorldPosition(pRSh);
  bones[boneIdx.RightForeArm].getWorldPosition(pREl);

  const armSplitX = (y: number) => {
    if (y < 1.0) return 0.235;
    if (y < 1.2) return lerpVal(0.235, 0.208, (y - 1.0) / 0.2);
    return 0.208;
  };

  const ab = new THREE.Vector3();
  const diff = new THREE.Vector3();
  const projectParam = (v: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
    ab.copy(b).sub(a);
    return diff.copy(v).sub(a).dot(ab) / (ab.lengthSq() || 1);
  };

  // Weld coincident triangle corners while separating air-gapped hanging lower arms
  // from torso so topological weight smoothing never bridges across open space.
  const vertToUnique = new Int32Array(vCount);
  const keyToUnique = new Map<string, number>();
  const uPos: number[] = [];
  const uArmSide: number[] = [];

  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const cent = new THREE.Vector3();

  for (let t = 0; t < vCount; t += 3) {
    va.fromBufferAttribute(posAttr, t);
    vb.fromBufferAttribute(posAttr, t + 1);
    vc.fromBufferAttribute(posAttr, t + 2);
    cent.copy(va).add(vb).add(vc).multiplyScalar(1 / 3);

    let armSide = 0;
    if (cent.y >= 0.65 && cent.y < 1.2) {
      const cut = armSplitX(cent.y);
      if (cent.x > cut) armSide = 1;
      else if (cent.x < -cut) armSide = -1;
    }

    for (let k = 0; k < 3; k++) {
      const vi = t + k;
      const x = posAttr.getX(vi);
      const y = posAttr.getY(vi);
      const z = posAttr.getZ(vi);
      const key = `${armSide}|${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
      let uid = keyToUnique.get(key);
      if (uid === undefined) {
        uid = uArmSide.length;
        keyToUnique.set(key, uid);
        uPos.push(x, y, z);
        uArmSide.push(armSide);
      }
      vertToUnique[vi] = uid;
    }
  }

  const uCount = uArmSide.length;
  const adjSets: Set<number>[] = Array.from({ length: uCount }, () => new Set<number>());
  for (let t = 0; t < vCount; t += 3) {
    const a = vertToUnique[t];
    const b = vertToUnique[t + 1];
    const c = vertToUnique[t + 2];
    if (a !== b) {
      adjSets[a].add(b);
      adjSets[b].add(a);
    }
    if (b !== c) {
      adjSets[b].add(c);
      adjSets[c].add(b);
    }
    if (c !== a) {
      adjSets[c].add(a);
      adjSets[a].add(c);
    }
  }
  const adj = adjSets.map((s) => Array.from(s));

  let wCur = new Float32Array(uCount * numBones);
  let wNext = new Float32Array(uCount * numBones);
  const vp = new THREE.Vector3();

  const addU = (u: number, b: number, w: number) => {
    if (w > 0) wCur[u * numBones + b] += w;
  };

  for (let u = 0; u < uCount; u++) {
    const vx = uPos[u * 3];
    const vy = uPos[u * 3 + 1];
    const vz = uPos[u * 3 + 2];
    vp.set(vx, vy, vz);

    const armSide = uArmSide[u];
    const absX = Math.abs(vx);
    const isL = armSide === 1 || (armSide === 0 && vx >= 0);

    if (armSide !== 0) {
      const sh = isL ? pLSh : pRSh;
      const el = isL ? pLEl : pREl;
      const wr = isL ? pLWr : pRWr;
      const bSh = isL ? boneIdx.LeftShoulder : boneIdx.RightShoulder;
      const bArm = isL ? boneIdx.LeftArm : boneIdx.RightArm;
      const bFore = isL ? boneIdx.LeftForeArm : boneIdx.RightForeArm;
      const bHand = isL ? boneIdx.LeftHand : boneIdx.RightHand;

      const uUp = projectParam(vp, sh, el);
      const uLo = projectParam(vp, el, wr);
      if (uLo >= 0.78) {
        const blend = smoothstepVal(0.78, 1.04, uLo);
        addU(u, bHand, blend);
        addU(u, bFore, 1 - blend);
      } else if (uUp >= 0.7) {
        const blend = smoothstepVal(-0.26, 0.26, uLo);
        addU(u, bFore, blend);
        addU(u, bArm, 1 - blend);
      } else {
        const collarT = smoothstepVal(1.14, 1.22, vy);
        addU(u, bArm, 1 - collarT * 0.35);
        addU(u, bSh, collarT * 0.25);
        addU(u, boneIdx.Spine2, collarT * 0.1);
      }
    } else if (vy < 0.9) {
      const bUp = isL ? boneIdx.LeftUpLeg : boneIdx.RightUpLeg;
      const bLeg = isL ? boneIdx.LeftLeg : boneIdx.RightLeg;
      const bFoot = isL ? boneIdx.LeftFoot : boneIdx.RightFoot;

      if (vy > 0.64) {
        const wVertHip = smoothstepVal(0.7, 0.9, vy);
        const wCenterHip =
          (1 - smoothstepVal(0.03, 0.125, absX)) * smoothstepVal(0.65, 0.74, vy);
        const wHip = Math.max(wVertHip, wCenterHip);
        addU(u, boneIdx.Hips, wHip);
        addU(u, bUp, 1 - wHip);
      } else if (vy > 0.44) {
        const wLeg = 1 - smoothstepVal(0.45, 0.59, vy);
        addU(u, bLeg, wLeg);
        addU(u, bUp, 1 - wLeg);
      } else if (vy > 0.05) {
        const wFoot = 1 - smoothstepVal(0.06, 0.14, vy);
        addU(u, bFoot, wFoot);
        addU(u, bLeg, 1 - wFoot);
      } else {
        addU(u, bFoot, 1);
      }
    } else {
      const bSh = isL ? boneIdx.LeftShoulder : boneIdx.RightShoulder;
      const bArm = isL ? boneIdx.LeftArm : boneIdx.RightArm;

      const wHips = 1 - smoothstepVal(0.86, 1.05, vy);
      const wSp = smoothstepVal(0.86, 1.05, vy) * (1 - smoothstepVal(1.04, 1.21, vy));
      const wSp1 = smoothstepVal(1.04, 1.21, vy) * (1 - smoothstepVal(1.19, 1.35, vy));
      const wSp2 = smoothstepVal(1.19, 1.35, vy) * (1 - smoothstepVal(1.42, 1.54, vy));
      const wNeck = smoothstepVal(1.42, 1.54, vy) * (1 - smoothstepVal(1.52, 1.62, vy));
      const wHead = smoothstepVal(1.52, 1.62, vy);

      const vertArmMask = smoothstepVal(1.15, 1.28, vy) * (1 - smoothstepVal(1.48, 1.56, vy));
      const wLatArm = smoothstepVal(0.16, 0.27, absX) * vertArmMask;
      const wLatSh =
        smoothstepVal(0.1, 0.19, absX) *
        (1 - smoothstepVal(0.21, 0.3, absX)) *
        vertArmMask;
      const torsoW = Math.max(0, 1 - wLatArm - wLatSh);

      addU(u, boneIdx.Hips, wHips * torsoW);
      addU(u, boneIdx.Spine, wSp * torsoW);
      addU(u, boneIdx.Spine1, wSp1 * torsoW);
      addU(u, boneIdx.Spine2, wSp2 * torsoW);
      addU(u, boneIdx.Neck, wNeck * torsoW);
      addU(u, boneIdx.Head, wHead * torsoW);
      addU(u, bSh, wLatSh);
      addU(u, bArm, wLatArm);
    }
  }

  for (let u = 0; u < uCount; u++) {
    let s = 0;
    for (let b = 0; b < numBones; b++) s += wCur[u * numBones + b];
    if (s > 0) {
      for (let b = 0; b < numBones; b++) wCur[u * numBones + b] /= s;
    } else {
      wCur[u * numBones] = 1;
    }
  }

  // Smooth connected joint seams across welded topology without crossing air gaps
  for (let iter = 0; iter < 10; iter++) {
    for (let u = 0; u < uCount; u++) {
      const nbrs = adj[u];
      const base = u * numBones;
      if (nbrs.length === 0) {
        for (let b = 0; b < numBones; b++) wNext[base + b] = wCur[base + b];
        continue;
      }
      const invN = 1 / nbrs.length;
      for (let b = 0; b < numBones; b++) {
        let sum = 0;
        for (let j = 0; j < nbrs.length; j++) {
          sum += wCur[nbrs[j] * numBones + b];
        }
        wNext[base + b] = wCur[base + b] * 0.4 + sum * invN * 0.6;
      }
    }
    const tmp = wCur;
    wCur = wNext;
    wNext = tmp;
  }

  const uTopIdx = new Uint16Array(uCount * 4);
  const uTopW = new Float32Array(uCount * 4);
  for (let u = 0; u < uCount; u++) {
    const base = u * numBones;
    const pairs: Array<[number, number]> = [];
    for (let b = 0; b < numBones; b++) {
      if (wCur[base + b] > 0.001) pairs.push([b, wCur[base + b]]);
    }
    pairs.sort((a, b) => b[1] - a[1]);
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      if (k < pairs.length) {
        uTopIdx[u * 4 + k] = pairs[k][0];
        uTopW[u * 4 + k] = pairs[k][1];
        sum += pairs[k][1];
      }
    }
    if (sum > 0) {
      for (let k = 0; k < 4; k++) uTopW[u * 4 + k] /= sum;
    } else {
      uTopW[u * 4] = 1;
    }
  }

  const skinIndices = new Uint16Array(vCount * 4);
  const skinWeights = new Float32Array(vCount * 4);
  for (let i = 0; i < vCount; i++) {
    const u = vertToUnique[i];
    const s = u * 4;
    const d = i * 4;
    skinIndices[d] = uTopIdx[s];
    skinIndices[d + 1] = uTopIdx[s + 1];
    skinIndices[d + 2] = uTopIdx[s + 2];
    skinIndices[d + 3] = uTopIdx[s + 3];
    skinWeights[d] = uTopW[s];
    skinWeights[d + 1] = uTopW[s + 1];
    skinWeights[d + 2] = uTopW[s + 2];
    skinWeights[d + 3] = uTopW[s + 3];
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
}

export function buildConorModelTemplateFromFbx(fbx: THREE.Group): ConorModelTemplate | null {
  fbx.updateMatrixWorld(true);
  let srcMesh: THREE.Mesh | null = null;
  fbx.traverse((child) => {
    const m = child as THREE.Mesh;
    if (m.isMesh && m.geometry && !srcMesh) {
      srcMesh = m;
    }
  });
  if (!srcMesh) return null;

  const mesh = srcMesh as THREE.Mesh;
  const geo = mesh.geometry.clone();
  const bakeMatrix = mesh.matrixWorld
    .clone()
    .premultiply(new THREE.Matrix4().makeScale(CONOR_MODEL_SOURCE.meterScale, CONOR_MODEL_SOURCE.meterScale, CONOR_MODEL_SOURCE.meterScale));
  geo.applyMatrix4(bakeMatrix);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  const srcMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const textures: THREE.Texture[] = [];
  const materials: THREE.MeshStandardMaterial[] = srcMaterials.map((srcMat) => {
    const phong = srcMat as THREE.MeshPhongMaterial & THREE.MeshStandardMaterial;
    if (phong.map) {
      phong.map.colorSpace = THREE.SRGBColorSpace;
      phong.map.anisotropy = 8;
      phong.map.needsUpdate = true;
      textures.push(phong.map);
    }
    if (phong.normalMap) {
      textures.push(phong.normalMap);
    }
    return new THREE.MeshStandardMaterial({
      name: phong.name || 'ConorMcgregorMaterial',
      map: phong.map ?? null,
      normalMap: phong.normalMap ?? null,
      normalScale: phong.normalScale ? phong.normalScale.clone() : new THREE.Vector2(1, 1),
      color: 0xffffff,
      roughness: 0.68,
      metalness: 0.04,
      envMapIntensity: 0.85,
    });
  });

  return {
    geometry: geo,
    materials,
    textures,
    skinComputed: false,
  };
}

export function preloadConorMcgregorModel(): Promise<ConorModelTemplate | null> {
  if (resolvedConorModel) return Promise.resolve(resolvedConorModel);
  if (cachedConorPromise) return cachedConorPromise;

  const loader = new FBXLoader();
  cachedConorPromise = (async () => {
    try {
      const fbx = await loadFbxWithFallback(
        loader,
        CONOR_MODEL_SOURCE.cdnUrl,
        CONOR_MODEL_SOURCE.localUrl,
      );
      if (!fbx) return null;
      const template = buildConorModelTemplateFromFbx(fbx);
      if (!template) return null;
      resolvedConorModel = template;
      return template;
    } catch {
      return null;
    }
  })();

  return cachedConorPromise;
}

/**
 * Instantiates Conor McGregor's `ConorMcgregr.fbx` character mesh skinned onto the Mixamo
 * skeleton with all 6 Mixamo animations bound cleanly (Jab Punch, Hook Punch, Neutral Walk,
 * Guard Walk, MMA Head Kick, and Knocked Out).
 */
export function createConorMixamoController(
  bundle: MixamoClipBundle,
  conorTemplate: ConorModelTemplate,
): ConorMixamoController {
  const displayRoot = new THREE.Group();
  displayRoot.name = 'ConorMcgregorDisplayRoot';

  const skeletonRoot = cloneSkinnedHierarchy(bundle.templateRoot) as THREE.Group;
  skeletonRoot.scale.setScalar(MIXAMO_SCALE);
  skeletonRoot.position.set(0, 0, 0);
  skeletonRoot.rotation.set(0, 0, 0);
  skeletonRoot.visible = true;
  skeletonRoot.traverse((child) => {
    const maybeMesh = child as THREE.Mesh;
    if (maybeMesh.isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
      maybeMesh.visible = false;
    }
  });
  displayRoot.add(skeletonRoot);

  const bones: THREE.Bone[] = [];
  const boneIdx = {} as Record<ConorSkinBoneName, number>;
  for (const name of CONOR_SKIN_BONE_NAMES) {
    const bone = findNamedMixamoBone(skeletonRoot, name);
    if (!bone) {
      throw new Error(`Missing Mixamo bone mixamorig${name} for Conor McGregor rig`);
    }
    boneIdx[name] = bones.length;
    bones.push(bone);
  }

  // Align the cloned Mixamo skeleton to Conor's A-pose BEFORE calculating bind inverses
  alignBoneChainToConorAPose(displayRoot, bones, boneIdx);

  if (!conorTemplate.skinComputed) {
    buildConorSkinningAttributes(conorTemplate.geometry, bones, boneIdx);
    conorTemplate.skinComputed = true;
  }

  const instanceMaterials = conorTemplate.materials.map((m) => m.clone());
  const meshMat: THREE.Material | THREE.Material[] =
    instanceMaterials.length === 1 ? instanceMaterials[0] : instanceMaterials;

  const skinnedMesh = new THREE.SkinnedMesh(conorTemplate.geometry, meshMat);
  skinnedMesh.name = 'ConorMcgregorSkinnedMesh';
  skinnedMesh.castShadow = true;
  skinnedMesh.receiveShadow = true;
  skinnedMesh.frustumCulled = false;
  displayRoot.add(skinnedMesh);

  displayRoot.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skinnedMesh.bind(skeleton, skinnedMesh.matrixWorld);

  const mixer = new THREE.AnimationMixer(skeletonRoot);
  const actions: Record<MixamoClipKey, THREE.AnimationAction | null> = {
    jabPunch: bundle.clips.jabPunch ? mixer.clipAction(bundle.clips.jabPunch) : null,
    hookPunch: bundle.clips.hookPunch ? mixer.clipAction(bundle.clips.hookPunch) : null,
    walkNeutral: bundle.clips.walkNeutral ? mixer.clipAction(bundle.clips.walkNeutral) : null,
    walkGuard: bundle.clips.walkGuard ? mixer.clipAction(bundle.clips.walkGuard) : null,
    mmaKick: bundle.clips.mmaKick ? mixer.clipAction(bundle.clips.mmaKick) : null,
    knockedOut: bundle.clips.knockedOut ? mixer.clipAction(bundle.clips.knockedOut) : null,
  };

  for (const key of ['jabPunch', 'hookPunch', 'mmaKick', 'knockedOut'] as const) {
    const a = actions[key];
    if (a) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
  }
  for (const key of ['walkNeutral', 'walkGuard'] as const) {
    const a = actions[key];
    if (a) {
      a.setLoop(THREE.LoopRepeat, Infinity);
    }
  }

  const keyBones: Partial<Record<MixamoKeyBoneName, THREE.Object3D>> = {};
  for (const k of MIXAMO_KEY_BONE_NAMES) {
    const b = findMixamoBone(skeletonRoot, k);
    if (b) keyBones[k] = b;
  }
  const headBone = findNamedMixamoBone(skeletonRoot, 'Head');
  const neckBone = findNamedMixamoBone(skeletonRoot, 'Neck');
  const hipsBone = findNamedMixamoBone(skeletonRoot, 'Hips');

  const transitionToOneShot = (
    key: MixamoClipKey,
    startTime: number,
    timeScale: number,
  ) => {
    const next = actions[key];
    if (!next) return;
    const prevKey = controller.activeMode;
    const prev = prevKey !== 'none' && prevKey !== key ? actions[prevKey] : null;

    controller.activeMode = key;
    displayRoot.visible = true;

    next.reset();
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    next.time = startTime;
    next.timeScale = timeScale;
    next.setEffectiveWeight(1);
    if (prev && prev !== next) {
      prev.fadeOut(0.06);
      next.fadeIn(0.06).play();
    } else {
      for (const k of Object.keys(actions) as MixamoClipKey[]) {
        if (k !== key) actions[k]?.stop();
      }
      next.play();
    }
    mixer.update(0);
  };

  const transitionToLoop = (key: 'walkNeutral' | 'walkGuard', timeScale: number) => {
    const next = actions[key];
    if (!next) return;
    displayRoot.visible = true;

    if (controller.activeMode === key && next.isRunning()) {
      next.timeScale = timeScale;
      return;
    }

    const prevKey = controller.activeMode;
    const prev = prevKey !== 'none' && prevKey !== key ? actions[prevKey] : null;
    controller.activeMode = key;

    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.timeScale = timeScale;
    next.setEffectiveWeight(1);

    if (prev && prev !== next) {
      prev.crossFadeTo(next, 0.12, false);
      next.play();
    } else {
      for (const k of Object.keys(actions) as MixamoClipKey[]) {
        if (k !== key) actions[k]?.stop();
      }
      next.fadeIn(0.1).play();
    }
    mixer.update(0);
  };

  const controller: ConorMixamoController = {
    displayRoot,
    skinnedMesh,
    flashMaterials: instanceMaterials,
    headBone,
    neckBone,
    hipsBone,
    skeletonRoot,
    mixer,
    actions,
    kickAction: actions.mmaKick,
    koAction: actions.knockedOut,
    attachments: { bones: keyBones, wrappers: {}, anchors: {} },
    activeMode: 'none',
    triggerJabPunch(strikeDurationSec: number) {
      const clipDur = bundle.clips.jabPunch?.duration ?? 1.07;
      transitionToOneShot(
        'jabPunch',
        0.04,
        (clipDur - 0.08) / Math.max(0.24, strikeDurationSec),
      );
    },
    triggerHookPunch(strikeDurationSec: number) {
      const clipDur = bundle.clips.hookPunch?.duration ?? 1.03;
      transitionToOneShot(
        'hookPunch',
        0.04,
        (clipDur - 0.08) / Math.max(0.28, strikeDurationSec),
      );
    },
    triggerMmaKick(strikeDurationSec: number) {
      transitionToOneShot(
        'mmaKick',
        0.08,
        1.5 / Math.max(0.35, strikeDurationSec),
      );
    },
    triggerKnockedOut() {
      transitionToOneShot('knockedOut', 1.25, 1.18);
    },
    playWalkNeutral(speedScale = 1) {
      transitionToLoop('walkNeutral', speedScale);
    },
    playWalkGuard(speedScale = 1) {
      transitionToLoop('walkGuard', speedScale);
    },
    stop() {
      controller.activeMode = 'none';
      for (const k of Object.keys(actions) as MixamoClipKey[]) {
        actions[k]?.stop();
      }
      displayRoot.visible = false;
    },
    update(dt: number) {
      if (controller.activeMode === 'none') return;
      mixer.update(dt);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(skeletonRoot);
      for (const mat of instanceMaterials) {
        mat.dispose();
      }
    },
  };

  // Enter standing guard pose immediately on bind so frame 1 never shows raw rest pose
  controller.playWalkGuard(0.18);
  return controller;
}

