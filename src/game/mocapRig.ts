import * as THREE from 'three';
import { FighterState } from './combatEngine';
import {
  clonePose,
  createZeroPose,
  getBlockPose,
  getIdleGuardPose,
  getKnockdownPose,
  getKnockoutPose,
  getStrikeKeyframePose,
  PoseAngles,
} from './fighterAnimations';
import {
  BeardModelShape,
  FaceLikenessProfile,
  FighterProfile,
  HairModelStyle,
} from './fighters';
import {
  BoneAttachmentOptions,
  createConorMixamoController,
  createMixamoRigController,
  getResolvedConorModel,
  getResolvedMixamoBundle,
  MixamoActionKind,
  MixamoKeyBoneName,
  MixamoRigController,
} from './mixamoFbxAnimator';
import { STRIKES } from './strikes';

export interface JointMap {
  root: THREE.Group;
  pelvis: THREE.Group;
  abdomen: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  // Upper Limb Hierarchy: clavicle -> shoulderPivot -> upperArm -> elbowPivot -> forearm -> fist
  clavicleL: THREE.Group;
  shoulderPivotL: THREE.Group;
  upperArmL: THREE.Group;
  elbowPivotL: THREE.Group;
  forearmL: THREE.Group;
  fistL: THREE.Group;
  clavicleR: THREE.Group;
  shoulderPivotR: THREE.Group;
  upperArmR: THREE.Group;
  elbowPivotR: THREE.Group;
  forearmR: THREE.Group;
  fistR: THREE.Group;
  // Lower Limb Hierarchy: hipPivot -> thigh -> kneePivot -> shin -> anklePivot -> foot
  hipPivotL: THREE.Group;
  thighL: THREE.Group;
  kneePivotL: THREE.Group;
  shinL: THREE.Group;
  anklePivotL: THREE.Group;
  footL: THREE.Group;
  hipPivotR: THREE.Group;
  thighR: THREE.Group;
  kneePivotR: THREE.Group;
  shinR: THREE.Group;
  anklePivotR: THREE.Group;
  footR: THREE.Group;
  skinMaterial: THREE.MeshStandardMaterial;
  abdomenSkinMaterial: THREE.MeshStandardMaterial;
  faceMaterial: THREE.MeshStandardMaterial;
  faceBloodCanvas: HTMLCanvasElement;
  faceBloodTex: THREE.CanvasTexture;
  faceBloodMaterial: THREE.MeshStandardMaterial;
  chestBloodCanvas: HTMLCanvasElement;
  chestBloodTex: THREE.CanvasTexture;
  chestBloodMaterial: THREE.MeshStandardMaterial;
  knuckleBloodMaterial: THREE.MeshStandardMaterial;
  lastFaceBloodTier: number;
  lastChestBloodTier: number;
  lastBleedSide: number;
  shadowDisc: THREE.Mesh;
  segmentGroups: {
    hipsVisual: THREE.Group;
    abdomenVisual: THREE.Group;
    spine2Visual: THREE.Group;
    neckVisual: THREE.Group;
    headVisual: THREE.Group;
    leftArmVisual: THREE.Group;
    leftForeArmVisual: THREE.Group;
    rightArmVisual: THREE.Group;
    rightForeArmVisual: THREE.Group;
    leftUpLegVisual: THREE.Group;
    leftLegVisual: THREE.Group;
    rightUpLegVisual: THREE.Group;
    rightLegVisual: THREE.Group;
  };
  profileId: string;
  mixamo: MixamoRigController | null;
  mixamoAttached: boolean;
  customModelAttached: boolean;
  customDisplayRoot: THREE.Group | null;
  customFlashMaterials: THREE.MeshStandardMaterial[];
  customHeadBone: THREE.Object3D | null;
  customNeckBone: THREE.Object3D | null;
  customHipsBone: THREE.Object3D | null;
  customHeadHidden: boolean;
  lastMixamoStrikeId: string | null;
  lastMixamoActionTime: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

let cachedSoftShadowTex: THREE.CanvasTexture | null = null;
let cachedSkinBumpTex: THREE.CanvasTexture | null = null;
const _mixamoShadowVec = new THREE.Vector3();

interface LoadedFacePhoto {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  faceCenterX: number;
  eyesY: number;
  mouthY: number;
  leftEdge: Float32Array;
  rightEdge: Float32Array;
  cheekR: number;
  cheekG: number;
  cheekB: number;
}

const facePhotoPromiseCache = new Map<string, Promise<LoadedFacePhoto | null>>();
const facePhotoResolvedCache = new Map<string, LoadedFacePhoto | null>();

export function getFighterFaceModelUrl(profile: FighterProfile): string {
  return `/assets/faces/${profile.id}.png`;
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return [214, 168, 140];
  const n = parseInt(clean, 16);
  if (!Number.isFinite(n)) return [214, 168, 140];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function analyzeLoadedFaceImage(img: HTMLImageElement): LoadedFacePhoto | null {
  if (typeof document === 'undefined') return null;
  const w = img.naturalWidth || 600;
  const h = img.naturalHeight || 436;
  if (w < 16 || h < 16) return null;

  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext('2d');
  if (!sctx) return null;
  sctx.clearRect(0, 0, w, h);
  sctx.drawImage(img, 0, 0, w, h);
  const { data } = sctx.getImageData(0, 0, w, h);

  // Locate horizontal center from jaw silhouette below ears
  let centerSum = 0;
  let centerCount = 0;
  const xStart = Math.round(w * 0.28);
  const xEnd = Math.round(w * 0.72);
  for (let y = Math.round(h * 0.53); y <= Math.round(h * 0.61); y++) {
    let minX = w;
    let maxX = 0;
    for (let x = xStart; x < xEnd; x++) {
      if (data[(y * w + x) * 4 + 3] > 180) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    if (maxX > minX + 40) {
      centerSum += (minX + maxX) * 0.5;
      centerCount++;
    }
  }
  const faceCenterX =
    centerCount > 0
      ? clamp(centerSum / centerCount, w * 0.47, w * 0.53)
      : w * 0.5;

  const lumAt = (px: number, py: number) => {
    const cx = clamp(Math.round(px), 0, w - 1);
    const cy = clamp(Math.round(py), 0, h - 1);
    const idx = (cy * w + cx) * 4;
    return data[idx] * 0.3 + data[idx + 1] * 0.59 + data[idx + 2] * 0.11;
  };

  // Detect eye line y below brow ridge (~35.8%..40.5% height)
  let eyesY = h * 0.381;
  let minEyeBandLum = 999;
  for (let y = Math.round(h * 0.358); y <= Math.round(h * 0.405); y++) {
    let sum = 0;
    let cnt = 0;
    for (const dx of [-37, -34, -31, 31, 34, 37]) {
      sum += lumAt(faceCenterX + dx * (w / 600), y);
      cnt++;
    }
    const avg = sum / cnt;
    if (avg < minEyeBandLum) {
      minEyeBandLum = avg;
      eyesY = y;
    }
  }
  eyesY = clamp(eyesY, h * 0.358, h * 0.405);

  // Detect lip crease row below nose
  let mouthY = eyesY + h * 0.172;
  let bestMouthScore = -999;
  const mouthLo = Math.round(eyesY + h * 0.145);
  const mouthHi = Math.round(eyesY + h * 0.195);
  for (let y = mouthLo; y <= mouthHi; y++) {
    let midSum = 0;
    let rimSum = 0;
    let cnt = 0;
    for (let dx = -16; dx <= 16; dx += 2) {
      const px = faceCenterX + dx * (w / 600);
      midSum += lumAt(px, y);
      rimSum += (lumAt(px, y - 4) + lumAt(px, y + 4)) * 0.5;
      cnt++;
    }
    const sc = (rimSum - midSum) / Math.max(1, cnt);
    if (sc > bestMouthScore) {
      bestMouthScore = sc;
      mouthY = y;
    }
  }
  mouthY = clamp(mouthY, eyesY + h * 0.152, eyesY + h * 0.19);

  // Record per-row inner opaque face silhouette bounds so jaw edges feather cleanly
  const leftEdge = new Float32Array(h);
  const rightEdge = new Float32Array(h);
  const maxHalfSpan = Math.round(w * 0.175);
  const scanLo = Math.max(0, Math.round(faceCenterX - maxHalfSpan));
  const scanHi = Math.min(w - 1, Math.round(faceCenterX + maxHalfSpan));

  for (let y = 0; y < h; y++) {
    let lx = faceCenterX;
    for (let x = Math.round(faceCenterX); x >= scanLo; x--) {
      if (data[(y * w + x) * 4 + 3] < 195) break;
      lx = x;
    }
    let rx = faceCenterX;
    for (let x = Math.round(faceCenterX); x <= scanHi; x++) {
      if (data[(y * w + x) * 4 + 3] < 195) break;
      rx = x;
    }
    leftEdge[y] = lx;
    rightEdge[y] = rx;
  }

  // Sample average cheek/temple skin color
  let cr = 0;
  let cg = 0;
  let cb = 0;
  let cCnt = 0;
  const cheekY0 = Math.round(eyesY + h * 0.045);
  const cheekY1 = Math.round(eyesY + h * 0.105);
  for (let y = cheekY0; y <= cheekY1; y++) {
    for (const dx of [-50, -44, 44, 50]) {
      const sx = clamp(Math.round(faceCenterX + dx * (w / 600)), 0, w - 1);
      const i = (y * w + sx) * 4;
      if (data[i + 3] > 230) {
        cr += data[i];
        cg += data[i + 1];
        cb += data[i + 2];
        cCnt++;
      }
    }
  }

  return {
    data,
    width: w,
    height: h,
    faceCenterX,
    eyesY,
    mouthY,
    leftEdge,
    rightEdge,
    cheekR: cCnt > 0 ? cr / cCnt : 210,
    cheekG: cCnt > 0 ? cg / cCnt : 155,
    cheekB: cCnt > 0 ? cb / cCnt : 132,
  };
}

function loadFighterFacePhoto(profile: FighterProfile): Promise<LoadedFacePhoto | null> {
  if (facePhotoResolvedCache.has(profile.id)) {
    return Promise.resolve(facePhotoResolvedCache.get(profile.id) ?? null);
  }
  const existing = facePhotoPromiseCache.get(profile.id);
  if (existing) return existing;

  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    facePhotoResolvedCache.set(profile.id, null);
    return Promise.resolve(null);
  }

  const promise = new Promise<LoadedFacePhoto | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const parsed = analyzeLoadedFaceImage(img);
      facePhotoResolvedCache.set(profile.id, parsed);
      resolve(parsed);
    };
    img.onerror = () => {
      facePhotoResolvedCache.set(profile.id, null);
      resolve(null);
    };
    img.src = getFighterFaceModelUrl(profile);
  });

  facePhotoPromiseCache.set(profile.id, promise);
  return promise;
}

function projectFacePhotoOntoCanvas(
  canvas: HTMLCanvasElement,
  profile: FighterProfile,
  photo: LoadedFacePhoto,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const dstImg = ctx.getImageData(0, 0, W, H);
  const dst = dstImg.data;
  const src = photo.data;
  const sw = photo.width;
  const sh = photo.height;
  const fp = resolveFaceProfile(profile);

  // Harmonize photo exposure & outer skull skin seamlessly with fighter body skin
  const [skinR, skinG, skinB] = parseHexRgb(profile.appearance.skinHex);
  const skinLum = skinR * 0.3 + skinG * 0.59 + skinB * 0.11;
  const cheekLum = Math.max(24, photo.cheekR * 0.3 + photo.cheekG * 0.59 + photo.cheekB * 0.11);
  const targetLum = lerp(cheekLum, skinLum, 0.34);
  const lumGain = clamp(targetLum / cheekLum, 0.72, 1.08);
  const edgeBaseR = lerp(photo.cheekR * lumGain, skinR, 0.28);
  const edgeBaseG = lerp(photo.cheekG * lumGain, skinG, 0.28);
  const edgeBaseB = lerp(photo.cheekB * lumGain, skinB, 0.28);

  // Subtle side-temple & lower-jaw base tint so photo fades seamlessly into ears and neck
  for (let py = 0; py < H; py++) {
    const v = 1 - (py + 0.5) / H;
    const upY = Math.cos((1 - v) * Math.PI);
    const scalpKeep = fp.hairModel === 'shaved' ? 0 : smoothstep(0.55, 0.85, upY);
    if (scalpKeep >= 0.99) continue;
    const tintW = (1 - scalpKeep) * 0.72;
    const invTint = 1 - tintW;
    for (let px = 0; px < W; px++) {
      const di = (py * W + px) * 4;
      dst[di] = Math.round(dst[di] * invTint + edgeBaseR * tintW);
      dst[di + 1] = Math.round(dst[di + 1] * invTint + edgeBaseG * tintW);
      dst[di + 2] = Math.round(dst[di + 2] * invTint + edgeBaseB * tintW);
    }
  }

  // Uniform proportional scale matching 3D sculpted head eye/nose/mouth/chin geometry
  const nyEye = 0.075;
  const nyMouth = -0.472;
  const dyPhoto = Math.max(sh * 0.145, photo.mouthY - photo.eyesY);
  const pyScale = dyPhoto / (nyEye - nyMouth);
  const pxScale = pyScale * 0.785 * clamp(fp.faceWidth, 0.92, 1.1);

  const pxLo = Math.floor(W * 0.26);
  const pxHi = Math.ceil(W * 0.74);
  const pyLo = Math.floor(H * 0.11);
  const pyHi = Math.ceil(H * 0.91);

  for (let py = pyLo; py < pyHi; py++) {
    const v = 1 - (py + 0.5) / H;
    const theta = (1 - v) * Math.PI;
    const sinT = Math.sin(theta);
    const upY = Math.cos(theta);

    const srcY = photo.eyesY + (nyEye - upY) * pyScale;
    if (srcY < 1 || srcY >= sh - 2) continue;

    // Preserve natural forehead & hairline cleanly while feathering softly at crown & under-chin
    const wTop = 1 - smoothstep(0.62, 0.88, upY);
    const wBot = smoothstep(-0.94, -0.74, upY);
    const wVert = wTop * wBot;
    if (wVert <= 0.002) continue;

    const sy0 = Math.floor(srcY);
    const sy1 = sy0 + 1;
    const ty = srcY - sy0;

    // Match 3D sculpted jawline narrowing on lower face
    const jawT = upY < 0.1 ? clamp((0.1 - upY) / 0.95, 0, 1) : 0;
    const jawScale = 1 - jawT * 0.14;
    const rowLeft = photo.leftEdge[sy0];
    const rowRight = photo.rightEdge[sy0];

    for (let px = pxLo; px < pxHi; px++) {
      const u = (px + 0.5) / W;
      const phi = u * Math.PI * 2;
      const fwdZ = -Math.cos(phi) * sinT;
      if (fwdZ <= 0.08) continue;

      const sideX = -Math.sin(phi) * sinT;
      const absSide = Math.abs(sideX);
      if (absSide >= 0.88) continue;

      const srcX = photo.faceCenterX + sideX * pxScale * jawScale;
      if (srcX < 1 || srcX >= sw - 2) continue;

      // Feather inward before reaching PNG cutout background edge
      const distFromEdge = Math.min(srcX - rowLeft, rowRight - srcX);
      if (distFromEdge <= 0) continue;
      const wEdge = smoothstep(0, 10, distFromEdge);

      const sx0 = Math.floor(srcX);
      const sx1 = sx0 + 1;
      const tx = srcX - sx0;

      const i00 = (sy0 * sw + sx0) * 4;
      const i10 = (sy0 * sw + sx1) * 4;
      const i01 = (sy1 * sw + sx0) * 4;
      const i11 = (sy1 * sw + sx1) * 4;

      const w00 = (1 - tx) * (1 - ty);
      const w10 = tx * (1 - ty);
      const w01 = (1 - tx) * ty;
      const w11 = tx * ty;

      const a =
        src[i00 + 3] * w00 + src[i10 + 3] * w10 + src[i01 + 3] * w01 + src[i11 + 3] * w11;
      if (a < 150) continue;

      const wSide = 1 - smoothstep(0.66, 0.88, absSide);
      const wFwd = smoothstep(0.1, 0.34, fwdZ);
      const wAlpha = smoothstep(150, 240, a);
      const mix = wVert * wSide * wFwd * wAlpha * wEdge;
      if (mix <= 0.004) continue;

      const r = clamp((src[i00] * w00 + src[i10] * w10 + src[i01] * w01 + src[i11] * w11) * lumGain, 0, 255);
      const g = clamp((src[i00 + 1] * w00 + src[i10 + 1] * w10 + src[i01 + 1] * w01 + src[i11 + 1] * w11) * lumGain, 0, 255);
      const b = clamp((src[i00 + 2] * w00 + src[i10 + 2] * w10 + src[i01 + 2] * w01 + src[i11 + 2] * w11) * lumGain, 0, 255);

      const di = (py * W + px) * 4;
      const inv = 1 - mix;
      dst[di] = Math.round(dst[di] * inv + r * mix);
      dst[di + 1] = Math.round(dst[di + 1] * inv + g * mix);
      dst[di + 2] = Math.round(dst[di + 2] * inv + b * mix);
      dst[di + 3] = 255;
    }
  }

  ctx.putImageData(dstImg, 0, 0);
}

function createSoftShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(6, 7, 10, 0.58)');
  grad.addColorStop(0.55, 'rgba(6, 7, 10, 0.22)');
  grad.addColorStop(1, 'rgba(6, 7, 10, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createSkinBumpTexture(): THREE.CanvasTexture {
  if (cachedSkinBumpTex) return cachedSkinBumpTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(256, 256);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const px = i / 4;
    const n =
      ((Math.sin(px * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const v = Math.floor(118 + n * 24);
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.needsUpdate = true;
  cachedSkinBumpTex = tex;
  return tex;
}

function createDropletTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255, 248, 225, 1)');
  grad.addColorStop(0.5, 'rgba(255, 232, 185, 0.7)');
  grad.addColorStop(1, 'rgba(255, 220, 160, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createBloodDropletTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(16, 16, 2, 16, 16, 15);
  grad.addColorStop(0, 'rgba(195, 18, 18, 0.98)');
  grad.addColorStop(0.5, 'rgba(135, 8, 8, 0.9)');
  grad.addColorStop(0.82, 'rgba(92, 4, 4, 0.45)');
  grad.addColorStop(1, 'rgba(65, 2, 2, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function paintFaceBloodCanvas(
  canvas: HTMLCanvasElement,
  tier: number,
  bleedSide: -1 | 0 | 1,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (tier <= 0) return;

  const s = canvas.width / 512;
  ctx.save();
  ctx.scale(s, s);
  const side = bleedSide === 0 ? -1 : bleedSide;
  const primaryBrowX = side < 0 ? 222 : 290;
  const secondaryBrowX = side < 0 ? 290 : 222;

  // Tier 1+: Redness, bruised eye socket & cheekbone abrasion
  const bruiseAlpha = Math.min(0.62, 0.18 + tier * 0.1);
  const eyeBruise = ctx.createRadialGradient(primaryBrowX, 245, 4, primaryBrowX, 248, 30);
  eyeBruise.addColorStop(0, `rgba(115, 14, 24, ${bruiseAlpha})`);
  eyeBruise.addColorStop(0.6, `rgba(92, 18, 32, ${bruiseAlpha * 0.55})`);
  eyeBruise.addColorStop(1, 'rgba(80, 10, 14, 0)');
  ctx.fillStyle = eyeBruise;
  ctx.beginPath();
  ctx.arc(primaryBrowX, 248, 30, 0, Math.PI * 2);
  ctx.fill();

  // Brow laceration gash
  ctx.strokeStyle = 'rgba(130, 6, 8, 0.92)';
  ctx.lineWidth = 2.6 + tier * 0.65;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(primaryBrowX - 15, 222);
  ctx.quadraticCurveTo(primaryBrowX, 217, primaryBrowX + 14, 224);
  ctx.stroke();

  // Tier 2+: Open brow blood trickling down beside eye and cheek + split lip
  if (tier >= 2) {
    ctx.strokeStyle = 'rgba(148, 10, 10, 0.88)';
    ctx.lineWidth = 2.4 + tier * 0.35;
    ctx.beginPath();
    ctx.moveTo(primaryBrowX + side * 6, 224);
    ctx.quadraticCurveTo(primaryBrowX + side * 14, 254, primaryBrowX + side * 11, 294 + tier * 8);
    ctx.stroke();

    // Split lip blood
    ctx.fillStyle = 'rgba(138, 8, 10, 0.84)';
    ctx.beginPath();
    ctx.ellipse(256 + side * 8, 315, 7, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tier 3+: Active nosebleed + blood trails running down philtrum and chin
  if (tier >= 3) {
    ctx.fillStyle = 'rgba(155, 8, 8, 0.85)';
    ctx.beginPath();
    ctx.ellipse(256, 288, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(132, 6, 8, 0.88)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(253, 288);
    ctx.quadraticCurveTo(251, 308, 252, 336);
    ctx.moveTo(259, 288);
    ctx.quadraticCurveTo(261, 312, 260, 344);
    ctx.stroke();

    // Cheek smear
    const smear = ctx.createRadialGradient(primaryBrowX + side * 8, 276, 2, primaryBrowX + side * 8, 276, 24);
    smear.addColorStop(0, 'rgba(145, 10, 10, 0.56)');
    smear.addColorStop(1, 'rgba(120, 8, 8, 0)');
    ctx.fillStyle = smear;
    ctx.beginPath();
    ctx.arc(primaryBrowX + side * 8, 276, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tier 4+: Secondary brow split & dark crimson cheek/jaw mask
  if (tier >= 4) {
    const oppBruise = ctx.createRadialGradient(secondaryBrowX, 246, 4, secondaryBrowX, 248, 26);
    oppBruise.addColorStop(0, 'rgba(110, 14, 22, 0.55)');
    oppBruise.addColorStop(1, 'rgba(80, 10, 14, 0)');
    ctx.fillStyle = oppBruise;
    ctx.beginPath();
    ctx.arc(secondaryBrowX, 248, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(128, 6, 8, 0.9)';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(secondaryBrowX - 11, 222);
    ctx.lineTo(secondaryBrowX + 12, 225);
    ctx.moveTo(secondaryBrowX, 225);
    ctx.quadraticCurveTo(secondaryBrowX - side * 6, 256, secondaryBrowX - side * 4, 298);
    ctx.stroke();

    // Heavy chin/jaw streaks
    ctx.strokeStyle = 'rgba(120, 5, 7, 0.86)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(246, 318);
    ctx.lineTo(243, 372);
    ctx.moveTo(265, 318);
    ctx.lineTo(269, 368);
    ctx.stroke();
  }

  // Tier 5: Severe crimson mask across bridge of nose, mouth & jaw
  if (tier >= 5) {
    const mask = ctx.createRadialGradient(256, 286, 12, 256, 286, 68);
    mask.addColorStop(0, 'rgba(132, 6, 8, 0.62)');
    mask.addColorStop(0.55, 'rgba(112, 6, 8, 0.34)');
    mask.addColorStop(1, 'rgba(95, 4, 4, 0)');
    ctx.fillStyle = mask;
    ctx.fillRect(184, 210, 144, 175);
  }

  ctx.restore();
}

function paintChestBloodCanvas(
  canvas: HTMLCanvasElement,
  headTier: number,
  bodyTier: number,
  bleedSide: -1 | 0 | 1,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (headTier <= 0 && bodyTier <= 0) return;

  const s = canvas.width / 512;
  ctx.save();
  ctx.scale(s, s);
  const side = bleedSide === 0 ? -1 : bleedSide;

  // Body bruising/welts on ribs & obliques from body shots
  if (bodyTier >= 1) {
    const alpha = Math.min(0.54, 0.14 + bodyTier * 0.11);
    for (const [bx, by, rx, ry] of [
      [205, 295, 34, 22],
      [307, 298, 34, 22],
      [226, 345, 28, 18],
    ]) {
      const welt = ctx.createRadialGradient(bx, by, 4, bx, by, rx);
      welt.addColorStop(0, `rgba(148, 22, 34, ${alpha})`);
      welt.addColorStop(0.65, `rgba(110, 18, 42, ${alpha * 0.55})`);
      welt.addColorStop(1, 'rgba(90, 12, 24, 0)');
      ctx.fillStyle = welt;
      ctx.beginPath();
      ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Blood drips running down collarbone onto upper chest & sternum from facial cuts
  if (headTier >= 1) {
    const streams = Math.min(6, 1 + headTier);
    ctx.strokeStyle = 'rgba(136, 7, 9, 0.82)';
    ctx.lineCap = 'round';
    for (let i = 0; i < streams; i++) {
      const x0 = 256 + side * 12 + (i - streams * 0.5) * 14;
      const len = 70 + headTier * 36 + ((i * 29) % 45);
      ctx.lineWidth = 2.4 + (i % 2) * 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, 96);
      ctx.quadraticCurveTo(x0 + (i % 2 === 0 ? 5 : -5), 96 + len * 0.5, x0 + (i % 2 === 0 ? -3 : 4), 96 + len);
      ctx.stroke();
    }
    if (headTier >= 2) {
      const smear = ctx.createRadialGradient(256 + side * 14, 178, 6, 256 + side * 14, 178, 38 + headTier * 8);
      smear.addColorStop(0, 'rgba(135, 8, 10, 0.55)');
      smear.addColorStop(1, 'rgba(110, 6, 8, 0)');
      ctx.fillStyle = smear;
      ctx.beginPath();
      ctx.arc(256 + side * 14, 178, 38 + headTier * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

interface ResolvedFaceProfile {
  jawWidth: number;
  faceWidth: number;
  chinLength: number;
  browRidge: number;
  cheekHeight: number;
  noseWidth: number;
  noseLength: number;
  earSize: number;
  cauliflowerEars: boolean;
  eyeColorHex: string;
  eyebrowThickness: number;
  eyebrowArch: 'stern' | 'arched' | 'flat';
  hairModel: HairModelStyle;
  hairAccentHex: string;
  beardShape: BeardModelShape;
  beardHex: string;
  faceInk: 'none' | 'omalley' | 'hollowayTear';
  neckTattoo:
    | 'none'
    | 'oliveira'
    | 'topuriaWings'
    | 'hollowayNeck'
    | 'aspinallNeck'
    | 'omalleyNeck'
    | 'diazNeck';
}

function isBrightDyedHair(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return r + g + b > 440 || r - g > 95;
}

function resolveFaceProfile(profile: FighterProfile): ResolvedFaceProfile {
  const fp: FaceLikenessProfile = profile.appearance.faceProfile ?? {};
  const defaultHairModel: HairModelStyle =
    profile.appearance.hairStyle === 'shaved'
      ? 'shaved'
      : profile.appearance.hairStyle === 'fade'
        ? 'highFade'
        : profile.appearance.hairStyle === 'textured'
          ? 'texturedCrop'
          : 'buzz';
  const defaultBeardShape: BeardModelShape = profile.appearance.facialHair;
  const defaultNaturalHair = isBrightDyedHair(profile.appearance.hairHex)
    ? '#1f1916'
    : profile.appearance.hairHex;

  return {
    jawWidth: fp.jawWidth ?? 1.0,
    faceWidth: fp.faceWidth ?? 1.0,
    chinLength: fp.chinLength ?? 1.0,
    browRidge: fp.browRidge ?? 1.0,
    cheekHeight: fp.cheekHeight ?? 1.0,
    noseWidth: fp.noseWidth ?? 1.0,
    noseLength: fp.noseLength ?? 1.0,
    earSize: fp.earSize ?? 1.0,
    cauliflowerEars: fp.cauliflowerEars ?? false,
    eyeColorHex: fp.eyeColorHex ?? '#2b1b12',
    eyebrowThickness: fp.eyebrowThickness ?? 1.0,
    eyebrowArch: fp.eyebrowArch ?? 'flat',
    hairModel: fp.hairModel ?? defaultHairModel,
    hairAccentHex: fp.hairAccentHex ?? profile.appearance.hairHex,
    beardShape: fp.beardShape ?? defaultBeardShape,
    beardHex: fp.beardHex ?? defaultNaturalHair,
    faceInk: fp.faceInk ?? 'none',
    neckTattoo: fp.neckTattoo ?? 'none',
  };
}

function createSculptedHeadGeometry(profile: FighterProfile): THREE.BufferGeometry {
  const fp = resolveFaceProfile(profile);
  const geo = new THREE.SphereGeometry(0.106, 44, 34);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i); // +X is front face prior to -PI/2 rotY
    let y = pos.getY(i);
    let z = pos.getZ(i); // lateral left/right

    const absZ = Math.abs(z);

    // Individualized cranial height, facial width, and chin elongation
    y *= 1.12;
    if (y < 0) {
      y *= 1 + (fp.chinLength - 1) * 0.72;
    }
    z *= 0.89 * fp.faceWidth;

    // Athletic jaw width & chin contour tailored per fighter
    if (y < 0.014) {
      const jawT = clamp((0.014 - y) / 0.122, 0, 1);
      const chinRound = smoothstep(0.62, 1.0, jawT);
      const jawNarrowFactor = clamp(0.16 / Math.max(0.8, fp.jawWidth), 0.09, 0.24);
      z *= 1 - jawT * jawNarrowFactor - chinRound * 0.1;

      // Masseter / jaw corner fullness
      if (x > -0.025 && x < 0.045 && y < -0.015 && y > -0.08 && absZ > 0.034) {
        const jawCorner =
          (1 - Math.abs(y + 0.046) / 0.035) * smoothstep(0.034, 0.068, absZ);
        z += Math.sign(z) * Math.max(0, jawCorner) * 0.0095 * fp.jawWidth;
      }

      // Forward chin eminence + labiomental cleft below lower lip (aligned to human mouth y=-0.056)
      if (x > 0.02 && y < -0.062) {
        const chinBroad = 1 - clamp(absZ / (0.054 * fp.jawWidth), 0, 1);
        x += chinBroad * 0.0115 * jawT * fp.chinLength;
        if (y > -0.08 && y < -0.06 && absZ < 0.028) {
          x -= 0.0045 * (1 - absZ / 0.028);
        }
      }

      // Subtle under-chin & occiput tuck
      if (x < -0.01) {
        x *= 1 - jawT * 0.16;
      }
    }

    // Cheekbones (zygomatic arch prominence)
    if (x > 0.022 && y > -0.032 && y < 0.016 && absZ > 0.022 && absZ < 0.072) {
      const cheekMask =
        (1 - Math.abs(y + 0.008) / 0.024) *
        (1 - Math.abs(absZ - 0.045) / 0.028);
      x += Math.max(0, cheekMask) * 0.0095 * fp.cheekHeight;
    }

    // Supraorbital brow ridge & recessed orbital eye sockets (y=+0.009, z=+/-0.031)
    if (x > 0.032) {
      if (y > 0.016 && y < 0.048 && absZ < 0.064) {
        const browMask = 1 - Math.abs(y - 0.031) / 0.016;
        x += Math.max(0, browMask) * 0.0105 * fp.browRidge;
      }
      if (y > -0.006 && y < 0.022 && absZ > 0.013 && absZ < 0.053) {
        const eyeMask =
          (1 - Math.abs(y - 0.009) / 0.014) *
          (1 - Math.abs(absZ - 0.031) / 0.02);
        x -= Math.max(0, eyeMask) * 0.009;
      }
    }

    // Sculpted nasal bridge, nostril wing flare & nasal tip (y=+0.015 down to -0.030)
    const noseSpanZ = 0.019 * fp.noseWidth;
    if (x > 0.04 && y > -0.038 * fp.noseLength && y < 0.024 && absZ < noseSpanZ) {
      const noseY = 1 - Math.abs(y + 0.011 * fp.noseLength) / (0.031 * fp.noseLength);
      const noseZ = 1 - absZ / noseSpanZ;
      const tipBoost = y < -0.008 && y > -0.03 * fp.noseLength ? 1.35 : 0.9;
      x += Math.max(0, noseY * noseZ) * 0.0175 * tipBoost;
    }

    // Sculpted subtle upper/lower lip shelf aligned to real photo mouth (-0.056)
    if (x > 0.044 && y > -0.069 && y < -0.043 && absZ < 0.027) {
      const lipMask =
        (1 - Math.abs(y + 0.056) / 0.013) * (1 - absZ / 0.027);
      x += Math.max(0, lipMask) * 0.0048;
    }

    // Temple narrowing
    if (y > 0.01 && y < 0.065 && x > -0.02 && absZ > 0.066) {
      z *= 0.94;
    }

    pos.setXYZ(i, x, y + 0.088, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function createSculptedBeardGeometry(profile: FighterProfile): THREE.BufferGeometry {
  const fp = resolveFaceProfile(profile);
  const geo = new THREE.SphereGeometry(0.1095, 28, 22, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.5);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    y *= 1.12 * (1 + (fp.chinLength - 1) * 0.58);
    z *= 0.9 * fp.faceWidth * (0.94 + (fp.jawWidth - 1) * 0.65);

    // Keep beard strictly around front/side mandible and chin, tapering away cleanly at back of neck
    if (x < -0.02) {
      x *= 0.72;
      z *= 0.82;
    } else if (x > 0.02 && y < -0.04) {
      const chinMass = fp.beardShape === 'thickFullBeard' || fp.beardShape === 'chinstrapNoStache' ? 0.018 : 0.011;
      const center = 1 - clamp(Math.abs(z) / 0.065, 0, 1);
      x += center * chinMass;
      y -= center * 0.008;
    }
    pos.setXYZ(i, x, y + 0.087, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function createSculptedTorsoGeometry(): THREE.BufferGeometry {
  // Bottom rim (0.1515 at y=-0.004) wraps 4mm cleanly outside abdomen (0.147) — zero z-fighting!
  const torsoProfile = [
    new THREE.Vector2(0.1515, -0.004),
    new THREE.Vector2(0.154, 0.038),
    new THREE.Vector2(0.17, 0.092),
    new THREE.Vector2(0.194, 0.146),
    new THREE.Vector2(0.208, 0.202),
    new THREE.Vector2(0.172, 0.258),
    new THREE.Vector2(0.104, 0.308),
    new THREE.Vector2(0.068, 0.352),
  ];
  const geo = new THREE.LatheGeometry(torsoProfile, 40);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i); // unrotated -Z maps to +Z chest front after rotation.y = Math.PI

    x *= 1.1;
    z *= 0.72;

    const absX = Math.abs(x);

    // Sculpted Pectoral Shelves (front z < -0.02, y between 0.11 & 0.245)
    if (z < -0.02 && y > 0.11 && y < 0.25 && absX < 0.18) {
      const pecY = 1 - Math.abs(y - 0.178) / 0.07;
      const sternumCleavage = smoothstep(0.0, 0.032, absX);
      const outerTaper = 1 - smoothstep(0.11, 0.18, absX);
      const pecRelief = Math.max(0, pecY) * sternumCleavage * outerTaper;
      z -= pecRelief * 0.024;
      if (y < 0.145) {
        z -= pecRelief * 0.007;
      }
    }

    // Upper abs / serratus rib transition
    if (z < -0.02 && y <= 0.11 && y > 0.005 && absX < 0.072) {
      const abCol =
        smoothstep(0.007, 0.022, absX) * (1 - smoothstep(0.04, 0.072, absX));
      const rowWave = 0.5 + 0.5 * Math.sin((y - 0.01) * 58);
      z -= abCol * rowWave * 0.009;
    }

    // Athletic Trapezius slope into neck collar
    if (y > 0.25 && absX > 0.055) {
      const trapMask = smoothstep(0.25, 0.32, y) * (1 - smoothstep(0.065, 0.155, absX));
      y += trapMask * 0.014;
    }

    // Upper back / spine furrow (back z > 0.02)
    if (z > 0.02 && y > 0.05 && y < 0.28) {
      const spineFurrow = 1 - smoothstep(0.0, 0.028, absX);
      z -= spineFurrow * 0.015;
      if (absX > 0.04 && absX < 0.16 && y > 0.12) {
        z += 0.01 * (1 - Math.abs(absX - 0.095) / 0.065);
      }
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function createSculptedAbdomenGeometry(): THREE.BufferGeometry {
  // Stops at y=0.194 with radius 0.1465 cleanly tucked inside chest (0.1515) — zero z-fighting
  const abProfile = [
    new THREE.Vector2(0.04, -0.01),
    new THREE.Vector2(0.145, 0.0),
    new THREE.Vector2(0.14, 0.05),
    new THREE.Vector2(0.141, 0.1),
    new THREE.Vector2(0.144, 0.148),
    new THREE.Vector2(0.1465, 0.196),
  ];
  const geo = new THREE.LatheGeometry(abProfile, 36);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);

    x *= 1.07;
    z *= 0.725;
    const absX = Math.abs(x);

    // Sculpted 6-pack abs & obliques on front (-Z)
    if (z < -0.02 && y > 0.02 && y < 0.2 && absX < 0.075) {
      const lineaAlba = smoothstep(0.005, 0.02, absX);
      const rectusOuter = 1 - smoothstep(0.042, 0.075, absX);
      const abSeg = Math.max(0, Math.sin((y - 0.025) * 54));
      z -= lineaAlba * rectusOuter * abSeg * 0.011;
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function createFaceTexture(
  profile: FighterProfile,
  onPhotoApplied?: () => void,
): THREE.CanvasTexture {
  const fp = resolveFaceProfile(profile);
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;
  const S = 768 / 512;

  ctx.fillStyle = profile.appearance.skinHex;
  ctx.fillRect(0, 0, 768, 768);

  ctx.save();
  ctx.scale(S, S);

  // Subtle natural skin tonal depth & facial structure shading
  const faceShade = ctx.createRadialGradient(256, 245, 22, 256, 256, 175);
  faceShade.addColorStop(0, 'rgba(255, 214, 184, 0.12)');
  faceShade.addColorStop(0.5, 'rgba(175, 92, 62, 0.08)');
  faceShade.addColorStop(1, 'rgba(14, 6, 4, 0.4)');
  ctx.fillStyle = faceShade;
  ctx.fillRect(0, 0, 512, 512);

  // Cheekbone vascular warmth + hollow under-cheek shadow
  ctx.fillStyle = 'rgba(165, 58, 42, 0.11)';
  ctx.beginPath();
  ctx.ellipse(212, 272, 24, 14, 0, 0, Math.PI * 2);
  ctx.ellipse(300, 272, 24, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(18, 8, 5, 0.18)';
  ctx.beginPath();
  ctx.ellipse(200, 314, 18, 32, -0.34, 0, Math.PI * 2);
  ctx.ellipse(312, 314, 18, 32, 0.34, 0, Math.PI * 2);
  ctx.fill();

  // Subtle nasolabial & forehead grit lines
  ctx.strokeStyle = 'rgba(22, 9, 6, 0.18)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(234, 282);
  ctx.quadraticCurveTo(222, 305, 224, 325);
  ctx.moveTo(278, 282);
  ctx.quadraticCurveTo(290, 305, 288, 325);
  ctx.stroke();

  // Anatomical scalp hairline & temple sideburns (replaces flat stripe)
  if (fp.hairModel !== 'shaved') {
    const hairlineY = fp.hairModel === 'recedingBuzz' ? 148 : 164;
    ctx.fillStyle = profile.appearance.hairHex;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(512, 0);
    ctx.lineTo(512, 168);
    ctx.quadraticCurveTo(375, 162, 322, hairlineY + 12);
    ctx.quadraticCurveTo(256, hairlineY - (fp.hairModel === 'recedingBuzz' ? 24 : 4), 190, hairlineY + 12);
    ctx.quadraticCurveTo(137, 162, 0, 168);
    ctx.closePath();
    ctx.fill();

    // Soft hairline edge fade
    const fadeGrad = ctx.createLinearGradient(0, hairlineY - 8, 0, hairlineY + 26);
    fadeGrad.addColorStop(0, profile.appearance.hairHex);
    fadeGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(156, hairlineY - 8, 200, 34);

    // Tapered temple sideburns running neatly down beside cheeks
    ctx.fillStyle = fp.beardHex;
    ctx.globalAlpha = fp.hairModel === 'highFade' ? 0.35 : 0.72;
    ctx.beginPath();
    ctx.moveTo(166, 178);
    ctx.lineTo(186, 184);
    ctx.lineTo(184, 286);
    ctx.lineTo(164, 272);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(346, 178);
    ctx.lineTo(326, 184);
    ctx.lineTo(328, 286);
    ctx.lineTo(348, 272);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Deep-set orbital shadows & tear troughs
  for (const ex of [224, 288]) {
    const orb = ctx.createRadialGradient(ex, 244, 3, ex, 244, 24);
    orb.addColorStop(0, 'rgba(18, 7, 5, 0.45)');
    orb.addColorStop(0.65, 'rgba(26, 10, 7, 0.2)');
    orb.addColorStop(1, 'rgba(20, 9, 6, 0)');
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(ex, 244, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  // Individualized Eyebrows (uses natural beardHex so bleached hair doesn't bleach brows!)
  ctx.strokeStyle = fp.beardHex;
  ctx.lineWidth = 6.8 * fp.eyebrowThickness;
  ctx.lineCap = 'round';
  const browDrop = fp.eyebrowArch === 'stern' ? 5 : fp.eyebrowArch === 'arched' ? -3 : 1;
  const browPeak = fp.eyebrowArch === 'arched' ? 214 : fp.eyebrowArch === 'stern' ? 218 : 220;
  ctx.beginPath();
  ctx.moveTo(199, 228 - browDrop * 0.4);
  ctx.quadraticCurveTo(222, browPeak, 245, 229 + browDrop);
  ctx.moveTo(267, 229 + browDrop);
  ctx.quadraticCurveTo(290, browPeak, 313, 228 - browDrop * 0.4);
  ctx.stroke();

  // Lifelike Fighter Eyes (shaded sclera, colored iris, dark limbal ring, lash line)
  for (const ex of [224, 288]) {
    ctx.fillStyle = '#ddd5cb';
    ctx.beginPath();
    ctx.ellipse(ex, 243, 10.6, 4.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Limbal dark ring + colored iris
    ctx.fillStyle = '#120d0a';
    ctx.beginPath();
    ctx.arc(ex, 243, 4.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fp.eyeColorHex;
    ctx.beginPath();
    ctx.arc(ex, 243, 3.8, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#080504';
    ctx.beginPath();
    ctx.arc(ex, 243, 2.0, 0, Math.PI * 2);
    ctx.fill();

    // Upper eyelid shadow across top of eye
    ctx.fillStyle = 'rgba(16, 7, 5, 0.36)';
    ctx.beginPath();
    ctx.ellipse(ex, 240, 10.8, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Specular catchlight
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.arc(ex + 1.3, 241.8, 1.0, 0, Math.PI * 2);
    ctx.fill();

    // Crisp upper eyelid crease
    ctx.strokeStyle = 'rgba(20, 8, 6, 0.88)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(ex, 242.5, 11.2, 4.8, 0, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
  }

  // Nasal bridge side-contour shadow + highlight + alae & nostrils scaled by noseWidth
  const nw = fp.noseWidth;
  ctx.fillStyle = 'rgba(22, 9, 6, 0.17)';
  ctx.fillRect(256 - 9 * nw, 236, 4, 44);
  ctx.fillRect(256 + 5 * nw, 236, 4, 44);
  ctx.fillStyle = 'rgba(255, 220, 192, 0.16)';
  ctx.fillRect(253, 236, 6, 44);
  ctx.fillStyle = 'rgba(22, 8, 5, 0.5)';
  ctx.beginPath();
  ctx.ellipse(256 - 9 * nw, 286, 4.5 * nw, 2.5, -0.25, 0, Math.PI * 2);
  ctx.ellipse(256 + 9 * nw, 286, 4.5 * nw, 2.5, 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Philtrum, Cupid's Bow Lips & lower-lip shadow
  ctx.fillStyle = 'rgba(24, 10, 8, 0.16)';
  ctx.fillRect(253, 291, 6, 15);
  ctx.fillStyle = 'rgba(126, 54, 46, 0.68)';
  ctx.beginPath();
  ctx.moveTo(236, 314);
  ctx.quadraticCurveTo(248, 307, 256, 310);
  ctx.quadraticCurveTo(264, 307, 276, 314);
  ctx.quadraticCurveTo(256, 323, 236, 314);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(28, 10, 8, 0.88)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(236, 314);
  ctx.quadraticCurveTo(256, 316.5, 276, 314);
  ctx.stroke();

  // Mentolabial shadow under bottom lip
  ctx.fillStyle = 'rgba(20, 9, 7, 0.26)';
  ctx.beginPath();
  ctx.ellipse(256, 326, 13, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Face Ink & Brow Scars (e.g., Sean O'Malley cheekbone ink & under-eye tattoo)
  if (fp.faceInk === 'omalley') {
    ctx.strokeStyle = 'rgba(24, 48, 58, 0.78)';
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(205, 256);
    ctx.lineTo(212, 266);
    ctx.moveTo(208, 255);
    ctx.lineTo(206, 266);
    ctx.moveTo(298, 260);
    ctx.quadraticCurveTo(311, 254, 322, 264);
    ctx.stroke();
    ctx.fillStyle = 'rgba(24, 44, 52, 0.75)';
    ctx.font = 'italic bold 11px serif';
    ctx.fillText('Suga', 292, 274);
  } else if (fp.faceInk === 'hollowayTear') {
    ctx.strokeStyle = 'rgba(72, 34, 24, 0.38)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(200, 219);
    ctx.lineTo(211, 229);
    ctx.stroke();
  }

  // Bespoke Fighter Facial Hair (8 styles + crisp hair grain)
  const bShape = fp.beardShape;
  ctx.fillStyle = fp.beardHex;
  if (bShape === 'thickFullBeard' || bShape === 'fullBeard') {
    ctx.globalAlpha = bShape === 'thickFullBeard' ? 0.96 : 0.9;
    ctx.beginPath();
    ctx.moveTo(182, 268);
    ctx.quadraticCurveTo(186, 404, 256, 418);
    ctx.quadraticCurveTo(326, 404, 330, 268);
    ctx.lineTo(310, 300);
    ctx.quadraticCurveTo(256, 332, 202, 300);
    ctx.closePath();
    ctx.fill();
    // Crisp mustache
    ctx.beginPath();
    ctx.ellipse(256, 302, 26, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (bShape === 'chinstrapNoStache') {
    // Authentic Dagestani / Chechen chinstrap beard with cleanly shaved upper lip!
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(182, 266);
    ctx.quadraticCurveTo(188, 408, 256, 420);
    ctx.quadraticCurveTo(324, 408, 330, 266);
    ctx.lineTo(314, 294);
    ctx.quadraticCurveTo(304, 342, 256, 340);
    ctx.quadraticCurveTo(208, 342, 198, 294);
    ctx.closePath();
    ctx.fill();
    // Chin soul-patch connector below lower lip (upper lip left completely bare!)
    ctx.beginPath();
    ctx.ellipse(256, 338, 12, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (bShape === 'trimShortBeard') {
    ctx.globalAlpha = 0.68;
    ctx.beginPath();
    ctx.moveTo(188, 278);
    ctx.quadraticCurveTo(194, 392, 256, 402);
    ctx.quadraticCurveTo(318, 392, 324, 278);
    ctx.lineTo(306, 306);
    ctx.quadraticCurveTo(256, 334, 206, 306);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(256, 303, 24, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (bShape === 'goatee') {
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.ellipse(256, 349, 21, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(256, 303, 21, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (bShape === 'mustacheOnly') {
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.moveTo(230, 307);
    ctx.quadraticCurveTo(256, 296, 282, 307);
    ctx.quadraticCurveTo(256, 304, 230, 307);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(256, 334, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (bShape === 'stubble') {
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.moveTo(194, 286);
    ctx.quadraticCurveTo(256, 398, 318, 286);
    ctx.lineTo(304, 344);
    ctx.quadraticCurveTo(256, 374, 208, 344);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 360; i++) {
      const gx = 200 + ((i * 73) % 112);
      const gy = 294 + ((i * 41) % 78);
      ctx.fillRect(gx, gy, 1.3, 1.3);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const cachedPhoto = facePhotoResolvedCache.get(profile.id);
  if (cachedPhoto) {
    projectFacePhotoOntoCanvas(canvas, profile, cachedPhoto);
    onPhotoApplied?.();
  } else {
    void loadFighterFacePhoto(profile).then((photo) => {
      if (!photo) return;
      projectFacePhotoOntoCanvas(canvas, profile, photo);
      tex.needsUpdate = true;
      onPhotoApplied?.();
    });
  }

  tex.needsUpdate = true;
  return tex;
}

function createNeckTexture(profile: FighterProfile): THREE.CanvasTexture {
  const fp = resolveFaceProfile(profile);
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = profile.appearance.skinHex;
  ctx.fillRect(0, 0, 384, 384);

  // Subtle throat & sternocleidomastoid V-muscle shading (front is x=192)
  ctx.strokeStyle = 'rgba(20, 8, 5, 0.18)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(118, 40);
  ctx.quadraticCurveTo(156, 220, 188, 360);
  ctx.moveTo(266, 40);
  ctx.quadraticCurveTo(228, 220, 196, 360);
  ctx.stroke();

  const inkDark = 'rgba(18, 25, 34, 0.74)';
  const inkMid = 'rgba(22, 30, 40, 0.48)';
  ctx.fillStyle = inkDark;
  ctx.strokeStyle = inkDark;

  if (fp.neckTattoo === 'oliveira') {
    // Charles Oliveira iconic dual cursive vertical script on both sides of the neck
    ctx.save();
    ctx.font = 'italic bold 22px serif';
    ctx.textAlign = 'center';
    for (const sideX of [136, 248]) {
      ctx.save();
      ctx.translate(sideX, 196);
      ctx.rotate(sideX < 192 ? 0.12 : -0.12);
      ctx.fillText('Bronx', 0, -28);
      ctx.fillText('Favela', 0, 14);
      ctx.restore();
    }
    ctx.restore();
  } else if (fp.neckTattoo === 'topuriaWings') {
    // Ilia Topuria sculpted dark throat/collarbone script & crest
    ctx.fillStyle = inkMid;
    ctx.beginPath();
    ctx.moveTo(148, 270);
    ctx.quadraticCurveTo(192, 228, 236, 270);
    ctx.quadraticCurveTo(192, 326, 148, 270);
    ctx.fill();
    ctx.lineWidth = 3.2;
    ctx.stroke();
  } else if (fp.neckTattoo === 'aspinallNeck') {
    // Dense shaded wraparound neck sleeve
    ctx.fillStyle = inkMid;
    ctx.fillRect(62, 125, 260, 220);
    ctx.lineWidth = 3.5;
    for (let y = 140; y < 340; y += 26) {
      ctx.beginPath();
      ctx.moveTo(64, y);
      ctx.bezierCurveTo(128, y - 14, 256, y + 14, 320, y);
      ctx.stroke();
    }
  } else if (fp.neckTattoo === 'omalleyNeck') {
    // Stylized throat owl / mandala ink
    ctx.fillStyle = 'rgba(26, 56, 64, 0.65)';
    ctx.beginPath();
    ctx.arc(192, 220, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (fp.neckTattoo === 'hollowayNeck' || fp.neckTattoo === 'diazNeck') {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(118, 278);
    ctx.quadraticCurveTo(192, 248, 266, 278);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function drawInkTriangleBand(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  teeth: number,
) {
  const step = w / teeth;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const px = x0 + i * step;
    ctx.moveTo(px, y0 + h);
    ctx.lineTo(px + step * 0.5, y0);
    ctx.lineTo(px + step, y0 + h);
  }
  ctx.fill();
}

function createSkinTexture(profile: FighterProfile): THREE.CanvasTexture {
  // CHEST-ONLY TEXTURE (v=0 bottom ribs cy=512 .. v=1 collar/traps cy=0, front=256)
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;
  const S = 768 / 512;

  ctx.fillStyle = profile.appearance.skinHex;
  ctx.fillRect(0, 0, 768, 768);

  ctx.save();
  ctx.scale(S, S);

  // Soft pectoral anatomical highlight fading to pure base skinHex at seam edges (invisible join!)
  const chestGlow = ctx.createRadialGradient(256, 175, 16, 256, 185, 170);
  chestGlow.addColorStop(0, 'rgba(255, 214, 185, 0.1)');
  chestGlow.addColorStop(0.65, 'rgba(155, 82, 54, 0.05)');
  chestGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = chestGlow;
  ctx.fillRect(0, 0, 512, 512);

  // Clavicle hollow shadow
  ctx.strokeStyle = 'rgba(24, 10, 6, 0.22)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(192, 130);
  ctx.quadraticCurveTo(226, 146, 256, 140);
  ctx.quadraticCurveTo(286, 146, 320, 130);
  ctx.stroke();

  // Deep lower pectoral undercut & sternum shadow (pec crease sits around cy=246)
  ctx.strokeStyle = 'rgba(28, 11, 7, 0.28)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(182, 242);
  ctx.quadraticCurveTo(218, 262, 256, 238);
  ctx.quadraticCurveTo(294, 262, 330, 242);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(28, 11, 7, 0.18)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(256, 150);
  ctx.lineTo(256, 278);
  ctx.stroke();

  // Nipples accurately on outer lower pec corners
  for (const nx of [205, 307]) {
    ctx.fillStyle = 'rgba(116, 54, 46, 0.56)';
    ctx.beginPath();
    ctx.arc(nx, 238, 4.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Optional chest hair texture (McGregor, Prochazka)
  if (profile.appearance.chestHair) {
    ctx.fillStyle = profile.appearance.hairHex;
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 480; i++) {
      const cx = 198 + ((i * 53) % 116);
      const cy = 148 + ((i * 79) % 190);
      ctx.fillRect(cx, cy, 2, 1.1);
    }
    ctx.globalAlpha = 1;
  }

  // Fighter-Specific Realistic Chest Ink (organic charcoal-slate tones + stippling)
  const inkDark = 'rgba(19, 25, 32, 0.72)';
  const inkMid = 'rgba(24, 32, 40, 0.48)';
  const inkSoft = 'rgba(26, 34, 42, 0.28)';
  ctx.strokeStyle = inkDark;
  ctx.fillStyle = inkMid;
  const style = profile.appearance.tattooStyle;

  if (style === 'hollowayFull' || style === 'wings') {
    // Max Holloway rich Polynesian tribal chest armor + Gothic chest script + sternum filigree + back wings
    // Collarbone Gothic lettering silhouette
    ctx.fillStyle = inkDark;
    ctx.font = 'italic 800 18px serif';
    ctx.textAlign = 'center';
    ctx.fillText('BLESSED', 256, 146);

    // Dense Polynesian chest plates wrapping into shoulder caps
    ctx.fillStyle = inkSoft;
    ctx.fillRect(156, 156, 88, 62);
    ctx.fillRect(268, 156, 88, 62);

    ctx.fillStyle = inkDark;
    drawInkTriangleBand(ctx, 156, 156, 88, 15, 7);
    drawInkTriangleBand(ctx, 268, 156, 88, 15, 7);
    drawInkTriangleBand(ctx, 160, 202, 82, 14, 6);
    drawInkTriangleBand(ctx, 270, 202, 82, 14, 6);

    // Intricate Polynesian lattice diagonal bands
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(160 + i * 14, 170);
      ctx.lineTo(174 + i * 14, 204);
      ctx.moveTo(272 + i * 14, 170);
      ctx.lineTo(286 + i * 14, 204);
      ctx.stroke();
    }

    // Center sternum shield + filigree swirls
    ctx.fillStyle = inkSoft;
    ctx.beginPath();
    ctx.moveTo(214, 218);
    ctx.lineTo(256, 304);
    ctx.lineTo(298, 218);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(232, 232);
    ctx.quadraticCurveTo(256, 264, 280, 232);
    ctx.moveTo(240, 256);
    ctx.lineTo(256, 286);
    ctx.lineTo(272, 256);
    ctx.stroke();

    // Rib script hint + iconic Back Angel/Demon Wings (on outer seams 0..100 & 412..512)
    ctx.lineWidth = 3.2;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 128 + i * 24);
      ctx.quadraticCurveTo(64 + i * 5, 112 + i * 24, 114 + i * 4, 260 + i * 22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(512, 128 + i * 24);
      ctx.quadraticCurveTo(448 - i * 5, 112 + i * 24, 398 - i * 4, 260 + i * 22);
      ctx.stroke();
    }
  } else if (style === 'mcgregorChest') {
    // Detailed Conor McGregor Crowned Gorilla chest piece (layered dark charcoal silhouette + fur + gold crown)
    ctx.fillStyle = inkDark;
    ctx.beginPath();
    ctx.ellipse(256, 216, 42, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lighter muzzle & brow highlights inside gorilla
    ctx.fillStyle = 'rgba(200, 155, 128, 0.34)';
    ctx.beginPath();
    ctx.ellipse(256, 224, 22, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = inkDark;
    ctx.beginPath();
    ctx.arc(242, 206, 5, 0, Math.PI * 2);
    ctx.arc(270, 206, 5, 0, Math.PI * 2);
    ctx.fill();
    // 3-point Royal Crown above gorilla
    ctx.fillStyle = '#b8822e';
    ctx.beginPath();
    ctx.moveTo(234, 168);
    ctx.lineTo(234, 150);
    ctx.lineTo(245, 160);
    ctx.lineTo(256, 146);
    ctx.lineTo(267, 160);
    ctx.lineTo(278, 150);
    ctx.lineTo(278, 168);
    ctx.closePath();
    ctx.fill();
  } else if (style === 'poirierFull') {
    // Dustin Poirier dense black-grey floral chest & collarbone script
    ctx.fillStyle = inkSoft;
    ctx.fillRect(160, 142, 192, 92);
    ctx.strokeStyle = inkDark;
    ctx.lineWidth = 2.8;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(178 + i * 31, 186, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(192 + i * 28, 214, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (style === 'oliveiraChest') {
    // Charles Oliveira geometric crest & script
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(256, 202, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(216, 156, 80, 7);
  } else if (style === 'omalleyChest') {
    // Sean O'Malley wide colorful chest owl spreading across both pecs
    ctx.fillStyle = 'rgba(32, 66, 72, 0.56)';
    ctx.beginPath();
    ctx.moveTo(166, 184);
    ctx.quadraticCurveTo(256, 142, 346, 184);
    ctx.lineTo(256, 266);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(130, 44, 58, 0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (style === 'chestScript') {
    // Jon Jones upper right-pec "Philippians 4:13" script
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(186, 174);
    ctx.quadraticCurveTo(216, 162, 244, 176);
    ctx.stroke();
  } else if (style === 'fullSleeveChest') {
    // Tom Aspinall heavy shaded chest mural wrapping onto arms
    ctx.fillStyle = inkSoft;
    ctx.fillRect(160, 146, 192, 108);
    ctx.strokeStyle = inkDark;
    ctx.lineWidth = 3.5;
    for (let y = 154; y < 246; y += 18) {
      ctx.beginPath();
      ctx.moveTo(164, y);
      ctx.bezierCurveTo(208, y - 10, 304, y + 10, 348, y);
      ctx.stroke();
    }
  } else if (style === 'chestBand') {
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(176, 198);
    ctx.bezierCurveTo(220, 176, 292, 176, 336, 198);
    ctx.stroke();
  }

  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createAbdomenTexture(profile: FighterProfile): THREE.CanvasTexture {
  // ABDOMEN-ONLY TEXTURE (zero duplicated chest plates!)
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;
  const S = 768 / 512;

  ctx.fillStyle = profile.appearance.skinHex;
  ctx.fillRect(0, 0, 768, 768);

  ctx.save();
  ctx.scale(S, S);

  // Soft mid-abdomen highlight fading to zero at borders for invisible chest join
  const abGlow = ctx.createRadialGradient(256, 250, 14, 256, 250, 175);
  abGlow.addColorStop(0, 'rgba(255, 214, 185, 0.08)');
  abGlow.addColorStop(0.6, 'rgba(155, 82, 54, 0.04)');
  abGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = abGlow;
  ctx.fillRect(0, 0, 512, 512);

  // Linea alba + sculpted 6-pack abs contours + obliques
  ctx.strokeStyle = 'rgba(32, 12, 7, 0.2)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(256, 35);
  ctx.lineTo(256, 420);
  ctx.stroke();

  for (let row = 0; row < 3; row++) {
    const y = 115 + row * 84;
    ctx.beginPath();
    ctx.moveTo(212, y);
    ctx.quadraticCurveTo(234, y + 10, 256, y);
    ctx.quadraticCurveTo(278, y + 10, 300, y);
    ctx.stroke();
  }

  // Oblique V-taper shadows
  ctx.strokeStyle = 'rgba(28, 11, 7, 0.16)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(188, 120);
  ctx.quadraticCurveTo(205, 310, 232, 440);
  ctx.moveTo(324, 120);
  ctx.quadraticCurveTo(307, 310, 280, 440);
  ctx.stroke();

  // Realistic Navel
  ctx.fillStyle = 'rgba(28, 10, 7, 0.42)';
  ctx.beginPath();
  ctx.ellipse(256, 336, 4.5, 6.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Abdomen chest-hair trail for hairy fighters
  if (profile.appearance.chestHair) {
    ctx.fillStyle = profile.appearance.hairHex;
    ctx.globalAlpha = 0.24;
    for (let i = 0; i < 240; i++) {
      const cx = 236 + ((i * 37) % 40);
      const cy = 60 + ((i * 61) % 360);
      ctx.fillRect(cx, cy, 1.8, 1.1);
    }
    ctx.globalAlpha = 1;
  }

  // Abdomen-specific tattoos ONLY
  const style = profile.appearance.tattooStyle;
  ctx.strokeStyle = 'rgba(20, 27, 34, 0.65)';
  ctx.fillStyle = 'rgba(22, 30, 38, 0.56)';
  if (style === 'mcgregorChest') {
    // Conor MCGREGOR belly stencil + roaring Tiger head around navel
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MCGREGOR', 256, 140);
    ctx.beginPath();
    ctx.ellipse(256, 265, 34, 38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(218, 165, 92, 0.48)';
    ctx.lineWidth = 2.4;
    for (let s = -2; s <= 2; s++) {
      ctx.beginPath();
      ctx.moveTo(236, 255 + s * 10);
      ctx.lineTo(276, 260 + s * 10);
      ctx.stroke();
    }
  } else if (style === 'hollowayFull') {
    // Max Holloway subtle lower-waist "HOLLOWAY" lettering + side rib wing tips
    ctx.fillStyle = 'rgba(22, 28, 36, 0.52)';
    ctx.font = 'italic bold 16px serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOLLOWAY', 256, 405);
    ctx.lineWidth = 2.6;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(154, 140 + i * 28);
      ctx.quadraticCurveTo(176, 160 + i * 28, 192, 190 + i * 28);
      ctx.moveTo(358, 140 + i * 28);
      ctx.quadraticCurveTo(336, 160 + i * 28, 320, 190 + i * 28);
      ctx.stroke();
    }
  } else if (style === 'chestScript') {
    // Jon Jones vertical Korean/script side-rib ink
    ctx.fillRect(322, 120, 14, 96);
  } else if (style === 'oliveiraChest') {
    ctx.fillRect(318, 130, 18, 72);
  } else if (style === 'poirierFull') {
    ctx.fillRect(166, 110, 22, 110);
  }

  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createLegSkinTexture(profile: FighterProfile): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = profile.appearance.skinHex;
  ctx.fillRect(0, 0, 256, 256);

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(18, 8, 5, 0.16)');
  grad.addColorStop(0.5, 'rgba(255, 214, 185, 0.08)');
  grad.addColorStop(1, 'rgba(18, 8, 5, 0.16)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createArmSkinTexture(profile: FighterProfile): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = profile.appearance.skinHex;
  ctx.fillRect(0, 0, 384, 384);

  const tone = ctx.createLinearGradient(0, 0, 384, 0);
  tone.addColorStop(0, 'rgba(18, 8, 5, 0.14)');
  tone.addColorStop(0.5, 'rgba(255, 214, 185, 0.08)');
  tone.addColorStop(1, 'rgba(18, 8, 5, 0.14)');
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, 384, 384);

  const style = profile.appearance.tattooStyle;
  if (
    style === 'hollowayFull' ||
    style === 'poirierFull' ||
    style === 'fullSleeveChest' ||
    style === 'tribalArm' ||
    style === 'armSleeve' ||
    style === 'oliveiraChest' ||
    style === 'omalleyChest' ||
    style === 'mcgregorChest'
  ) {
    ctx.strokeStyle = 'rgba(20, 27, 34, 0.66)';
    ctx.fillStyle = 'rgba(22, 30, 38, 0.36)';
    ctx.lineWidth = 4.5;
    for (let y = 32; y < 350; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(96, y + 16, 288, y - 16, 384, y);
      ctx.stroke();
    }
    if (style === 'hollowayFull' || style === 'poirierFull') {
      drawInkTriangleBand(ctx, 0, 74, 384, 24, 12);
      drawInkTriangleBand(ctx, 0, 210, 384, 22, 12);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createShortsTexture(profile: FighterProfile): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = profile.appearance.shortsPrimaryHex;
  ctx.fillRect(0, 0, 512, 512);

  const accent = profile.appearance.shortsAccentHex;
  const pat = profile.appearance.shortsPattern;

  if (pat === 'floral') {
    const colors = [accent, '#1f4e8c', '#d85c3a', '#2b6f4a'];
    for (let i = 0; i < 48; i++) {
      const cx = ((i * 97) % 480) + 16;
      const cy = ((i * 151) % 460) + 40;
      ctx.fillStyle = colors[i % colors.length];
      for (let p = 0; p < 5; p++) {
        const a = (p * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.ellipse(
          cx + Math.cos(a) * 14,
          cy + Math.sin(a) * 14,
          10,
          6,
          a,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = '#f3d16b';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pat === 'geometric') {
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 80 + i * 52);
      ctx.lineTo(256, 130 + i * 44);
      ctx.lineTo(512, 80 + i * 52);
      ctx.stroke();
    }
    ctx.fillStyle = accent;
    ctx.fillRect(36, 220, 140, 14);
    ctx.fillRect(336, 220, 140, 14);
  } else if (pat === 'tribal') {
    ctx.fillStyle = accent;
    for (let y = 90; y < 480; y += 64) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(130, y + 24);
      ctx.lineTo(20, y + 48);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(492, y);
      ctx.lineTo(382, y + 24);
      ctx.lineTo(492, y + 48);
      ctx.closePath();
      ctx.fill();
    }
  } else if (pat === 'stripes') {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 512, 48);
    ctx.fillRect(42, 48, 28, 464);
    ctx.fillRect(442, 48, 28, 464);
  } else {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 180, 512, 24);
    ctx.fillStyle = '#ffffff';
    for (let x = 24; x < 500; x += 48) {
      ctx.beginPath();
      ctx.arc(x, 120, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = '#121316';
  ctx.fillRect(0, 0, 512, 48);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('UFC', 256, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const MIXAMO_BONE_LAYOUT: BoneAttachmentOptions = {
  offsets: {
    Hips: [0, -0.103, -0.016],
    Spine2: [0, -0.106, 0.012],
    Head: [0, 0.017, 0.025],
  },
  scales: {
    LeftArm: [1, 1.045, 1],
    LeftForeArm: [1, 1.12, 1],
    RightArm: [1, 1.045, 1],
    RightForeArm: [1, 1.12, 1],
    LeftUpLeg: [1, 1.09, 1],
    LeftLeg: [1, 1.09, 1],
    RightUpLeg: [1, 1.09, 1],
    RightLeg: [1, 1.09, 1],
  },
};

export function ensureCustomOrMixamoRig(rig: JointMap): void {
  const bundle = getResolvedMixamoBundle();
  if (!bundle) return;

  if (rig.profileId === 'mcgregor') {
    const conorTemplate = getResolvedConorModel();
    if (conorTemplate && !rig.customModelAttached) {
      if (rig.mixamo) {
        detachRigFromMixamoBones(rig);
        rig.mixamo.dispose();
        rig.root.remove(rig.mixamo.skeletonRoot);
        rig.mixamo = null;
      }
      const ctrl = createConorMixamoController(bundle, conorTemplate);
      rig.root.add(ctrl.displayRoot);
      rig.pelvis.visible = false;
      rig.mixamo = ctrl;
      rig.mixamoAttached = false;
      rig.customModelAttached = true;
      rig.customDisplayRoot = ctrl.displayRoot;
      rig.customFlashMaterials = ctrl.flashMaterials;
      rig.customHeadBone = ctrl.headBone;
      rig.customNeckBone = ctrl.neckBone;
      rig.customHipsBone = ctrl.hipsBone;
      return;
    }
  }

  if (!rig.mixamo) {
    rig.mixamo = createMixamoRigController(bundle, MIXAMO_BONE_LAYOUT);
    rig.root.add(rig.mixamo.skeletonRoot);
  }
}

export function setFighterHeadHidden(rig: JointMap, hidden: boolean): void {
  rig.customHeadHidden = hidden;
  if (rig.customModelAttached) {
    const s = hidden ? 0.0001 : 1;
    if (rig.customHeadBone) rig.customHeadBone.scale.setScalar(s);
    if (rig.customNeckBone) rig.customNeckBone.scale.setScalar(s);
    return;
  }
  rig.head.visible = !hidden;
  rig.neck.visible = !hidden;
  rig.segmentGroups.headVisual.visible = !hidden;
  rig.segmentGroups.neckVisual.visible = !hidden;
}

export function getFighterHeadWorldPosition(
  rig: JointMap,
  out: THREE.Vector3,
): THREE.Vector3 {
  rig.root.updateMatrixWorld(true);
  if (rig.customModelAttached && rig.customHeadBone) {
    return rig.customHeadBone.getWorldPosition(out);
  }
  if (rig.mixamoAttached && rig.mixamo?.attachments.bones.Head) {
    return rig.mixamo.attachments.bones.Head.getWorldPosition(out);
  }
  return rig.head.getWorldPosition(out);
}

export function attachRigToMixamoBones(rig: JointMap): boolean {
  if (rig.customModelAttached) return true;
  if (!rig.mixamo) return false;
  if (rig.mixamoAttached) return true;

  const { segmentGroups: seg, mixamo } = rig;
  const attach = (key: MixamoKeyBoneName, obj: THREE.Object3D) => {
    const anchor = mixamo.attachments.anchors[key];
    if (!anchor) return;
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    anchor.add(obj);
  };

  seg.abdomenVisual.position.set(0, 0.1, 0);
  seg.abdomenVisual.rotation.set(0, 0, 0);
  seg.hipsVisual.add(seg.abdomenVisual);

  seg.neckVisual.position.set(0, 0.288, 0.008);
  seg.neckVisual.rotation.set(0, 0, 0);
  seg.spine2Visual.add(seg.neckVisual);

  attach('Hips', seg.hipsVisual);
  attach('Spine2', seg.spine2Visual);
  attach('Head', seg.headVisual);
  attach('LeftArm', seg.leftArmVisual);
  attach('LeftForeArm', seg.leftForeArmVisual);
  attach('RightArm', seg.rightArmVisual);
  attach('RightForeArm', seg.rightForeArmVisual);
  attach('LeftUpLeg', seg.leftUpLegVisual);
  attach('LeftLeg', seg.leftLegVisual);
  attach('RightUpLeg', seg.rightUpLegVisual);
  attach('RightLeg', seg.rightLegVisual);

  rig.pelvis.visible = false;
  rig.mixamoAttached = true;
  return true;
}

export function detachRigFromMixamoBones(rig: JointMap) {
  if (rig.customModelAttached) return;
  if (rig.mixamoAttached) {
    const { segmentGroups: seg } = rig;
    const restore = (parent: THREE.Object3D, child: THREE.Object3D) => {
      child.position.set(0, 0, 0);
      child.rotation.set(0, 0, 0);
      parent.add(child);
    };

    restore(rig.pelvis, seg.hipsVisual);
    restore(rig.abdomen, seg.abdomenVisual);
    restore(rig.chest, seg.spine2Visual);
    restore(rig.neck, seg.neckVisual);
    restore(rig.head, seg.headVisual);
    restore(rig.upperArmL, seg.leftArmVisual);
    restore(rig.forearmL, seg.leftForeArmVisual);
    restore(rig.upperArmR, seg.rightArmVisual);
    restore(rig.forearmR, seg.rightForeArmVisual);
    restore(rig.thighL, seg.leftUpLegVisual);
    restore(rig.shinL, seg.leftLegVisual);
    restore(rig.thighR, seg.rightUpLegVisual);
    restore(rig.shinR, seg.rightLegVisual);

    rig.pelvis.visible = true;
    rig.mixamoAttached = false;
    rig.shadowDisc.position.set(0, 0.015, 0);
  }
  rig.mixamo?.stop();
}

export function buildFighterRig(
  profile: FighterProfile,
  corner: 'red' | 'blue',
): JointMap {
  const root = new THREE.Group();
  const hScale = profile.heightScale;
  const bScale = profile.buildScale;
  root.scale.set(bScale, hScale, bScale);

  const fp = resolveFaceProfile(profile);
  const skinTex = createSkinTexture(profile);
  const abdomenTex = createAbdomenTexture(profile);
  const legTex = createLegSkinTexture(profile);
  let beardMeshRef: THREE.Mesh | null = null;
  let facePhotoApplied = false;
  const faceTex = createFaceTexture(profile, () => {
    facePhotoApplied = true;
    if (beardMeshRef) {
      beardMeshRef.visible = false;
    }
  });
  const neckTex = createNeckTexture(profile);
  const armTex = createArmSkinTexture(profile);
  const shortsTex = createShortsTexture(profile);
  const skinBump = createSkinBumpTexture();
  if (!cachedSoftShadowTex) {
    cachedSoftShadowTex = createSoftShadowTexture();
  }

  const skinMat = new THREE.MeshStandardMaterial({
    map: skinTex,
    bumpMap: skinBump,
    bumpScale: 0.004,
    color: 0xffffff,
    roughness: 0.54,
    metalness: 0.02,
  });

  const abdomenSkinMat = new THREE.MeshStandardMaterial({
    map: abdomenTex,
    bumpMap: skinBump,
    bumpScale: 0.004,
    color: 0xffffff,
    roughness: 0.54,
    metalness: 0.02,
  });

  const limbSkinMat = new THREE.MeshStandardMaterial({
    map: legTex,
    bumpMap: skinBump,
    bumpScale: 0.0035,
    color: 0xffffff,
    roughness: 0.54,
    metalness: 0.02,
  });

  const neckMat = new THREE.MeshStandardMaterial({
    map: neckTex,
    bumpMap: skinBump,
    bumpScale: 0.0035,
    color: 0xffffff,
    roughness: 0.52,
    metalness: 0.02,
  });

  const armRightMat = new THREE.MeshStandardMaterial({
    map: armTex,
    bumpMap: skinBump,
    bumpScale: 0.0035,
    color: 0xffffff,
    roughness: 0.54,
    metalness: 0.02,
  });

  const armLeftMat =
    profile.appearance.tattooStyle === 'poirierFull' ||
    profile.appearance.tattooStyle === 'fullSleeveChest' ||
    profile.appearance.tattooStyle === 'omalleyChest' ||
    profile.appearance.tattooStyle === 'oliveiraChest'
      ? armRightMat
      : limbSkinMat;

  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    bumpMap: skinBump,
    bumpScale: 0.0014,
    color: 0xffffff,
    roughness: fp.hairModel === 'shaved' ? 0.48 : 0.56,
    metalness: 0.01,
  });

  const faceBloodCanvas = document.createElement('canvas');
  faceBloodCanvas.width = 256;
  faceBloodCanvas.height = 256;
  const faceBloodTex = new THREE.CanvasTexture(faceBloodCanvas);
  faceBloodTex.colorSpace = THREE.SRGBColorSpace;
  const faceBloodMat = new THREE.MeshStandardMaterial({
    map: faceBloodTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    roughness: 0.16,
    metalness: 0.06,
  });

  const chestBloodCanvas = document.createElement('canvas');
  chestBloodCanvas.width = 256;
  chestBloodCanvas.height = 256;
  const chestBloodTex = new THREE.CanvasTexture(chestBloodCanvas);
  chestBloodTex.colorSpace = THREE.SRGBColorSpace;
  const chestBloodMat = new THREE.MeshStandardMaterial({
    map: chestBloodTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    roughness: 0.18,
    metalness: 0.05,
  });

  const knuckleBloodMat = new THREE.MeshStandardMaterial({
    color: 0x8c0909,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    roughness: 0.18,
    metalness: 0.06,
  });

  const shortsMat = new THREE.MeshStandardMaterial({
    map: shortsTex,
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.04,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x141519,
    roughness: 0.34,
    metalness: 0.16,
  });

  const tapeMat = new THREE.MeshStandardMaterial({
    color: corner === 'red' ? 0xd92626 : 0x2563eb,
    roughness: 0.64,
    metalness: 0.02,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: profile.appearance.hairHex,
    roughness: 0.9,
    metalness: 0.02,
  });

  const hairAccentMat = new THREE.MeshStandardMaterial({
    color: fp.hairAccentHex,
    roughness: 0.9,
    metalness: 0.02,
  });

  const beardMat = new THREE.MeshStandardMaterial({
    color: fp.beardHex,
    roughness: 0.94,
    metalness: 0.01,
  });

  const wrapMat = new THREE.MeshStandardMaterial({
    color: 0x16171a,
    roughness: 0.82,
    metalness: 0.03,
  });

  // Contact shadow disc
  const shadowGeo = new THREE.CircleGeometry(0.58, 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: cachedSoftShadowTex,
    transparent: true,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // Pelvis
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.94, 0);
  root.add(pelvis);

  const hipsVisual = new THREE.Group();
  pelvis.add(hipsVisual);

  const waistband = new THREE.Mesh(
    new THREE.CylinderGeometry(0.148, 0.152, 0.055, 24),
    new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.68 }),
  );
  waistband.position.y = 0.088;
  waistband.scale.set(1.04, 1.0, 0.76);
  hipsVisual.add(waistband);

  const pelvisMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.151, 0.156, 0.18, 24),
    shortsMat,
  );
  pelvisMesh.position.y = -0.02;
  pelvisMesh.scale.set(1.05, 1.0, 0.76);
  pelvisMesh.castShadow = true;
  hipsVisual.add(pelvisMesh);

  // Abdomen (vertex-sculpted abs + dedicated abdomen texture)
  const abdomen = new THREE.Group();
  abdomen.position.set(0, 0.1, 0);
  pelvis.add(abdomen);

  const abdomenVisual = new THREE.Group();
  abdomen.add(abdomenVisual);

  const abdomenMesh = new THREE.Mesh(createSculptedAbdomenGeometry(), abdomenSkinMat);
  abdomenMesh.rotation.y = Math.PI;
  abdomenMesh.castShadow = true;
  abdomenVisual.add(abdomenMesh);

  // Chest (vertex-sculpted pecs, sternum, lats, trapezius)
  const chest = new THREE.Group();
  chest.position.set(0, 0.19, 0);
  abdomen.add(chest);

  const spine2Visual = new THREE.Group();
  chest.add(spine2Visual);

  const chestGeo = createSculptedTorsoGeometry();
  const chestMesh = new THREE.Mesh(chestGeo, skinMat);
  chestMesh.rotation.y = Math.PI;
  chestMesh.castShadow = true;
  spine2Visual.add(chestMesh);

  const chestBloodMesh = new THREE.Mesh(chestGeo, chestBloodMat);
  chestBloodMesh.rotation.y = Math.PI;
  chestBloodMesh.scale.setScalar(1.003);
  spine2Visual.add(chestBloodMesh);

  // Neck & Sculpted Human Head (tapered trapezius base into neck into jaw)
  const neck = new THREE.Group();
  neck.position.set(0, 0.288, 0.008);
  chest.add(neck);

  const neckVisual = new THREE.Group();
  neck.add(neckVisual);

  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.084, 0.125, 24),
    neckMat,
  );
  neckMesh.position.y = 0.036;
  neckMesh.castShadow = true;
  neckVisual.add(neckMesh);

  const head = new THREE.Group();
  head.position.set(0, 0.098, 0.01);
  neck.add(head);

  const headVisual = new THREE.Group();
  head.add(headVisual);

  const skullGeo = createSculptedHeadGeometry(profile);
  const skullMesh = new THREE.Mesh(skullGeo, faceMat);
  skullMesh.rotation.y = -Math.PI / 2;
  skullMesh.castShadow = true;
  headVisual.add(skullMesh);

  const faceBloodMesh = new THREE.Mesh(skullGeo, faceBloodMat);
  faceBloodMesh.rotation.y = -Math.PI / 2;
  faceBloodMesh.scale.setScalar(1.006);
  headVisual.add(faceBloodMesh);

  // Volumetric 3D Jaw Beard for thick beards & Dagestani chinstraps (fallback until real photo face paints)
  if (fp.beardShape === 'thickFullBeard' || fp.beardShape === 'chinstrapNoStache') {
    beardMeshRef = new THREE.Mesh(createSculptedBeardGeometry(profile), beardMat);
    beardMeshRef.rotation.y = -Math.PI / 2;
    beardMeshRef.castShadow = true;
    beardMeshRef.visible = !facePhotoApplied;
    headVisual.add(beardMeshRef);
  }

  // Sculpted Multi-Part Ears (outer helix + inner concha recess + optional cauliflower bulge)
  const earInnerMat = new THREE.MeshStandardMaterial({
    color: profile.appearance.skinHex,
    roughness: 0.72,
    metalness: 0.01,
  });
  earInnerMat.color.multiplyScalar(0.72);

  const earGeo = new THREE.SphereGeometry(0.021, 12, 10);
  const conchaGeo = new THREE.SphereGeometry(0.013, 10, 8);
  const buildEar = (side: -1 | 1) => {
    const earGroup = new THREE.Group();
    earGroup.position.set(side * 0.087 * fp.faceWidth, 0.082, -0.008);
    earGroup.scale.setScalar(fp.earSize);

    const outerPinna = new THREE.Mesh(earGeo, limbSkinMat);
    outerPinna.scale.set(fp.cauliflowerEars ? 0.5 : 0.36, 1.15, 0.72);
    outerPinna.rotation.z = side * -0.14;
    earGroup.add(outerPinna);

    const innerConcha = new THREE.Mesh(conchaGeo, earInnerMat);
    innerConcha.position.set(side * 0.002, -0.001, 0.002);
    innerConcha.scale.set(0.32, 0.9, 0.56);
    earGroup.add(innerConcha);

    if (fp.cauliflowerEars) {
      const cauliSwelling = new THREE.Mesh(conchaGeo, limbSkinMat);
      cauliSwelling.position.set(side * 0.003, 0.006, -0.001);
      cauliSwelling.scale.set(0.58, 0.72, 0.72);
      earGroup.add(cauliSwelling);
    }
    headVisual.add(earGroup);
  };
  buildEar(-1);
  buildEar(1);

  // Bespoke Multi-Part 3D Hairstyles (positioned to frame real photo hairline cleanly)
  const hModel = fp.hairModel;
  const fw = fp.faceWidth;
  if (hModel === 'curlyAfro') {
    // Voluminous multi-puff curly afro (e.g. Sean O'Malley pink/blue/teal curls)
    const puffs: Array<[number, number, number, number, boolean]> = [
      [0, 0.18, -0.012, 0.066, false],
      [-0.058, 0.166, 0.006, 0.056, false],
      [0.058, 0.166, 0.006, 0.056, true],
      [-0.072, 0.136, -0.034, 0.056, false],
      [0.072, 0.136, -0.034, 0.056, true],
      [0, 0.148, -0.064, 0.062, false],
      [-0.044, 0.106, -0.074, 0.052, false],
      [0.044, 0.106, -0.074, 0.052, true],
      [-0.034, 0.184, 0.024, 0.048, false],
      [0.034, 0.184, 0.024, 0.048, true],
    ];
    for (const [px, py, pz, r, useAccent] of puffs) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(r, 12, 10),
        useAccent ? hairAccentMat : hairMat,
      );
      puff.position.set(px * fw, py, pz);
      puff.castShadow = true;
      headVisual.add(puff);
    }
  } else if (hModel === 'pompadour') {
    const baseCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.106, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.35),
      hairMat,
    );
    baseCap.position.set(0, 0.108, -0.022);
    baseCap.scale.set(0.89 * fw, 1.09, 0.94);
    headVisual.add(baseCap);

    const quiff = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.034, 0.086, 6, 12),
      hairMat,
    );
    quiff.rotation.x = Math.PI * 0.46;
    quiff.position.set(0, 0.182, 0.008);
    quiff.scale.set(1.36 * fw, 1.0, 0.82);
    quiff.castShadow = true;
    headVisual.add(quiff);
  } else if (hModel === 'bangs') {
    // Swept fringe bangs + thick back nape (Diego Lopes / Chan Sung Jung)
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.108, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.38),
      hairMat,
    );
    crown.position.set(0, 0.108, -0.02);
    crown.scale.set(0.92 * fw, 1.14, 1.0);
    headVisual.add(crown);

    const fringe = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.023, 0.09, 5, 10),
      hairMat,
    );
    fringe.rotation.z = Math.PI * 0.44;
    fringe.rotation.y = 0.22;
    fringe.position.set(-0.008, 0.164, 0.06);
    fringe.scale.set(0.84, 1.0, 0.65);
    headVisual.add(fringe);

    const nape = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.036, 0.075, 5, 10),
      hairMat,
    );
    nape.position.set(0, 0.078, -0.078);
    nape.scale.set(1.55 * fw, 1.0, 0.78);
    headVisual.add(nape);
  } else if (hModel === 'samuraiTop') {
    // Shaved sides + central swept crest & rear top-knot (Jiri Prochazka)
    const crest = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.024, 0.11, 5, 10),
      hairMat,
    );
    crest.rotation.x = Math.PI * 0.44;
    crest.position.set(0, 0.186, -0.008);
    crest.scale.set(0.75, 1.0, 0.85);
    headVisual.add(crest);

    const topKnot = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 12, 10),
      hairMat,
    );
    topKnot.position.set(0, 0.168, -0.085);
    topKnot.scale.set(0.85, 1.15, 1.25);
    headVisual.add(topKnot);
  } else if (hModel === 'texturedCrop') {
    // Layered textured short crop tufts on crown (Oliveira / Sandhagen / Rakhmonov)
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.1065, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.35),
      hairMat,
    );
    cap.position.set(0, 0.108, -0.02);
    cap.scale.set(0.9 * fw, 1.12, 0.96);
    headVisual.add(cap);
    for (const [tx, tz] of [
      [-0.032, 0.022],
      [0.028, 0.026],
      [0, -0.002],
      [-0.024, -0.036],
      [0.026, -0.034],
    ]) {
      const tuft = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 10, 8),
        hairMat,
      );
      tuft.position.set(tx * fw, 0.182, tz);
      tuft.scale.set(1.04, 0.52, 1.04);
      headVisual.add(tuft);
    }
  } else if (hModel === 'highFade') {
    // Tapered crown top cap cleanly behind hairline
    const topCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.104, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.32),
      hairMat,
    );
    topCap.position.set(0, 0.112, -0.018);
    topCap.scale.set(0.86 * fw, 1.13, 0.93);
    headVisual.add(topCap);
  } else if (hModel === 'buzz' || hModel === 'recedingBuzz') {
    // Crown/occiput buzz sitting behind photo's natural front hairline
    const buzzCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.106, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.35),
      hairMat,
    );
    buzzCap.position.set(0, 0.104, hModel === 'recedingBuzz' ? -0.025 : -0.02);
    buzzCap.scale.set(0.895 * fw, 1.115, 0.95);
    headVisual.add(buzzCap);
  }

  // Upper Limb Builder: clavicle -> shoulderPivot -> upperArm -> elbowPivot -> forearm -> fist
  const buildArm = (side: -1 | 1) => {
    const mat = side === 1 ? armRightMat : armLeftMat;
    const clavicle = new THREE.Group();
    clavicle.position.set(side * 0.145, 0.218, 0);
    chest.add(clavicle);

    // Shoulder joint ball-and-socket pivot
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.036, -0.014, 0);
    clavicle.add(shoulderPivot);

    const upperArm = new THREE.Group();
    shoulderPivot.add(upperArm);

    const upperArmVisual = new THREE.Group();
    upperArm.add(upperArmVisual);

    // Deltoid muscle cap attached cleanly to upperArm so it rotates with the humerus
    const deltoidMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.061, 20, 16),
      mat,
    );
    deltoidMesh.position.set(0, -0.01, 0);
    deltoidMesh.scale.set(1.04, 1.18, 0.94);
    deltoidMesh.castShadow = true;
    upperArmVisual.add(deltoidMesh);

    // Sculpted bicep/tricep humerus profile hanging downward along -Y
    const bicepProfile = [
      new THREE.Vector2(0.04, -0.265),
      new THREE.Vector2(0.045, -0.236),
      new THREE.Vector2(0.056, -0.145),
      new THREE.Vector2(0.059, -0.045),
      new THREE.Vector2(0.05, 0.012),
    ];
    const bicepMesh = new THREE.Mesh(
      new THREE.LatheGeometry(bicepProfile, 20),
      mat,
    );
    bicepMesh.scale.set(0.96, 1.0, 1.06);
    bicepMesh.castShadow = true;
    upperArmVisual.add(bicepMesh);

    // Elbow hinge pivot at end of upperArm
    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.265, 0);
    upperArm.add(elbowPivot);

    const forearm = new THREE.Group();
    elbowPivot.add(forearm);

    const forearmVisual = new THREE.Group();
    forearm.add(forearmVisual);

    const elbowCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.041, 14, 12),
      mat,
    );
    forearmVisual.add(elbowCap);

    const forearmProfile = [
      new THREE.Vector2(0.029, -0.24),
      new THREE.Vector2(0.033, -0.212),
      new THREE.Vector2(0.047, -0.088),
      new THREE.Vector2(0.043, -0.016),
      new THREE.Vector2(0.036, 0.012),
    ];
    const forearmMesh = new THREE.Mesh(
      new THREE.LatheGeometry(forearmProfile, 20),
      mat,
    );
    forearmMesh.castShadow = true;
    forearmVisual.add(forearmMesh);

    // Wrist/Fist pivot with UFC wrist tape, padded MMA glove, knuckle bar & thumb
    const fist = new THREE.Group();
    fist.position.set(0, -0.238, 0);
    forearmVisual.add(fist);

    const tapeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.037, 0.033, 0.056, 16),
      tapeMat,
    );
    tapeMesh.position.y = -0.016;
    fist.add(tapeMesh);

    const padMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.051, 16, 14),
      gloveMat,
    );
    padMesh.position.set(0, -0.066, 0.012);
    padMesh.scale.set(0.94, 1.1, 0.86);
    padMesh.castShadow = true;
    fist.add(padMesh);

    const knuckleGeo = new THREE.CapsuleGeometry(0.02, 0.042, 4, 8);
    const knuckleRidge = new THREE.Mesh(knuckleGeo, gloveMat);
    knuckleRidge.rotation.z = Math.PI / 2;
    knuckleRidge.position.set(0, -0.084, 0.034);
    fist.add(knuckleRidge);

    const knuckleBlood = new THREE.Mesh(knuckleGeo, knuckleBloodMat);
    knuckleBlood.rotation.z = Math.PI / 2;
    knuckleBlood.position.set(0, -0.084, 0.035);
    knuckleBlood.scale.setScalar(1.04);
    fist.add(knuckleBlood);

    const thumbMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.015, 0.03, 4, 8),
      gloveMat,
    );
    thumbMesh.position.set(-side * 0.04, -0.068, 0.024);
    thumbMesh.rotation.z = side * 0.4;
    fist.add(thumbMesh);

    return {
      clavicle,
      shoulderPivot,
      upperArm,
      upperArmVisual,
      elbowPivot,
      forearm,
      forearmVisual,
      fist,
    };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Lower Limb Builder: hipPivot -> thigh -> kneePivot -> shin -> anklePivot -> foot
  const buildLeg = (
    side: -1 | 1,
    hasKneeSleeve: boolean,
    hasAnkleWrap: boolean,
  ) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.104, -0.044, 0);
    pelvis.add(hipPivot);

    const thigh = new THREE.Group();
    hipPivot.add(thigh);

    const thighVisual = new THREE.Group();
    thigh.add(thighVisual);

    const hipCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.086, 16, 14),
      shortsMat,
    );
    thighVisual.add(hipCap);

    const cuffMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.084, 0.21, 20),
      shortsMat,
    );
    cuffMesh.position.y = -0.095;
    cuffMesh.castShadow = true;
    thighVisual.add(cuffMesh);

    const quadProfile = [
      new THREE.Vector2(0.001, -0.41),
      new THREE.Vector2(0.054, -0.39),
      new THREE.Vector2(0.075, -0.22),
      new THREE.Vector2(0.083, -0.06),
      new THREE.Vector2(0.001, 0.0),
    ];
    const quadMesh = new THREE.Mesh(
      new THREE.LatheGeometry(quadProfile, 20),
      limbSkinMat,
    );
    quadMesh.scale.set(0.96, 1.0, 1.06);
    quadMesh.castShadow = true;
    thighVisual.add(quadMesh);

    // Knee hinge pivot
    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.405, 0);
    thigh.add(kneePivot);

    const shin = new THREE.Group();
    kneePivot.add(shin);

    const shinVisual = new THREE.Group();
    shin.add(shinVisual);

    const kneeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.054, 14, 12),
      hasKneeSleeve ? wrapMat : limbSkinMat,
    );
    shinVisual.add(kneeCap);

    if (hasKneeSleeve) {
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062, 0.056, 0.145, 16),
        wrapMat,
      );
      sleeve.position.y = -0.02;
      shinVisual.add(sleeve);
    }

    const calfProfile = [
      new THREE.Vector2(0.001, -0.41),
      new THREE.Vector2(0.036, -0.382),
      new THREE.Vector2(0.058, -0.165),
      new THREE.Vector2(0.054, -0.02),
      new THREE.Vector2(0.001, 0.0),
    ];
    const calfMesh = new THREE.Mesh(
      new THREE.LatheGeometry(calfProfile, 20),
      limbSkinMat,
    );
    calfMesh.castShadow = true;
    shinVisual.add(calfMesh);

    if (hasAnkleWrap) {
      const ankleWrap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.043, 0.041, 0.105, 16),
        wrapMat,
      );
      ankleWrap.position.y = -0.355;
      shinVisual.add(ankleWrap);
    }

    // Ankle pivot & grounded anatomical foot
    const anklePivot = new THREE.Group();
    anklePivot.position.set(0, -0.405, 0);
    shinVisual.add(anklePivot);

    const foot = new THREE.Group();
    anklePivot.add(foot);

    const footMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.035, 0.13, 6, 12),
      hasAnkleWrap ? wrapMat : limbSkinMat,
    );
    footMesh.rotation.x = Math.PI / 2;
    footMesh.position.set(0, -0.02, 0.058);
    footMesh.scale.set(1.12, 1.0, 0.72);
    footMesh.castShadow = true;
    foot.add(footMesh);

    return {
      hipPivot,
      thigh,
      thighVisual,
      kneePivot,
      shin,
      shinVisual,
      anklePivot,
      foot,
    };
  };

  const leftLeg = buildLeg(
    -1,
    profile.appearance.hasLeftKneeSleeve,
    profile.appearance.hasLeftAnkleWrap,
  );
  const rightLeg = buildLeg(1, false, profile.appearance.hasRightAnkleWrap);

  let mixamo: MixamoRigController | null = null;
  let customModelAttached = false;
  let customDisplayRoot: THREE.Group | null = null;
  let customFlashMaterials: THREE.MeshStandardMaterial[] = [];
  let customHeadBone: THREE.Object3D | null = null;
  let customNeckBone: THREE.Object3D | null = null;
  let customHipsBone: THREE.Object3D | null = null;

  const bundle = getResolvedMixamoBundle();
  const conorTemplate = profile.id === 'mcgregor' ? getResolvedConorModel() : null;
  if (bundle && conorTemplate) {
    const conorCtrl = createConorMixamoController(bundle, conorTemplate);
    mixamo = conorCtrl;
    customModelAttached = true;
    customDisplayRoot = conorCtrl.displayRoot;
    customFlashMaterials = conorCtrl.flashMaterials;
    customHeadBone = conorCtrl.headBone;
    customNeckBone = conorCtrl.neckBone;
    customHipsBone = conorCtrl.hipsBone;
    root.add(conorCtrl.displayRoot);
    pelvis.visible = false;
  } else if (bundle) {
    mixamo = createMixamoRigController(bundle, MIXAMO_BONE_LAYOUT);
    root.add(mixamo.skeletonRoot);
  }

  return {
    root,
    pelvis,
    abdomen,
    chest,
    neck,
    head,
    clavicleL: leftArm.clavicle,
    shoulderPivotL: leftArm.shoulderPivot,
    upperArmL: leftArm.upperArm,
    elbowPivotL: leftArm.elbowPivot,
    forearmL: leftArm.forearm,
    fistL: leftArm.fist,
    clavicleR: rightArm.clavicle,
    shoulderPivotR: rightArm.shoulderPivot,
    upperArmR: rightArm.upperArm,
    elbowPivotR: rightArm.elbowPivot,
    forearmR: rightArm.forearm,
    fistR: rightArm.fist,
    hipPivotL: leftLeg.hipPivot,
    thighL: leftLeg.thigh,
    kneePivotL: leftLeg.kneePivot,
    shinL: leftLeg.shin,
    anklePivotL: leftLeg.anklePivot,
    footL: leftLeg.foot,
    hipPivotR: rightLeg.hipPivot,
    thighR: rightLeg.thigh,
    kneePivotR: rightLeg.kneePivot,
    shinR: rightLeg.shin,
    anklePivotR: rightLeg.anklePivot,
    footR: rightLeg.foot,
    skinMaterial: skinMat,
    abdomenSkinMaterial: abdomenSkinMat,
    faceMaterial: faceMat,
    faceBloodCanvas,
    faceBloodTex,
    faceBloodMaterial: faceBloodMat,
    chestBloodCanvas,
    chestBloodTex,
    chestBloodMaterial: chestBloodMat,
    knuckleBloodMaterial: knuckleBloodMat,
    lastFaceBloodTier: 0,
    lastChestBloodTier: 0,
    lastBleedSide: 0,
    shadowDisc,
    segmentGroups: {
      hipsVisual,
      abdomenVisual,
      spine2Visual,
      neckVisual,
      headVisual,
      leftArmVisual: leftArm.upperArmVisual,
      leftForeArmVisual: leftArm.forearmVisual,
      rightArmVisual: rightArm.upperArmVisual,
      rightForeArmVisual: rightArm.forearmVisual,
      leftUpLegVisual: leftLeg.thighVisual,
      leftLegVisual: leftLeg.shinVisual,
      rightUpLegVisual: rightLeg.thighVisual,
      rightLegVisual: rightLeg.shinVisual,
    },
    profileId: profile.id,
    mixamo,
    mixamoAttached: false,
    customModelAttached,
    customDisplayRoot,
    customFlashMaterials,
    customHeadBone,
    customNeckBone,
    customHipsBone,
    customHeadHidden: false,
    lastMixamoStrikeId: null,
    lastMixamoActionTime: 0,
  };
}

function interpolatePose(
  rig: JointMap,
  target: PoseAngles,
  alphaBody: number,
  alphaLimbs: number,
) {
  rig.pelvis.position.x = lerp(rig.pelvis.position.x, target.pelvisX, alphaBody);
  rig.pelvis.position.y = lerp(rig.pelvis.position.y, target.pelvisY, alphaBody);
  rig.pelvis.position.z = lerp(rig.pelvis.position.z, target.pelvisZ, alphaBody);
  rig.pelvis.rotation.x = lerp(rig.pelvis.rotation.x, target.pelvisRot[0], alphaBody);
  rig.pelvis.rotation.y = lerp(rig.pelvis.rotation.y, target.pelvisRot[1], alphaBody);
  rig.pelvis.rotation.z = lerp(rig.pelvis.rotation.z, target.pelvisRot[2], alphaBody);

  rig.abdomen.rotation.x = lerp(rig.abdomen.rotation.x, target.abdomenRot[0], alphaBody);
  rig.abdomen.rotation.y = lerp(rig.abdomen.rotation.y, target.abdomenRot[1], alphaBody);
  rig.abdomen.rotation.z = lerp(rig.abdomen.rotation.z, target.abdomenRot[2], alphaBody);

  rig.chest.rotation.x = lerp(rig.chest.rotation.x, target.chestRot[0], alphaBody);
  rig.chest.rotation.y = lerp(rig.chest.rotation.y, target.chestRot[1], alphaBody);
  rig.chest.rotation.z = lerp(rig.chest.rotation.z, target.chestRot[2], alphaBody);

  rig.neck.rotation.x = lerp(rig.neck.rotation.x, target.neckRot[0], alphaBody);
  rig.neck.rotation.y = lerp(rig.neck.rotation.y, target.neckRot[1], alphaBody);
  rig.neck.rotation.z = lerp(rig.neck.rotation.z, target.neckRot[2], alphaBody);

  rig.head.rotation.x = lerp(rig.head.rotation.x, target.headRot[0], alphaBody);
  rig.head.rotation.y = lerp(rig.head.rotation.y, target.headRot[1], alphaBody);
  rig.head.rotation.z = lerp(rig.head.rotation.z, target.headRot[2], alphaBody);

  rig.clavicleL.rotation.set(
    lerp(rig.clavicleL.rotation.x, target.clavicleL[0], alphaLimbs),
    lerp(rig.clavicleL.rotation.y, target.clavicleL[1], alphaLimbs),
    lerp(rig.clavicleL.rotation.z, target.clavicleL[2], alphaLimbs),
  );
  rig.shoulderPivotL.rotation.set(
    lerp(rig.shoulderPivotL.rotation.x, target.shoulderL[0], alphaLimbs),
    lerp(rig.shoulderPivotL.rotation.y, target.shoulderL[1], alphaLimbs),
    lerp(rig.shoulderPivotL.rotation.z, target.shoulderL[2], alphaLimbs),
  );
  rig.elbowPivotL.rotation.set(
    lerp(rig.elbowPivotL.rotation.x, target.elbowL[0], alphaLimbs),
    lerp(rig.elbowPivotL.rotation.y, target.elbowL[1], alphaLimbs),
    lerp(rig.elbowPivotL.rotation.z, target.elbowL[2], alphaLimbs),
  );
  rig.fistL.rotation.set(
    lerp(rig.fistL.rotation.x, target.fistL[0], alphaLimbs),
    lerp(rig.fistL.rotation.y, target.fistL[1], alphaLimbs),
    lerp(rig.fistL.rotation.z, target.fistL[2], alphaLimbs),
  );

  rig.clavicleR.rotation.set(
    lerp(rig.clavicleR.rotation.x, target.clavicleR[0], alphaLimbs),
    lerp(rig.clavicleR.rotation.y, target.clavicleR[1], alphaLimbs),
    lerp(rig.clavicleR.rotation.z, target.clavicleR[2], alphaLimbs),
  );
  rig.shoulderPivotR.rotation.set(
    lerp(rig.shoulderPivotR.rotation.x, target.shoulderR[0], alphaLimbs),
    lerp(rig.shoulderPivotR.rotation.y, target.shoulderR[1], alphaLimbs),
    lerp(rig.shoulderPivotR.rotation.z, target.shoulderR[2], alphaLimbs),
  );
  rig.elbowPivotR.rotation.set(
    lerp(rig.elbowPivotR.rotation.x, target.elbowR[0], alphaLimbs),
    lerp(rig.elbowPivotR.rotation.y, target.elbowR[1], alphaLimbs),
    lerp(rig.elbowPivotR.rotation.z, target.elbowR[2], alphaLimbs),
  );
  rig.fistR.rotation.set(
    lerp(rig.fistR.rotation.x, target.fistR[0], alphaLimbs),
    lerp(rig.fistR.rotation.y, target.fistR[1], alphaLimbs),
    lerp(rig.fistR.rotation.z, target.fistR[2], alphaLimbs),
  );

  rig.hipPivotL.rotation.set(
    lerp(rig.hipPivotL.rotation.x, target.hipL[0], alphaLimbs),
    lerp(rig.hipPivotL.rotation.y, target.hipL[1], alphaLimbs),
    lerp(rig.hipPivotL.rotation.z, target.hipL[2], alphaLimbs),
  );
  rig.kneePivotL.rotation.set(
    lerp(rig.kneePivotL.rotation.x, target.kneeL[0], alphaLimbs),
    lerp(rig.kneePivotL.rotation.y, target.kneeL[1], alphaLimbs),
    lerp(rig.kneePivotL.rotation.z, target.kneeL[2], alphaLimbs),
  );
  rig.anklePivotL.rotation.set(
    lerp(rig.anklePivotL.rotation.x, target.ankleL[0], alphaLimbs),
    lerp(rig.anklePivotL.rotation.y, target.ankleL[1], alphaLimbs),
    lerp(rig.anklePivotL.rotation.z, target.ankleL[2], alphaLimbs),
  );

  rig.hipPivotR.rotation.set(
    lerp(rig.hipPivotR.rotation.x, target.hipR[0], alphaLimbs),
    lerp(rig.hipPivotR.rotation.y, target.hipR[1], alphaLimbs),
    lerp(rig.hipPivotR.rotation.z, target.hipR[2], alphaLimbs),
  );
  rig.kneePivotR.rotation.set(
    lerp(rig.kneePivotR.rotation.x, target.kneeR[0], alphaLimbs),
    lerp(rig.kneePivotR.rotation.y, target.kneeR[1], alphaLimbs),
    lerp(rig.kneePivotR.rotation.z, target.kneeR[2], alphaLimbs),
  );
  rig.anklePivotR.rotation.set(
    lerp(rig.anklePivotR.rotation.x, target.ankleR[0], alphaLimbs),
    lerp(rig.anklePivotR.rotation.y, target.ankleR[1], alphaLimbs),
    lerp(rig.anklePivotR.rotation.z, target.ankleR[2], alphaLimbs),
  );
}

export function applyMainMenuHeroPose(
  rig: JointMap,
  timeSec: number,
  dt: number,
) {
  ensureCustomOrMixamoRig(rig);
  detachRigFromMixamoBones(rig);
  // Cinematic close-up bust pose matching hero lighting stage
  rig.root.position.set(0.36, 0, 0.22);
  rig.root.rotation.y = -0.34;

  if (rig.customModelAttached && rig.mixamo) {
    rig.pelvis.visible = false;
    if (rig.customDisplayRoot) {
      rig.customDisplayRoot.visible = true;
      rig.customDisplayRoot.position.set(0, 0, 0);
      rig.customDisplayRoot.rotation.set(0, 0, 0);
    }
    rig.mixamo.playWalkGuard(0.18);
    rig.mixamo.update(dt);
    for (const m of rig.customFlashMaterials) {
      m.emissiveIntensity = 0;
    }
    return;
  }

  const breath = Math.sin(timeSec * 1.65) * 0.011;
  const pose = createZeroPose();
  pose.pelvisY = 0.94 + breath * 0.2;
  pose.chestRot = [-0.04 + breath, 0.06, 0];
  pose.headRot = [-0.14, 0.22 + Math.sin(timeSec * 0.65) * 0.035, -0.025];

  pose.shoulderL = [-0.1, 0.06, -0.13];
  pose.elbowL = [-0.28, 0.1, 0.06];
  pose.shoulderR = [-0.1, -0.06, 0.13];
  pose.elbowR = [-0.28, -0.1, -0.06];

  const alpha = 1 - Math.exp(-8 * Math.min(dt, 0.05));
  interpolatePose(rig, pose, alpha, alpha);
  rig.skinMaterial.emissiveIntensity = 0;
  rig.abdomenSkinMaterial.emissiveIntensity = 0;
  rig.faceMaterial.emissiveIntensity = 0;
  rig.faceBloodMaterial.opacity = 0;
  rig.chestBloodMaterial.opacity = 0;
  rig.knuckleBloodMaterial.opacity = 0;
}

export function applySelectShowcasePose(
  rig: JointMap,
  corner: 'red' | 'blue',
  timeSec: number,
  dt: number,
) {
  ensureCustomOrMixamoRig(rig);
  detachRigFromMixamoBones(rig);
  const isRed = corner === 'red';
  rig.root.position.set(isRed ? -1.02 : 1.02, 0, 0.35);
  rig.root.rotation.y = isRed ? 0.18 : -0.18;

  if (rig.customModelAttached && rig.mixamo) {
    rig.pelvis.visible = false;
    if (rig.customDisplayRoot) {
      rig.customDisplayRoot.visible = true;
      rig.customDisplayRoot.position.set(0, 0, 0);
      rig.customDisplayRoot.rotation.set(0, 0, 0);
    }
    rig.mixamo.playWalkGuard(0.24);
    rig.mixamo.update(dt);
    for (const m of rig.customFlashMaterials) {
      m.emissiveIntensity = 0;
    }
    return;
  }

  const breath = Math.sin(timeSec * 2.2 + (isRed ? 0 : 1.1)) * 0.015;
  const pose = createZeroPose();
  pose.pelvisY = 0.94 + breath * 0.3;
  pose.chestRot = [-0.04 + breath, 0, 0];
  pose.headRot = [-0.04, isRed ? -0.1 : 0.1, 0];

  pose.shoulderL = [-0.22, 0.12, -0.2];
  pose.elbowL = [-0.6, 0.16, 0.1];
  pose.shoulderR = [-0.22, -0.12, 0.2];
  pose.elbowR = [-0.6, -0.16, -0.1];
  pose.hipL = [-0.04, 0.08, -0.09];
  pose.hipR = [-0.04, -0.08, 0.09];
  pose.kneeL = [0.06, 0, 0];
  pose.kneeR = [0.06, 0, 0];

  const alpha = 1 - Math.exp(-10 * Math.min(dt, 0.05));
  interpolatePose(rig, pose, alpha, alpha);
  rig.skinMaterial.emissiveIntensity = 0;
  rig.abdomenSkinMaterial.emissiveIntensity = 0;
  rig.faceMaterial.emissiveIntensity = 0;
  rig.faceBloodMaterial.opacity = 0;
  rig.chestBloodMaterial.opacity = 0;
  rig.knuckleBloodMaterial.opacity = 0;
}

export function applyFighterPose(
  rig: JointMap,
  state: FighterState,
  timeSec: number,
  dt: number,
  isKoWinner = false,
) {
  rig.root.position.set(state.x, 0, state.z);
  rig.root.rotation.y = state.facingYaw;

  const speed = Math.hypot(state.vx, state.vz);
  const staminaRatio = state.stamina / Math.max(1, state.maxStamina);
  const base = getIdleGuardPose(state.stance, state.gaitPhase, speed, timeSec, staminaRatio);
  let target: PoseAngles = base;

  if (isKoWinner && state.action !== 'ko') {
    const celeb = Math.sin(timeSec * 4.2) * 0.04;
    target = clonePose(base);
    target.pelvisY = 0.955 + Math.abs(celeb) * 0.25;
    target.chestRot = [-0.14, 0.14, 0];
    target.headRot = [-0.22, Math.sin(timeSec * 1.4) * 0.12, 0];
    target.clavicleL = [-0.24, 0, -0.25];
    target.clavicleR = [-0.24, 0, 0.25];
    target.shoulderL = [-2.55 + celeb, 0.22, -0.46];
    target.elbowL = [-0.42, 0.1, 0.14];
    target.shoulderR = [-2.68 - celeb, -0.2, 0.42];
    target.elbowR = [-0.36, -0.1, -0.14];
    target.hipL = [-0.08, 0.12, -0.12];
    target.hipR = [0.06, -0.1, 0.12];
    target.kneeL = [0.12, 0, 0];
    target.kneeR = [0.08, 0, 0];
  } else if (state.action === 'strike' && state.currentStrike) {
    const progress = Math.min(
      1,
      state.actionTime / Math.max(0.01, state.actionDuration),
    );
    target = getStrikeKeyframePose(state.currentStrike, state.stance, progress, base);
  } else if (state.action === 'slipLeft' || state.action === 'slipRight') {
    const p = Math.sin(
      Math.min(1, state.actionTime / Math.max(0.01, state.actionDuration)) *
        Math.PI,
    );
    const dir = state.action === 'slipLeft' ? -1 : 1;
    target = clonePose(base);
    target.pelvisY = base.pelvisY - 0.09 * p;
    target.abdomenRot = [0.24 * p, base.abdomenRot[1], dir * 0.42 * p];
    target.chestRot = [base.chestRot[0], base.chestRot[1], dir * 0.28 * p];
    target.headRot = [base.headRot[0], base.headRot[1], -dir * 0.24 * p];
  } else if (state.action === 'pullBack') {
    const p = Math.sin(
      Math.min(1, state.actionTime / Math.max(0.01, state.actionDuration)) *
        Math.PI,
    );
    target = clonePose(base);
    target.abdomenRot = [-0.36 * p, base.abdomenRot[1], 0];
    target.chestRot = [-0.3 * p, base.chestRot[1], 0];
    target.headRot = [0.24 * p, base.headRot[1], 0];
  } else if (state.action === 'duck') {
    const p = Math.sin(
      Math.min(1, state.actionTime / Math.max(0.01, state.actionDuration)) *
        Math.PI,
    );
    target = clonePose(base);
    target.pelvisY = base.pelvisY - 0.19 * p;
    target.abdomenRot = [0.56 * p, base.abdomenRot[1], 0];
    target.chestRot = [0.42 * p, base.chestRot[1], 0];
    target.headRot = [-0.25 * p, base.headRot[1], 0];
    target.hipL = [-0.62 * p + base.hipL[0], base.hipL[1], base.hipL[2]];
    target.kneeL = [0.76 * p + base.kneeL[0], 0, 0];
    target.hipR = [-0.45 * p + base.hipR[0], base.hipR[1], base.hipR[2]];
    target.kneeR = [0.68 * p + base.kneeR[0], 0, 0];
    target.shoulderL = [-1.2, 0.24, -0.1];
    target.shoulderR = [-1.2, -0.24, 0.1];
  } else if (state.action === 'hitReact') {
    const p = Math.sin(
      Math.min(1, state.actionTime / Math.max(0.01, state.actionDuration)) *
        Math.PI,
    );
    const k = state.hitReactIntensity * p;
    const hitDir = state.hitReactSide === 0 ? 1 : state.hitReactSide;
    target = clonePose(base);
    if (state.hitReactZone === 'head') {
      target.abdomenRot = [-0.14 * k, base.abdomenRot[1], 0];
      target.chestRot = [-0.34 * k, base.chestRot[1] + 0.22 * hitDir * k, 0];
      target.headRot = [-0.72 * k, base.headRot[1] + 0.44 * hitDir * k, -0.26 * hitDir * k];
      target.shoulderL = [-0.52, -0.24, -0.38];
      target.shoulderR = [-0.52, 0.24, 0.38];
    } else if (state.hitReactZone === 'body') {
      target.abdomenRot = [0.54 * k, base.abdomenRot[1], 0];
      target.chestRot = [0.44 * k, base.chestRot[1], 0.16 * hitDir * k];
      target.pelvisY = base.pelvisY - 0.12 * k;
      target.shoulderL = [-0.7, 0.18, -0.25];
      target.shoulderR = [-0.7, -0.18, 0.25];
    } else {
      target.pelvisY = base.pelvisY - 0.13 * k;
      target.pelvisRot = [base.pelvisRot[0], base.pelvisRot[1], 0.28 * hitDir * k];
      target.hipL = [-0.62 * k, 0.12, -0.14];
      target.kneeL = [0.74 * k, 0, 0];
    }
  } else if (state.action === 'stunned') {
    const wobble = Math.sin(timeSec * 10.5);
    const kneeBuckle = Math.max(0, Math.sin(timeSec * 7.2));
    if (state.guard === 'high' || state.guard === 'low') {
      target = getBlockPose(state.guard, state.stance, base, timeSec);
      target.pelvisY -= 0.08 + kneeBuckle * 0.04;
      target.pelvisRot = [target.pelvisRot[0], target.pelvisRot[1], wobble * 0.11];
      target.abdomenRot = [target.abdomenRot[0], target.abdomenRot[1], wobble * 0.16];
      target.chestRot = [target.chestRot[0], target.chestRot[1], wobble * 0.18];
      target.hipL = [target.hipL[0] - kneeBuckle * 0.2, target.hipL[1], target.hipL[2]];
      target.kneeL = [target.kneeL[0] + kneeBuckle * 0.28, 0, 0];
      target.hipR = [target.hipR[0] - (1 - kneeBuckle) * 0.16, target.hipR[1], target.hipR[2]];
      target.kneeR = [target.kneeR[0] + (1 - kneeBuckle) * 0.22, 0, 0];
    } else {
      target = clonePose(base);
      target.pelvisY = base.pelvisY - 0.12 - kneeBuckle * 0.05;
      target.pelvisRot = [base.pelvisRot[0], base.pelvisRot[1], wobble * 0.16];
      target.abdomenRot = [base.abdomenRot[0], base.abdomenRot[1], wobble * 0.28];
      target.chestRot = [-0.16, base.chestRot[1], wobble * 0.32];
      target.headRot = [-0.28, base.headRot[1], -wobble * 0.22];
      target.hipL = [base.hipL[0] - kneeBuckle * 0.28, base.hipL[1], -0.12];
      target.kneeL = [base.kneeL[0] + kneeBuckle * 0.38, 0, 0];
      target.hipR = [base.hipR[0] - (1 - kneeBuckle) * 0.22, base.hipR[1], 0.12];
      target.kneeR = [base.kneeR[0] + (1 - kneeBuckle) * 0.3, 0, 0];
      target.shoulderL = [-0.42, -0.18, -0.48 + wobble * 0.12];
      target.elbowL = [-0.85, 0, 0.1];
      target.shoulderR = [-0.42, 0.18, 0.48 + wobble * 0.12];
      target.elbowR = [-0.85, 0, -0.1];
    }
  } else if (state.action === 'knockdown') {
    target = getKnockdownPose(state, base);
  } else if (state.action === 'ko') {
    target = getKnockoutPose(state, base);
  } else if (state.guard === 'high' || state.guard === 'low') {
    target = getBlockPose(state.guard, state.stance, base, timeSec);
  }

  // Lazily bind preloaded Mixamo / ConorMcgregr.fbx rig once async FBX load completes
  ensureCustomOrMixamoRig(rig);

  let desiredMixamo: MixamoActionKind = 'none';
  const strikeId = state.currentStrike ?? null;
  const strikeSpec = strikeId ? STRIKES[strikeId] : null;
  const isHookStrike =
    strikeId === 'leadHook' ||
    strikeId === 'rearHook' ||
    strikeId === 'bodyHook' ||
    strikeId === 'rearBodyHook' ||
    strikeId === 'leadUppercut' ||
    strikeId === 'rearUppercut' ||
    strikeId === 'overhand';

  if (rig.mixamo && !(isKoWinner && state.action !== 'ko')) {
    if (state.action === 'ko' && rig.mixamo.actions.knockedOut) {
      desiredMixamo = 'knockedOut';
    } else if (state.action === 'strike' && strikeSpec) {
      if (strikeSpec.isKick && rig.mixamo.actions.mmaKick) {
        desiredMixamo = 'mmaKick';
      } else if (isHookStrike && rig.mixamo.actions.hookPunch) {
        desiredMixamo = 'hookPunch';
      } else if (rig.mixamo.actions.jabPunch) {
        desiredMixamo = 'jabPunch';
      }
    } else if (
      state.action === 'idle' &&
      (state.guard === 'high' || state.guard === 'low') &&
      rig.mixamo.actions.walkGuard
    ) {
      desiredMixamo = 'walkGuard';
    } else if (
      state.action === 'idle' &&
      state.guard === 'none' &&
      speed >= 0.15 &&
      rig.mixamo.actions.walkNeutral
    ) {
      desiredMixamo = 'walkNeutral';
    } else if (rig.customModelAttached) {
      // Keep Conor's real skinned character model active across all combat states
      desiredMixamo = rig.mixamo.actions.walkGuard ? 'walkGuard' : 'walkNeutral';
    }
  } else if (rig.customModelAttached && rig.mixamo) {
    desiredMixamo = rig.mixamo.actions.walkGuard ? 'walkGuard' : 'walkNeutral';
  }

  if (desiredMixamo !== 'none' && rig.mixamo) {
    attachRigToMixamoBones(rig);

    if (rig.customModelAttached && rig.customDisplayRoot) {
      rig.pelvis.visible = false;
      rig.customDisplayRoot.visible = true;
      let dY = 0;
      let rX = 0;
      let rZ = 0;
      if (state.action === 'slipLeft' || state.action === 'slipRight') {
        const p = Math.sin(
          Math.min(1, state.actionTime / Math.max(0.01, state.actionDuration)) *
            Math.PI,
        );
        const dir = state.action === 'slipLeft' ? -1 : 1;
        dY = -0.07 * p;
        rZ = -dir * 0.24 * p;
      } else if (state.action === 'pullBack') {
        const p = Math.sin(
          Math.min(1, state.actionTime / Math.max(0.01, state.actionDuration)) *
            Math.PI,
        );
        rX = -0.22 * p;
      } else if (state.action === 'duck') {
        const p = Math.sin(
          Math.min(1, state.actionTime / Math.max(0.01, state.actionDuration)) *
            Math.PI,
        );
        dY = -0.26 * p;
        rX = 0.22 * p;
      } else if (state.action === 'hitReact') {
        const p = Math.sin(
          Math.min(1, state.actionTime / Math.max(0.01, state.actionDuration)) *
            Math.PI,
        );
        const k = state.hitReactIntensity * p;
        const hitDir = state.hitReactSide === 0 ? 1 : state.hitReactSide;
        if (state.hitReactZone === 'head') {
          rX = -0.18 * k;
          rZ = -0.14 * hitDir * k;
        } else {
          dY = -0.08 * k;
          rX = 0.18 * k;
        }
      } else if (state.action === 'stunned') {
        rZ = Math.sin(timeSec * 10.5) * 0.14;
        dY = -0.07;
      } else if (state.action === 'knockdown') {
        const t = clamp(state.actionTime / Math.max(0.01, state.actionDuration), 0, 1);
        const p = t < 0.45 ? t / 0.45 : Math.max(0, 1 - (t - 0.45) / 0.55);
        rX = -1.25 * p;
        dY = -0.18 * p;
      }
      rig.customDisplayRoot.position.set(0, dY, 0);
      rig.customDisplayRoot.rotation.set(rX, 0, rZ);
    }

    const fwdVel =
      state.vx * Math.sin(state.facingYaw) + state.vz * Math.cos(state.facingYaw);
    const walkSign = fwdVel < -0.15 ? -1 : 1;

    if (desiredMixamo === 'walkNeutral') {
      const s =
        speed >= 0.15 ? walkSign * clamp(speed / 1.45, 0.65, 1.35) : 0.18;
      rig.mixamo.playWalkNeutral(s);
    } else if (desiredMixamo === 'walkGuard') {
      const s =
        speed >= 0.15 ? walkSign * clamp(speed / 1.35, 0.55, 1.25) : 0.18;
      rig.mixamo.playWalkGuard(s);
    } else {
      const shouldTrigger =
        rig.mixamo.activeMode !== desiredMixamo ||
        ((desiredMixamo === 'mmaKick' ||
          desiredMixamo === 'jabPunch' ||
          desiredMixamo === 'hookPunch') &&
          (rig.lastMixamoStrikeId !== strikeId ||
            state.actionTime < rig.lastMixamoActionTime - 0.02));

      if (shouldTrigger) {
        if (desiredMixamo === 'knockedOut') {
          rig.mixamo.triggerKnockedOut();
        } else if (desiredMixamo === 'mmaKick') {
          rig.mixamo.triggerMmaKick(state.actionDuration);
        } else if (desiredMixamo === 'hookPunch') {
          rig.mixamo.triggerHookPunch(state.actionDuration);
        } else if (desiredMixamo === 'jabPunch') {
          rig.mixamo.triggerJabPunch(state.actionDuration);
        }
      }
    }

    rig.mixamo.update(dt);

    if (rig.customModelAttached) {
      setFighterHeadHidden(rig, rig.customHeadHidden);
    }

    // Keep contact shadow disc directly beneath the Mixamo-animated hips
    const hipsBone = rig.customHipsBone ?? rig.mixamo.attachments.bones.Hips;
    if (hipsBone) {
      hipsBone.getWorldPosition(_mixamoShadowVec);
      rig.root.worldToLocal(_mixamoShadowVec);
      rig.shadowDisc.position.set(_mixamoShadowVec.x, 0.015, _mixamoShadowVec.z);
    }
    rig.lastMixamoStrikeId = strikeId;
    rig.lastMixamoActionTime = state.actionTime;
  } else {
    detachRigFromMixamoBones(rig);
    rig.lastMixamoStrikeId = strikeId;
    rig.lastMixamoActionTime = state.actionTime;

    const limbRate =
      state.action === 'strike' || state.action === 'hitReact' || state.action === 'ko'
        ? 38
        : 20;
    const bodyRate =
      state.action === 'strike' || state.action === 'ko' || state.action === 'knockdown'
        ? 26
        : 15;
    const alphaBody = 1 - Math.exp(-bodyRate * Math.min(dt, 0.05));
    const alphaLimbs = 1 - Math.exp(-limbRate * Math.min(dt, 0.05));
    interpolatePose(rig, target, alphaBody, alphaLimbs);
  }

  // Prolonged orange-to-red rocked emissive pulse across head & torso
  if (state.rockedFlashTimer > 0) {
    const pulse = 0.72 + 0.28 * Math.sin(timeSec * 12);
    const fade = Math.min(1, state.rockedFlashTimer / 0.85);
    const intensity = fade * pulse * 0.95;
    rig.skinMaterial.emissive.setHex(0xff4e00);
    rig.skinMaterial.emissiveIntensity = intensity;
    rig.abdomenSkinMaterial.emissive.setHex(0xff4e00);
    rig.abdomenSkinMaterial.emissiveIntensity = intensity;
    rig.faceMaterial.emissive.setHex(0xff3800);
    rig.faceMaterial.emissiveIntensity = intensity;
    for (const m of rig.customFlashMaterials) {
      m.emissive.setHex(0xff4200);
      m.emissiveIntensity = intensity * 0.75;
    }
  } else if (state.hitFlashTimer > 0) {
    const intensity = Math.min(0.6, state.hitFlashTimer * 8);
    rig.skinMaterial.emissive.setHex(0x883322);
    rig.skinMaterial.emissiveIntensity = intensity;
    rig.abdomenSkinMaterial.emissive.setHex(0x883322);
    rig.abdomenSkinMaterial.emissiveIntensity = intensity;
    rig.faceMaterial.emissive.setHex(0x883322);
    rig.faceMaterial.emissiveIntensity = intensity;
    for (const m of rig.customFlashMaterials) {
      m.emissive.setHex(0x883322);
      m.emissiveIntensity = intensity * 0.75;
    }
  } else {
    rig.skinMaterial.emissiveIntensity = 0;
    rig.abdomenSkinMaterial.emissiveIntensity = 0;
    rig.faceMaterial.emissiveIntensity = 0;
    for (const m of rig.customFlashMaterials) {
      m.emissiveIntensity = 0;
    }
  }

  // Update progressive facial cuts, torso blood drips/bruising, and bloodied glove knuckles
  const headTier =
    state.headCutSeverity >= 0.88
      ? 5
      : state.headCutSeverity >= 0.68
        ? 4
        : state.headCutSeverity >= 0.46
          ? 3
          : state.headCutSeverity >= 0.26
            ? 2
            : state.headCutSeverity >= 0.11
              ? 1
              : 0;
  const chestHeadTier =
    state.headCutSeverity >= 0.72
      ? 3
      : state.headCutSeverity >= 0.48
        ? 2
        : state.headCutSeverity >= 0.28
          ? 1
          : 0;
  const chestBodyTier =
    state.bodyBruiseSeverity >= 0.65
      ? 3
      : state.bodyBruiseSeverity >= 0.4
        ? 2
        : state.bodyBruiseSeverity >= 0.18
          ? 1
          : 0;
  const combinedChestTier = chestHeadTier * 10 + chestBodyTier;

  if (headTier !== rig.lastFaceBloodTier || state.bleedSide !== rig.lastBleedSide) {
    rig.lastFaceBloodTier = headTier;
    rig.lastBleedSide = state.bleedSide;
    paintFaceBloodCanvas(rig.faceBloodCanvas, headTier, state.bleedSide);
    rig.faceBloodTex.needsUpdate = true;
  }
  rig.faceBloodMaterial.opacity = headTier > 0 ? Math.min(0.95, 0.55 + state.headCutSeverity * 0.4) : 0;

  if (combinedChestTier !== rig.lastChestBloodTier) {
    rig.lastChestBloodTier = combinedChestTier;
    paintChestBloodCanvas(rig.chestBloodCanvas, chestHeadTier, chestBodyTier, state.bleedSide);
    rig.chestBloodTex.needsUpdate = true;
  }
  rig.chestBloodMaterial.opacity =
    combinedChestTier > 0
      ? Math.min(0.9, Math.max(state.headCutSeverity, state.bodyBruiseSeverity) * 0.92)
      : 0;

  // Bloodied knuckles scale with how many clean head shots the fighter has landed
  rig.knuckleBloodMaterial.opacity = clamp(state.headLanded * 0.08, 0, 0.88);
}

export class SweatParticlePool {
  private readonly capacity = 200;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly lifetimes: Float32Array;
  private cursor = 0;
  public readonly points: THREE.Points;

  constructor() {
    this.positions = new Float32Array(this.capacity * 3);
    this.velocities = new Float32Array(this.capacity * 3);
    this.lifetimes = new Float32Array(this.capacity);

    for (let i = 0; i < this.capacity; i++) {
      this.positions[i * 3 + 1] = -99;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const mat = new THREE.PointsMaterial({
      map: createDropletTexture(),
      color: 0xffe8c2,
      size: 0.065,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  public spawnBurst(
    origin: { x: number; y: number; z: number },
    dirX: number,
    dirZ: number,
    count: number,
  ) {
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;

      const p = idx * 3;
      this.positions[p] = origin.x + (Math.random() - 0.5) * 0.08;
      this.positions[p + 1] = origin.y + (Math.random() - 0.5) * 0.08;
      this.positions[p + 2] = origin.z + (Math.random() - 0.5) * 0.08;

      const spread = 1.9;
      this.velocities[p] =
        dirX * (2.2 + Math.random() * 2.5) + (Math.random() - 0.5) * spread;
      this.velocities[p + 1] = 1.5 + Math.random() * 2.6;
      this.velocities[p + 2] =
        dirZ * (2.2 + Math.random() * 2.5) + (Math.random() - 0.5) * spread;

      this.lifetimes[idx] = 0.45 + Math.random() * 0.35;
    }
  }

  public update(dt: number) {
    for (let i = 0; i < this.capacity; i++) {
      if (this.lifetimes[i] <= 0) continue;
      this.lifetimes[i] -= dt;
      const p = i * 3;
      if (this.lifetimes[i] <= 0) {
        this.positions[p + 1] = -99;
        continue;
      }
      this.velocities[p + 1] -= 9.8 * dt;
      this.positions[p] += this.velocities[p] * dt;
      this.positions[p + 1] += this.velocities[p + 1] * dt;
      this.positions[p + 2] += this.velocities[p + 2] * dt;
      if (this.positions[p + 1] < 0.02) {
        this.lifetimes[i] = 0;
        this.positions[p + 1] = -99;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  public dispose() {
    this.points.geometry.dispose();
    const mat = this.points.material as THREE.PointsMaterial;
    mat.map?.dispose();
    mat.dispose();
  }
}

export class BloodParticlePool {
  private readonly capacity = 260;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly lifetimes: Float32Array;
  private cursor = 0;
  public readonly points: THREE.Points;

  constructor() {
    this.positions = new Float32Array(this.capacity * 3);
    this.velocities = new Float32Array(this.capacity * 3);
    this.lifetimes = new Float32Array(this.capacity);

    for (let i = 0; i < this.capacity; i++) {
      this.positions[i * 3 + 1] = -99;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const mat = new THREE.PointsMaterial({
      map: createBloodDropletTexture(),
      color: 0xffffff,
      size: 0.088,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  public spawnBurst(
    origin: { x: number; y: number; z: number },
    dirX: number,
    dirZ: number,
    count: number,
    speedScale = 1,
  ) {
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;

      const p = idx * 3;
      this.positions[p] = origin.x + (Math.random() - 0.5) * 0.09;
      this.positions[p + 1] = origin.y + (Math.random() - 0.5) * 0.08;
      this.positions[p + 2] = origin.z + (Math.random() - 0.5) * 0.09;

      const spread = 1.95 * speedScale;
      this.velocities[p] =
        dirX * (2.0 + Math.random() * 2.7) * speedScale + (Math.random() - 0.5) * spread;
      this.velocities[p + 1] = (1.1 + Math.random() * 2.2) * speedScale;
      this.velocities[p + 2] =
        dirZ * (2.0 + Math.random() * 2.7) * speedScale + (Math.random() - 0.5) * spread;

      this.lifetimes[idx] = 0.55 + Math.random() * 0.4;
    }
  }

  public spawnDrip(origin: { x: number; y: number; z: number }) {
    const idx = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const p = idx * 3;
    this.positions[p] = origin.x + (Math.random() - 0.5) * 0.06;
    this.positions[p + 1] = origin.y;
    this.positions[p + 2] = origin.z + (Math.random() - 0.5) * 0.06;

    this.velocities[p] = (Math.random() - 0.5) * 0.35;
    this.velocities[p + 1] = -0.35;
    this.velocities[p + 2] = (Math.random() - 0.5) * 0.35;
    this.lifetimes[idx] = 0.9;
  }

  public update(dt: number, onMatHit?: (x: number, z: number) => void) {
    for (let i = 0; i < this.capacity; i++) {
      if (this.lifetimes[i] <= 0) continue;
      this.lifetimes[i] -= dt;
      const p = i * 3;
      if (this.lifetimes[i] <= 0) {
        this.positions[p + 1] = -99;
        continue;
      }
      this.velocities[p + 1] -= 9.8 * dt;
      this.positions[p] += this.velocities[p] * dt;
      this.positions[p + 1] += this.velocities[p + 1] * dt;
      this.positions[p + 2] += this.velocities[p + 2] * dt;
      if (this.positions[p + 1] <= 0.02) {
        if (onMatHit && Math.random() < 0.45) {
          onMatHit(this.positions[p], this.positions[p + 2]);
        }
        this.lifetimes[i] = 0;
        this.positions[p + 1] = -99;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  public dispose() {
    this.points.geometry.dispose();
    const mat = this.points.material as THREE.PointsMaterial;
    mat.map?.dispose();
    mat.dispose();
  }
}
