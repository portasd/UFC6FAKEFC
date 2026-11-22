import * as THREE from 'three';
import { FighterState } from './combatEngine';
import { FighterProfile, Stance } from './fighters';
import { STRIKES, StrikeId } from './strikes';

export interface JointMap {
  root: THREE.Group;
  pelvis: THREE.Group;
  abdomen: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  clavicleL: THREE.Group;
  upperArmL: THREE.Group;
  forearmL: THREE.Group;
  gloveL: THREE.Group;
  clavicleR: THREE.Group;
  upperArmR: THREE.Group;
  forearmR: THREE.Group;
  gloveR: THREE.Group;
  thighL: THREE.Group;
  shinL: THREE.Group;
  footL: THREE.Group;
  thighR: THREE.Group;
  shinR: THREE.Group;
  footR: THREE.Group;
  skinMaterial: THREE.MeshStandardMaterial;
  abdomenSkinMaterial: THREE.MeshStandardMaterial;
  faceMaterial: THREE.MeshStandardMaterial;
  shadowDisc: THREE.Mesh;
}

interface PoseAngles {
  pelvisY: number;
  pelvisZ: number;
  pelvisRotY: number;
  pelvisRotX: number;
  pelvisRotZ: number;
  abdomenRotX: number;
  abdomenRotY: number;
  abdomenRotZ: number;
  chestRotX: number;
  chestRotY: number;
  chestRotZ: number;
  headRotX: number;
  headRotY: number;
  headRotZ: number;
  clavicleL: [number, number, number];
  armL: [number, number, number];
  forearmL: [number, number, number];
  clavicleR: [number, number, number];
  armR: [number, number, number];
  forearmR: [number, number, number];
  thighL: [number, number, number];
  shinL: [number, number, number];
  footL: [number, number, number];
  thighR: [number, number, number];
  shinR: [number, number, number];
  footR: [number, number, number];
}

function createZeroPose(): PoseAngles {
  return {
    pelvisY: 0.94,
    pelvisZ: 0,
    pelvisRotY: 0,
    pelvisRotX: 0,
    pelvisRotZ: 0,
    abdomenRotX: 0,
    abdomenRotY: 0,
    abdomenRotZ: 0,
    chestRotX: 0,
    chestRotY: 0,
    chestRotZ: 0,
    headRotX: 0,
    headRotY: 0,
    headRotZ: 0,
    clavicleL: [0, 0, 0],
    armL: [0, 0, 0],
    forearmL: [0, 0, 0],
    clavicleR: [0, 0, 0],
    armR: [0, 0, 0],
    forearmR: [0, 0, 0],
    thighL: [0, 0, 0],
    shinL: [0, 0, 0],
    footL: [0, 0, 0],
    thighR: [0, 0, 0],
    shinR: [0, 0, 0],
    footR: [0, 0, 0],
  };
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

function easeOutQuint(x: number): number {
  const t = clamp(x, 0, 1);
  return 1 - Math.pow(1 - t, 5);
}

function easeInOutCubic(x: number): number {
  const t = clamp(x, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

let cachedSoftShadowTex: THREE.CanvasTexture | null = null;
let cachedSkinBumpTex: THREE.CanvasTexture | null = null;

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

function createSculptedHeadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.106, 40, 32);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i); // +X is front face prior to -PI/2 rotY
    let y = pos.getY(i);
    let z = pos.getZ(i); // lateral left/right

    const absZ = Math.abs(z);

    // Cranial proportion (tall athletic skull)
    y *= 1.12;
    z *= 0.89;

    // Athletic squared jaw & broad masculine chin (avoids conical taper)
    if (y < 0.014) {
      const jawT = clamp((0.014 - y) / 0.118, 0, 1);
      const chinRound = smoothstep(0.62, 1.0, jawT);
      z *= 1 - jawT * 0.16 - chinRound * 0.11;

      // Masseter / jaw corner fullness
      if (x > -0.025 && x < 0.045 && y < -0.015 && y > -0.075 && absZ > 0.036) {
        const jawCorner =
          (1 - Math.abs(y + 0.045) / 0.032) * smoothstep(0.036, 0.068, absZ);
        z += Math.sign(z) * Math.max(0, jawCorner) * 0.0085;
      }

      // Broad forward chin eminence + labiomental lip cleft under lips
      if (x > 0.02 && y < -0.045) {
        const chinBroad = 1 - clamp(absZ / 0.056, 0, 1);
        x += chinBroad * 0.011 * jawT;
        if (y > -0.064 && y < -0.038 && absZ < 0.028) {
          x -= 0.0045 * (1 - absZ / 0.028);
        }
      }

      // Subtle under-chin & occiput tuck
      if (x < -0.01) {
        x *= 1 - jawT * 0.15;
      }
    }

    // Cheekbones (zygomatic arch prominence)
    if (x > 0.024 && y > -0.03 && y < 0.016 && absZ > 0.022 && absZ < 0.07) {
      const cheekMask =
        (1 - Math.abs(y + 0.007) / 0.023) *
        (1 - Math.abs(absZ - 0.044) / 0.028);
      x += Math.max(0, cheekMask) * 0.0095;
    }

    // Defined brow ridge & deep recessed eye sockets
    if (x > 0.032) {
      if (y > 0.016 && y < 0.046 && absZ < 0.062) {
        const browMask = 1 - Math.abs(y - 0.03) / 0.016;
        x += Math.max(0, browMask) * 0.0105;
      }
      if (y > -0.006 && y < 0.02 && absZ > 0.013 && absZ < 0.052) {
        const eyeMask =
          (1 - Math.abs(y - 0.008) / 0.014) *
          (1 - Math.abs(absZ - 0.031) / 0.02);
        x -= Math.max(0, eyeMask) * 0.009;
      }
    }

    // Integrated sculpted nasal bridge, nostril flare & tip
    if (x > 0.042 && y > -0.034 && y < 0.026 && absZ < 0.018) {
      const noseY = 1 - Math.abs(y + 0.007) / 0.031;
      const noseZ = 1 - absZ / 0.018;
      const tipBoost = y < -0.004 && y > -0.024 ? 1.3 : 0.88;
      x += Math.max(0, noseY * noseZ) * 0.018 * tipBoost;
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

function createFaceTexture(profile: FighterProfile): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;
  const S = 768 / 512;

  ctx.fillStyle = profile.appearance.skinHex;
  ctx.fillRect(0, 0, 768, 768);

  ctx.save();
  ctx.scale(S, S);

  // Subtle natural skin tonal depth (no white center washout!)
  const faceShade = ctx.createRadialGradient(256, 245, 22, 256, 256, 175);
  faceShade.addColorStop(0, 'rgba(255, 212, 182, 0.11)');
  faceShade.addColorStop(0.5, 'rgba(175, 92, 62, 0.08)');
  faceShade.addColorStop(1, 'rgba(14, 6, 4, 0.38)');
  ctx.fillStyle = faceShade;
  ctx.fillRect(0, 0, 512, 512);

  // Cheekbone vascular warmth + temporal shading
  ctx.fillStyle = 'rgba(165, 58, 42, 0.12)';
  ctx.beginPath();
  ctx.ellipse(212, 272, 24, 15, 0, 0, Math.PI * 2);
  ctx.ellipse(300, 272, 24, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jawline & under-cheek contour shadow for strong sculpted bone structure
  ctx.fillStyle = 'rgba(18, 8, 5, 0.16)';
  ctx.beginPath();
  ctx.ellipse(202, 314, 18, 30, -0.35, 0, Math.PI * 2);
  ctx.ellipse(310, 314, 18, 30, 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Hairline / scalp fade
  if (profile.appearance.hairStyle !== 'shaved') {
    ctx.fillStyle = profile.appearance.hairHex;
    ctx.fillRect(0, 0, 512, 140);
    const fadeGrad = ctx.createLinearGradient(0, 126, 0, 186);
    fadeGrad.addColorStop(0, profile.appearance.hairHex);
    fadeGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(0, 126, 512, 60);
  }

  // Deep-set orbital shadows & tear troughs
  for (const ex of [224, 288]) {
    const orb = ctx.createRadialGradient(ex, 244, 3, ex, 244, 24);
    orb.addColorStop(0, 'rgba(18, 7, 5, 0.44)');
    orb.addColorStop(0.65, 'rgba(26, 10, 7, 0.2)');
    orb.addColorStop(1, 'rgba(20, 9, 6, 0)');
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(ex, 244, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  // Intense thick fighter eyebrows
  ctx.strokeStyle = profile.appearance.hairHex;
  ctx.lineWidth = 7.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(201, 227);
  ctx.quadraticCurveTo(223, 218, 244, 230);
  ctx.moveTo(268, 230);
  ctx.quadraticCurveTo(289, 218, 311, 227);
  ctx.stroke();

  // Photoreal Eyes (shaded natural sclera, dark limbal iris ring, pupil, upper lash shadow)
  for (const ex of [224, 288]) {
    ctx.fillStyle = '#d8d0c7';
    ctx.beginPath();
    ctx.ellipse(ex, 243, 10.5, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Iris
    ctx.fillStyle = '#332015';
    ctx.beginPath();
    ctx.arc(ex, 243, 4.4, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#0a0706';
    ctx.beginPath();
    ctx.arc(ex, 243, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Upper eyelid shadow across top of eye
    ctx.fillStyle = 'rgba(16, 7, 5, 0.34)';
    ctx.beginPath();
    ctx.ellipse(ex, 240, 10.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Specular catchlight
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.beginPath();
    ctx.arc(ex + 1.3, 241.8, 1.0, 0, Math.PI * 2);
    ctx.fill();

    // Crisp upper eyelid crease
    ctx.strokeStyle = 'rgba(20, 8, 6, 0.85)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(ex, 242.5, 11, 4.8, 0, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
  }

  // Nasal bridge side-contour shadow + highlight + nostrils
  ctx.fillStyle = 'rgba(22, 9, 6, 0.16)';
  ctx.fillRect(247, 236, 4, 44);
  ctx.fillRect(261, 236, 4, 44);
  ctx.fillStyle = 'rgba(255, 218, 190, 0.14)';
  ctx.fillRect(253, 236, 6, 44);
  ctx.fillStyle = 'rgba(22, 8, 5, 0.48)';
  ctx.beginPath();
  ctx.ellipse(247, 286, 4.4, 2.5, -0.25, 0, Math.PI * 2);
  ctx.ellipse(265, 286, 4.4, 2.5, 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Philtrum & Lips + lower-lip shadow
  ctx.fillStyle = 'rgba(24, 10, 8, 0.15)';
  ctx.fillRect(253, 291, 6, 15);
  ctx.fillStyle = 'rgba(120, 50, 44, 0.65)';
  ctx.beginPath();
  ctx.ellipse(256, 314, 19.5, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(28, 10, 8, 0.86)';
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

  // Facial hair with crisp hair-grain stippling
  const fh = profile.appearance.facialHair;
  if (fh === 'fullBeard') {
    ctx.fillStyle = profile.appearance.hairHex;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(188, 275);
    ctx.quadraticCurveTo(192, 392, 256, 404);
    ctx.quadraticCurveTo(320, 392, 324, 275);
    ctx.lineTo(308, 304);
    ctx.quadraticCurveTo(256, 336, 204, 304);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(256, 302, 25, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (fh === 'goatee') {
    ctx.fillStyle = profile.appearance.hairHex;
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.ellipse(256, 348, 22, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(256, 303, 21, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (fh === 'stubble') {
    ctx.fillStyle = 'rgba(18, 14, 14, 0.26)';
    ctx.beginPath();
    ctx.moveTo(194, 286);
    ctx.quadraticCurveTo(256, 398, 318, 286);
    ctx.lineTo(304, 344);
    ctx.quadraticCurveTo(256, 374, 208, 344);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(18, 14, 14, 0.42)';
    for (let i = 0; i < 320; i++) {
      const gx = 202 + ((i * 73) % 108);
      const gy = 294 + ((i * 41) % 76);
      ctx.fillRect(gx, gy, 1.3, 1.3);
    }
  }

  ctx.restore();
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

export function buildFighterRig(
  profile: FighterProfile,
  corner: 'red' | 'blue',
): JointMap {
  const root = new THREE.Group();
  const hScale = profile.heightScale;
  const bScale = profile.buildScale;
  root.scale.set(bScale, hScale, bScale);

  const skinTex = createSkinTexture(profile);
  const abdomenTex = createAbdomenTexture(profile);
  const legTex = createLegSkinTexture(profile);
  const faceTex = createFaceTexture(profile);
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
    bumpScale: 0.003,
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0.01,
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
    roughness: 0.88,
    metalness: 0.02,
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

  const waistband = new THREE.Mesh(
    new THREE.CylinderGeometry(0.148, 0.152, 0.055, 24),
    new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.68 }),
  );
  waistband.position.y = 0.088;
  waistband.scale.set(1.04, 1.0, 0.76);
  pelvis.add(waistband);

  const pelvisMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.151, 0.156, 0.18, 24),
    shortsMat,
  );
  pelvisMesh.position.y = -0.02;
  pelvisMesh.scale.set(1.05, 1.0, 0.76);
  pelvisMesh.castShadow = true;
  pelvis.add(pelvisMesh);

  // Abdomen (vertex-sculpted abs + dedicated abdomen texture)
  const abdomen = new THREE.Group();
  abdomen.position.set(0, 0.1, 0);
  pelvis.add(abdomen);

  const abdomenMesh = new THREE.Mesh(createSculptedAbdomenGeometry(), abdomenSkinMat);
  abdomenMesh.rotation.y = Math.PI;
  abdomenMesh.castShadow = true;
  abdomen.add(abdomenMesh);

  // Chest (vertex-sculpted pecs, sternum, lats, trapezius)
  const chest = new THREE.Group();
  chest.position.set(0, 0.19, 0);
  abdomen.add(chest);

  const chestMesh = new THREE.Mesh(createSculptedTorsoGeometry(), skinMat);
  chestMesh.rotation.y = Math.PI;
  chestMesh.castShadow = true;
  chest.add(chestMesh);

  // Neck & Sculpted Human Head (tapered trapezius base into neck into jaw)
  const neck = new THREE.Group();
  neck.position.set(0, 0.288, 0.008);
  chest.add(neck);

  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.084, 0.125, 24),
    limbSkinMat,
  );
  neckMesh.position.y = 0.036;
  neckMesh.castShadow = true;
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.set(0, 0.098, 0.01);
  neck.add(head);

  const skullMesh = new THREE.Mesh(createSculptedHeadGeometry(), faceMat);
  skullMesh.rotation.y = -Math.PI / 2;
  skullMesh.castShadow = true;
  head.add(skullMesh);

  // Sculpted Ears
  const earGeo = new THREE.SphereGeometry(0.021, 10, 10);
  const earL = new THREE.Mesh(earGeo, limbSkinMat);
  earL.position.set(-0.084, 0.082, -0.008);
  earL.scale.set(0.38, 1.15, 0.72);
  const earR = earL.clone();
  earR.position.x = 0.084;
  head.add(earL, earR);

  // Sculpted 3D Hair Crown
  if (profile.appearance.hairStyle !== 'shaved') {
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.107, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.48),
      hairMat,
    );
    hairCap.position.set(0, 0.098, -0.012);
    hairCap.scale.set(0.89, 1.11, 0.96);
    if (profile.appearance.hairStyle === 'textured') {
      hairCap.scale.set(0.94, 1.2, 1.04);
    }
    head.add(hairCap);
  }

  // Arms builder helper (tucked inward into pectoral-lat pocket, zero floating ball cap)
  const buildArm = (side: -1 | 1) => {
    const mat = side === 1 ? armRightMat : armLeftMat;
    const clavicle = new THREE.Group();
    clavicle.position.set(side * 0.174, 0.202, 0);
    chest.add(clavicle);

    const shoulderMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 20, 16),
      mat,
    );
    shoulderMesh.position.y = -0.01;
    shoulderMesh.scale.set(1.06, 1.16, 0.94);
    shoulderMesh.castShadow = true;
    clavicle.add(shoulderMesh);

    const upperArm = new THREE.Group();
    clavicle.add(upperArm);

    const bicepProfile = [
      new THREE.Vector2(0.041, -0.264),
      new THREE.Vector2(0.045, -0.238),
      new THREE.Vector2(0.056, -0.145),
      new THREE.Vector2(0.06, -0.04),
      new THREE.Vector2(0.052, 0.014),
    ];
    const bicepMesh = new THREE.Mesh(
      new THREE.LatheGeometry(bicepProfile, 20),
      mat,
    );
    bicepMesh.castShadow = true;
    upperArm.add(bicepMesh);

    const forearm = new THREE.Group();
    forearm.position.set(0, -0.26, 0);
    upperArm.add(forearm);

    const elbowCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.041, 14, 12),
      mat,
    );
    forearm.add(elbowCap);

    const forearmProfile = [
      new THREE.Vector2(0.03, -0.238),
      new THREE.Vector2(0.034, -0.212),
      new THREE.Vector2(0.046, -0.085),
      new THREE.Vector2(0.042, -0.015),
      new THREE.Vector2(0.036, 0.012),
    ];
    const forearmMesh = new THREE.Mesh(
      new THREE.LatheGeometry(forearmProfile, 20),
      mat,
    );
    forearmMesh.castShadow = true;
    forearm.add(forearmMesh);

    const glove = new THREE.Group();
    glove.position.set(0, -0.235, 0);
    forearm.add(glove);

    const tapeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.034, 0.056, 16),
      tapeMat,
    );
    tapeMesh.position.y = -0.018;
    glove.add(tapeMesh);

    const padMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 16, 14),
      gloveMat,
    );
    padMesh.position.set(0, -0.066, 0.012);
    padMesh.scale.set(0.95, 1.12, 0.85);
    padMesh.castShadow = true;
    glove.add(padMesh);

    const thumbMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.015, 0.03, 4, 8),
      gloveMat,
    );
    thumbMesh.position.set(-side * 0.04, -0.07, 0.024);
    thumbMesh.rotation.z = side * 0.4;
    glove.add(thumbMesh);

    return { clavicle, upperArm, forearm, glove };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Legs builder helper
  const buildLeg = (
    side: -1 | 1,
    hasKneeSleeve: boolean,
    hasAnkleWrap: boolean,
  ) => {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.102, -0.045, 0);
    pelvis.add(thigh);

    const hipCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.086, 16, 14),
      shortsMat,
    );
    thigh.add(hipCap);

    const cuffMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.084, 0.21, 20),
      shortsMat,
    );
    cuffMesh.position.y = -0.095;
    cuffMesh.castShadow = true;
    thigh.add(cuffMesh);

    const quadProfile = [
      new THREE.Vector2(0.001, -0.41),
      new THREE.Vector2(0.054, -0.39),
      new THREE.Vector2(0.074, -0.22),
      new THREE.Vector2(0.082, -0.06),
      new THREE.Vector2(0.001, 0.0),
    ];
    const quadMesh = new THREE.Mesh(
      new THREE.LatheGeometry(quadProfile, 20),
      limbSkinMat,
    );
    quadMesh.castShadow = true;
    thigh.add(quadMesh);

    const shin = new THREE.Group();
    shin.position.set(0, -0.405, 0);
    thigh.add(shin);

    const kneeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.054, 14, 12),
      hasKneeSleeve ? wrapMat : limbSkinMat,
    );
    shin.add(kneeCap);

    if (hasKneeSleeve) {
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062, 0.056, 0.145, 16),
        wrapMat,
      );
      sleeve.position.y = -0.02;
      shin.add(sleeve);
    }

    const calfProfile = [
      new THREE.Vector2(0.001, -0.41),
      new THREE.Vector2(0.037, -0.38),
      new THREE.Vector2(0.057, -0.17),
      new THREE.Vector2(0.054, -0.02),
      new THREE.Vector2(0.001, 0.0),
    ];
    const calfMesh = new THREE.Mesh(
      new THREE.LatheGeometry(calfProfile, 20),
      limbSkinMat,
    );
    calfMesh.castShadow = true;
    shin.add(calfMesh);

    if (hasAnkleWrap) {
      const ankle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.043, 0.041, 0.105, 16),
        wrapMat,
      );
      ankle.position.y = -0.355;
      shin.add(ankle);
    }

    const foot = new THREE.Group();
    foot.position.set(0, -0.405, 0);
    shin.add(foot);

    const footMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.035, 0.125, 6, 12),
      hasAnkleWrap ? wrapMat : limbSkinMat,
    );
    footMesh.rotation.x = Math.PI / 2;
    footMesh.position.set(0, -0.02, 0.058);
    footMesh.scale.set(1.12, 1.0, 0.72);
    footMesh.castShadow = true;
    foot.add(footMesh);

    return { thigh, shin, foot };
  };

  const leftLeg = buildLeg(
    -1,
    profile.appearance.hasLeftKneeSleeve,
    profile.appearance.hasLeftAnkleWrap,
  );
  const rightLeg = buildLeg(1, false, profile.appearance.hasRightAnkleWrap);

  return {
    root,
    pelvis,
    abdomen,
    chest,
    neck,
    head,
    clavicleL: leftArm.clavicle,
    upperArmL: leftArm.upperArm,
    forearmL: leftArm.forearm,
    gloveL: leftArm.glove,
    clavicleR: rightArm.clavicle,
    upperArmR: rightArm.upperArm,
    forearmR: rightArm.forearm,
    gloveR: rightArm.glove,
    thighL: leftLeg.thigh,
    shinL: leftLeg.shin,
    footL: leftLeg.foot,
    thighR: rightLeg.thigh,
    shinR: rightLeg.shin,
    footR: rightLeg.foot,
    skinMaterial: skinMat,
    abdomenSkinMaterial: abdomenSkinMat,
    faceMaterial: faceMat,
    shadowDisc,
  };
}

function getStanceGuardPose(
  stance: Stance,
  gaitPhase: number,
  speed: number,
  timeSec: number,
): PoseAngles {
  const s = stance === 'orthodox' ? 1 : -1;
  const moveBlend = Math.min(1, speed / 2.2);
  const bounce = Math.sin(timeSec * 6.2) * 0.017;
  const breath = Math.sin(timeSec * 2.4) * 0.016;
  const weightShift = Math.sin(timeSec * 3.1) * 0.04;
  const stride = Math.sin(gaitPhase) * moveBlend;
  const kneeLift = Math.max(0, Math.cos(gaitPhase)) * moveBlend;

  const pose = createZeroPose();
  pose.pelvisY = 0.902 + bounce - moveBlend * 0.022;
  pose.pelvisZ = weightShift * 0.35;
  pose.pelvisRotY = -0.4 * s + stride * 0.1;
  pose.abdomenRotX = 0.11 + Math.abs(weightShift) * 0.18 + breath;
  pose.abdomenRotZ = weightShift * 0.38;
  pose.chestRotX = 0.095 - breath * 0.6;
  pose.chestRotY = -0.17 * s - stride * 0.05;
  pose.chestRotZ = weightShift * 0.32;
  pose.headRotX = -0.15;
  pose.headRotY = 0.48 * s;
  pose.headRotZ = -weightShift * 0.5;

  const swayArm = Math.sin(timeSec * 6.2 + 0.65) * 0.04;
  const roll = Math.cos(timeSec * 3.1) * 0.025;

  if (stance === 'orthodox') {
    pose.clavicleL = [0.04, 0.06, -0.05];
    pose.clavicleR = [0.02, -0.04, 0.04];
    pose.armL = [-0.94 + swayArm, -0.15 + roll, -0.23];
    pose.forearmL = [-1.5 - swayArm * 0.55, 0.14, 0.25];
    pose.armR = [-0.82 - swayArm, 0.16 - roll, 0.25];
    pose.forearmR = [-1.76 + swayArm * 0.55, -0.14, -0.22];

    pose.thighL = [-0.32 + stride * 0.28 - kneeLift * 0.14, 0.1, -0.08];
    pose.shinL = [0.38 - stride * 0.08 + kneeLift * 0.2, 0, 0];
    pose.footL = [-0.08 + kneeLift * 0.06, 0.08, 0];

    pose.thighR = [0.24 - stride * 0.28, -0.12, 0.09];
    pose.shinR = [0.3 + stride * 0.14, 0, 0];
    pose.footR = [-0.21 - bounce * 1.4, -0.12, 0];
  } else {
    pose.clavicleR = [0.04, -0.06, 0.05];
    pose.clavicleL = [0.02, 0.04, -0.04];
    pose.armR = [-0.94 + swayArm, 0.15 - roll, 0.23];
    pose.forearmR = [-1.5 - swayArm * 0.55, -0.14, -0.25];
    pose.armL = [-0.82 - swayArm, -0.16 + roll, -0.25];
    pose.forearmL = [-1.76 + swayArm * 0.55, 0.14, 0.22];

    pose.thighR = [-0.32 + stride * 0.28 - kneeLift * 0.14, -0.1, 0.08];
    pose.shinR = [0.38 - stride * 0.08 + kneeLift * 0.2, 0, 0];
    pose.footR = [-0.08 + kneeLift * 0.06, -0.08, 0];

    pose.thighL = [0.24 - stride * 0.28, 0.12, -0.09];
    pose.shinL = [0.3 + stride * 0.14, 0, 0];
    pose.footL = [-0.21 - bounce * 1.4, 0.12, 0];
  }

  return pose;
}

function getStrikePose(
  strikeId: StrikeId,
  stance: Stance,
  progress: number,
  base: PoseAngles,
): PoseAngles {
  const spec = STRIKES[strikeId];
  const total = spec.windup + spec.active + spec.recovery;
  const wEnd = spec.windup / total;
  const aEnd = (spec.windup + spec.active) / total;

  // Multi-phase kinetic chain curve:
  // hipWave drives slightly before torso & arm snap, creating authentic MMA whip!
  let armPower = 0;
  let hipPower = 0;
  let chamber = 0;
  if (progress < wEnd) {
    const u = progress / Math.max(0.001, wEnd);
    chamber = Math.sin(u * Math.PI);
    hipPower = easeInOutCubic(u) * 0.52;
    armPower = easeInOutCubic(u) * 0.28;
  } else if (progress <= aEnd) {
    const u = (progress - wEnd) / Math.max(0.001, aEnd - wEnd);
    hipPower = 0.52 + easeOutQuint(Math.min(1, u * 1.2)) * 0.48;
    armPower = 0.28 + easeOutQuint(u) * 0.72;
  } else {
    const u = (progress - aEnd) / Math.max(0.001, 1 - aEnd);
    hipPower = 1 - easeInOutCubic(u * 0.92);
    armPower = 1 - easeInOutCubic(u);
  }
  const power = armPower;

  const s = stance === 'orthodox' ? 1 : -1;
  const p: PoseAngles = {
    ...base,
    clavicleL: [...base.clavicleL],
    armL: [...base.armL],
    forearmL: [...base.forearmL],
    clavicleR: [...base.clavicleR],
    armR: [...base.armR],
    forearmR: [...base.forearmR],
    thighL: [...base.thighL],
    shinL: [...base.shinL],
    footL: [...base.footL],
    thighR: [...base.thighR],
    shinR: [...base.shinR],
    footR: [...base.footR],
  };

  const useLeft =
    (stance === 'orthodox' && spec.isLeadSide) ||
    (stance === 'southpaw' && !spec.isLeadSide);

  if (!spec.isKick) {
    if (strikeId === 'jab' || strikeId === 'cross') {
      const isCross = strikeId === 'cross';
      const twistDir = useLeft ? 1 : -1;
      const coil = -twistDir * 0.2 * chamber * (isCross ? 1.45 : 0.7);
      p.pelvisRotY =
        lerp(base.pelvisRotY, twistDir * (isCross ? 0.72 : 0.34), hipPower) +
        coil * 0.58;
      p.abdomenRotY = lerp(
        base.abdomenRotY,
        twistDir * (isCross ? 0.42 : 0.22),
        (hipPower + armPower) * 0.5,
      );
      p.chestRotY =
        lerp(base.chestRotY, twistDir * (isCross ? 0.78 : 0.46), power) + coil;
      p.abdomenRotX = lerp(base.abdomenRotX, isCross ? 0.3 : 0.18, power);
      p.chestRotX = lerp(base.chestRotX, isCross ? 0.19 : 0.12, power);
      p.headRotY = lerp(
        base.headRotY,
        -twistDir * (isCross ? 0.68 : 0.4),
        power,
      );
      p.headRotX = lerp(base.headRotX, -0.27, power); // Chin tucked inside shoulder pocket
      p.headRotZ = lerp(base.headRotZ, twistDir * 0.08, power);
      p.pelvisY = base.pelvisY - hipPower * (isCross ? 0.07 : 0.032);
      p.pelvisZ = hipPower * (isCross ? 0.11 : 0.06);

      // Shoulder protraction on striking arm + chin-guard retraction on off arm
      const leadClavSnap: [number, number, number] = [
        0.12,
        twistDir * 0.38,
        twistDir * -0.15,
      ];
      const rearClavPull: [number, number, number] = [
        -0.06,
        -twistDir * 0.2,
        twistDir * 0.09,
      ];
      if (useLeft) {
        p.clavicleL = [
          lerp(base.clavicleL[0], leadClavSnap[0], power),
          lerp(base.clavicleL[1], leadClavSnap[1], power),
          lerp(base.clavicleL[2], leadClavSnap[2], power),
        ];
        p.clavicleR = [
          lerp(base.clavicleR[0], rearClavPull[0], power),
          lerp(base.clavicleR[1], rearClavPull[1], power),
          lerp(base.clavicleR[2], rearClavPull[2], power),
        ];
      } else {
        p.clavicleR = [
          lerp(base.clavicleR[0], leadClavSnap[0], power),
          lerp(base.clavicleR[1], leadClavSnap[1], power),
          lerp(base.clavicleR[2], leadClavSnap[2], power),
        ];
        p.clavicleL = [
          lerp(base.clavicleL[0], rearClavPull[0], power),
          lerp(base.clavicleL[1], rearClavPull[1], power),
          lerp(base.clavicleL[2], rearClavPull[2], power),
        ];
      }

      // Lower-body weight transfer + ball-of-foot pivot drive
      if (isCross) {
        if (stance === 'orthodox') {
          p.thighL[0] = lerp(base.thighL[0], -0.46, hipPower);
          p.shinL[0] = lerp(base.shinL[0], 0.56, hipPower);
          p.thighR[0] = lerp(base.thighR[0], 0.4, hipPower);
          p.thighR[1] = lerp(base.thighR[1], -0.34, hipPower);
          p.footR[0] = lerp(base.footR[0], -0.54, hipPower);
          p.footR[1] = lerp(base.footR[1], 0.36, hipPower);
        } else {
          p.thighR[0] = lerp(base.thighR[0], -0.46, hipPower);
          p.shinR[0] = lerp(base.shinR[0], 0.56, hipPower);
          p.thighL[0] = lerp(base.thighL[0], 0.4, hipPower);
          p.thighL[1] = lerp(base.thighL[1], 0.34, hipPower);
          p.footL[0] = lerp(base.footL[0], -0.54, hipPower);
          p.footL[1] = lerp(base.footL[1], -0.36, hipPower);
        }
      } else {
        // Quick jab step-in on lead knee
        if (stance === 'orthodox') {
          p.thighL[0] = lerp(base.thighL[0], -0.4, hipPower);
          p.shinL[0] = lerp(base.shinL[0], 0.48, hipPower);
        } else {
          p.thighR[0] = lerp(base.thighR[0], -0.4, hipPower);
          p.shinR[0] = lerp(base.shinR[0], 0.48, hipPower);
        }
      }

      const extArm: [number, number, number] = [-1.58, twistDir * -0.07, 0];
      const extForearm: [number, number, number] = [-0.06, 0, 0];
      const guardArm: [number, number, number] = [
        -1.15,
        twistDir * 0.26,
        twistDir * -0.22,
      ];
      const guardForearm: [number, number, number] = [-2.12, 0, 0];

      if (useLeft) {
        for (let k = 0; k < 3; k++) {
          p.armL[k] = lerp(base.armL[k], extArm[k], power);
          p.armR[k] = lerp(base.armR[k], guardArm[k], power);
        }
        p.forearmL[0] = lerp(base.forearmL[0], extForearm[0], power);
        p.forearmR[0] = lerp(base.forearmR[0], guardForearm[0], power);
      } else {
        for (let k = 0; k < 3; k++) {
          p.armR[k] = lerp(base.armR[k], extArm[k], power);
          p.armL[k] = lerp(base.armL[k], guardArm[k], power);
        }
        p.forearmR[0] = lerp(base.forearmR[0], extForearm[0], power);
        p.forearmL[0] = lerp(base.forearmL[0], guardForearm[0], power);
      }
    } else if (
      strikeId === 'leadHook' ||
      strikeId === 'rearHook' ||
      strikeId === 'overhand' ||
      strikeId === 'bodyHook' ||
      strikeId === 'rearBodyHook'
    ) {
      const isBody = strikeId === 'bodyHook' || strikeId === 'rearBodyHook';
      const isOverhand = strikeId === 'overhand';
      const twistDir = useLeft ? 1 : -1;
      const cockTwist = -twistDir * (isOverhand ? 0.6 : 0.48) * chamber;
      p.pelvisRotY =
        lerp(base.pelvisRotY, twistDir * (isOverhand ? 0.86 : 0.78), hipPower) +
        cockTwist * 0.44;
      p.abdomenRotY = lerp(base.abdomenRotY, twistDir * 0.48, (hipPower + power) * 0.5);
      p.chestRotY =
        lerp(base.chestRotY, twistDir * (isOverhand ? 0.98 : 0.92), power) +
        cockTwist;
      p.pelvisY =
        base.pelvisY - (isBody ? 0.17 : isOverhand ? 0.12 : 0.055) * hipPower;
      p.pelvisZ = hipPower * (isOverhand ? 0.13 : 0.075);
      p.abdomenRotX = lerp(
        base.abdomenRotX,
        isBody ? 0.42 : isOverhand ? 0.38 : 0.2,
        power,
      );
      p.abdomenRotZ = lerp(0, -twistDir * (isOverhand ? 0.34 : 0.22), power);
      p.headRotY = lerp(base.headRotY, -twistDir * 0.72, power);
      p.headRotX = lerp(base.headRotX, -0.22, power);
      p.headRotZ = lerp(0, -twistDir * (isOverhand ? 0.24 : 0.08), power);

      // Pivot plant foot cleanly during hooks & overhands
      if (useLeft) {
        p.thighL[1] = lerp(base.thighL[1], 0.32, hipPower);
        p.footL[1] = lerp(base.footL[1], -0.32, hipPower);
        p.thighL[0] = lerp(base.thighL[0], -0.44, hipPower);
        p.shinL[0] = lerp(base.shinL[0], 0.52, hipPower);
      } else {
        p.thighR[1] = lerp(base.thighR[1], -0.34, hipPower);
        p.footR[0] = lerp(base.footR[0], -0.48, hipPower);
        p.footR[1] = lerp(base.footR[1], 0.36, hipPower);
      }

      const hookClav: [number, number, number] = [
        0.1,
        twistDir * 0.34,
        twistDir * (isOverhand ? 0.2 : -0.12),
      ];
      if (useLeft)
        p.clavicleL = hookClav.map((v, k) =>
          lerp(base.clavicleL[k], v, power),
        ) as [number, number, number];
      else
        p.clavicleR = hookClav.map((v, k) =>
          lerp(base.clavicleR[k], v, power),
        ) as [number, number, number];

      const hookArm: [number, number, number] = [
        isBody ? -0.94 : isOverhand ? -1.82 : -1.48,
        twistDir * (isOverhand ? 0.56 : 0.82),
        twistDir * (isOverhand ? -0.72 : -1.02),
      ];
      const hookForearm: [number, number, number] = [
        isOverhand ? -0.88 : -1.5,
        twistDir * 0.42,
        0,
      ];
      const tightGuardArm: [number, number, number] = [
        -1.22,
        twistDir * 0.24,
        twistDir * -0.16,
      ];

      if (useLeft) {
        for (let k = 0; k < 3; k++) {
          p.armL[k] = lerp(base.armL[k], hookArm[k], power);
          p.armR[k] = lerp(base.armR[k], tightGuardArm[k], power);
        }
        p.forearmL[0] = lerp(base.forearmL[0], hookForearm[0], power);
        p.forearmL[1] = lerp(base.forearmL[1], hookForearm[1], power);
        p.forearmR[0] = lerp(base.forearmR[0], -2.1, power);
      } else {
        for (let k = 0; k < 3; k++) {
          p.armR[k] = lerp(base.armR[k], hookArm[k], power);
          p.armL[k] = lerp(base.armL[k], tightGuardArm[k], power);
        }
        p.forearmR[0] = lerp(base.forearmR[0], hookForearm[0], power);
        p.forearmR[1] = lerp(base.forearmR[1], hookForearm[1], power);
        p.forearmL[0] = lerp(base.forearmL[0], -2.1, power);
      }
    } else if (strikeId === 'leadUppercut' || strikeId === 'rearUppercut') {
      const twistDir = useLeft ? 1 : -1;
      const legDrive = clamp((armPower - 0.25) / 0.75, 0, 1);
      p.pelvisY = base.pelvisY - 0.16 * chamber + 0.065 * legDrive;
      p.pelvisRotY = lerp(base.pelvisRotY, twistDir * 0.62, hipPower);
      p.abdomenRotY = lerp(base.abdomenRotY, twistDir * 0.35, power);
      p.chestRotY = lerp(base.chestRotY, twistDir * 0.68, power);
      p.chestRotX = lerp(base.chestRotX, -0.25, power);
      p.headRotY = lerp(base.headRotY, -twistDir * 0.52, power);

      // Dip knees in chamber then explode upward
      p.thighL[0] = lerp(base.thighL[0], -0.58 * chamber + base.thighL[0] * 0.6, chamber);
      p.shinL[0] = lerp(base.shinL[0], 0.72 * chamber + base.shinL[0] * 0.6, chamber);
      p.thighR[0] = lerp(base.thighR[0], -0.4 * chamber + base.thighR[0], chamber);
      p.shinR[0] = lerp(base.shinR[0], 0.62 * chamber + base.shinR[0], chamber);

      const upClav: [number, number, number] = [
        -0.14,
        twistDir * 0.28,
        twistDir * -0.16,
      ];
      if (useLeft)
        p.clavicleL = upClav.map((v, k) =>
          lerp(base.clavicleL[k], v, power),
        ) as [number, number, number];
      else
        p.clavicleR = upClav.map((v, k) =>
          lerp(base.clavicleR[k], v, power),
        ) as [number, number, number];

      const upArm: [number, number, number] = [-1.45 + chamber * 0.72, 0, 0];
      const upFore: [number, number, number] = [-1.75, 0, 0];
      if (useLeft) {
        p.armL = [lerp(base.armL[0], upArm[0], power), base.armL[1], 0];
        p.forearmL = [lerp(base.forearmL[0], upFore[0], power), 0, 0];
        p.armR = [lerp(base.armR[0], -1.2, power), 0.24, 0.14];
        p.forearmR = [lerp(base.forearmR[0], -2.1, power), 0, 0];
      } else {
        p.armR = [lerp(base.armR[0], upArm[0], power), base.armR[1], 0];
        p.forearmR = [lerp(base.forearmR[0], upFore[0], power), 0, 0];
        p.armL = [lerp(base.armL[0], -1.2, power), -0.24, -0.14];
        p.forearmL = [lerp(base.forearmL[0], -2.1, power), 0, 0];
      }
    } else if (strikeId === 'spinningBackfist') {
      const hipSpin =
        easeInOutCubic(smoothstep(0.02, 0.84, progress)) * Math.PI * 2 * s;
      const chestSpin =
        easeInOutCubic(smoothstep(0.08, 0.9, progress)) * Math.PI * 2 * s;
      p.pelvisY = base.pelvisY - 0.06 * Math.sin(progress * Math.PI);
      p.pelvisRotY = base.pelvisRotY + hipSpin;
      p.chestRotY = base.chestRotY + (chestSpin - hipSpin) * 0.55;
      p.clavicleR = [0, -0.3 * power, 0];
      p.armR = [-1.5, -0.38 * s, 0.96 * s * power];
      p.forearmR = [-0.22 - chamber * 0.85, 0, 0];
      p.armL = [-1.18, -0.25, -0.15];
      p.forearmL = [-2.05, 0, 0];
    }
  } else {
    // Authentic Muay Thai / UFC Roundhouse Kick:
    // Plant foot opens outward -> Knee lifts tight -> Hip turns over -> Shin whips -> Re-chamber return
    const isHigh = strikeId === 'headKick' || strikeId === 'leadHeadKick';
    const isBody = strikeId === 'bodyKick' || strikeId === 'rearBodyKick';
    const kickHeight = isHigh ? -1.86 : isBody ? -1.4 : -0.88;
    const kickLeft = useLeft;
    const dir = kickLeft ? -1 : 1;
    const liftEnv = Math.sin(smoothstep(0.02, 0.96, progress) * Math.PI);
    const kneeChamber = easeOutQuint(
      Math.min(1, progress / Math.max(0.01, wEnd * 1.05)),
    );
    const whipExtend =
      smoothstep(wEnd * 0.52, aEnd * 0.96, progress) *
      (1 - smoothstep(aEnd, 0.95, progress));
    const reChamber = smoothstep(aEnd * 0.92, 0.96, progress) * (1 - progress);

    p.pelvisY = base.pelvisY - 0.025 * liftEnv;
    p.pelvisRotY = lerp(base.pelvisRotY, -dir * 1.06, hipPower);
    p.abdomenRotY = lerp(base.abdomenRotY, -dir * 0.28, power);
    p.pelvisRotZ = lerp(0, dir * (isHigh ? 0.44 : 0.34), hipPower);
    p.chestRotZ = lerp(0, dir * (isHigh ? 0.36 : 0.28), power);
    p.chestRotX = lerp(base.chestRotX, -0.24, power);
    p.headRotZ = lerp(0, -dir * 0.32, power);
    p.headRotY = lerp(base.headRotY, dir * 0.84, power);

    const shinFold = 1.08 * chamber + 0.55 * reChamber;

    if (kickLeft) {
      // Standing right leg external pivot on ball of foot
      p.thighR[1] = lerp(base.thighR[1], 0.42, hipPower);
      p.footR[0] = lerp(base.footR[0], -0.24, hipPower);
      p.footR[1] = lerp(base.footR[1], -0.45, hipPower);
      p.shinR[0] = lerp(base.shinR[0], 0.18, hipPower);

      p.thighL = [
        lerp(
          base.thighL[0],
          kickHeight,
          kneeChamber * (1 - smoothstep(aEnd, 1, progress)),
        ),
        lerp(base.thighL[1], 0.42, hipPower),
        lerp(base.thighL[2], -0.52, hipPower),
      ];
      p.shinL = [lerp(shinFold, 0.05, whipExtend), 0, 0];
      p.footL = [lerp(0, 0.42, power), 0, 0];
      // Left arm whips down-back for torque while right hand stays high at temple
      p.armL = [
        lerp(base.armL[0], 0.68, power),
        0,
        lerp(base.armL[2], -0.85, power),
      ];
      p.forearmL = [lerp(base.forearmL[0], -0.22, power), 0, 0];
      p.armR = [lerp(base.armR[0], -1.24, power), 0.28, 0.16];
      p.forearmR = [-2.12, 0, 0];
    } else {
      // Standing left leg external pivot on ball of foot
      p.thighL[1] = lerp(base.thighL[1], -0.42, hipPower);
      p.footL[0] = lerp(base.footL[0], -0.24, hipPower);
      p.footL[1] = lerp(base.footL[1], 0.45, hipPower);
      p.shinL[0] = lerp(base.shinL[0], 0.18, hipPower);

      p.thighR = [
        lerp(
          base.thighR[0],
          kickHeight,
          kneeChamber * (1 - smoothstep(aEnd, 1, progress)),
        ),
        lerp(base.thighR[1], -0.42, hipPower),
        lerp(base.thighR[2], 0.52, hipPower),
      ];
      p.shinR = [lerp(shinFold, 0.05, whipExtend), 0, 0];
      p.footR = [lerp(0, 0.42, power), 0, 0];
      // Right arm whips down-back while left hand stays high at temple
      p.armR = [
        lerp(base.armR[0], 0.68, power),
        0,
        lerp(base.armR[2], 0.85, power),
      ];
      p.forearmR = [lerp(base.forearmR[0], -0.22, power), 0, 0];
      p.armL = [lerp(base.armL[0], -1.24, power), -0.28, -0.16];
      p.forearmL = [-2.12, 0, 0];
    }
  }

  return p;
}

function interpolatePose(
  rig: JointMap,
  target: PoseAngles,
  alphaBody: number,
  alphaLimbs: number,
) {
  rig.pelvis.position.y = lerp(rig.pelvis.position.y, target.pelvisY, alphaBody);
  rig.pelvis.position.z = lerp(rig.pelvis.position.z, target.pelvisZ, alphaBody);
  rig.pelvis.rotation.x = lerp(rig.pelvis.rotation.x, target.pelvisRotX, alphaBody);
  rig.pelvis.rotation.y = lerp(rig.pelvis.rotation.y, target.pelvisRotY, alphaBody);
  rig.pelvis.rotation.z = lerp(rig.pelvis.rotation.z, target.pelvisRotZ, alphaBody);

  rig.abdomen.rotation.x = lerp(rig.abdomen.rotation.x, target.abdomenRotX, alphaBody);
  rig.abdomen.rotation.y = lerp(rig.abdomen.rotation.y, target.abdomenRotY, alphaBody);
  rig.abdomen.rotation.z = lerp(rig.abdomen.rotation.z, target.abdomenRotZ, alphaBody);

  rig.chest.rotation.x = lerp(rig.chest.rotation.x, target.chestRotX, alphaBody);
  rig.chest.rotation.y = lerp(rig.chest.rotation.y, target.chestRotY, alphaBody);
  rig.chest.rotation.z = lerp(rig.chest.rotation.z, target.chestRotZ, alphaBody);

  rig.head.rotation.x = lerp(rig.head.rotation.x, target.headRotX, alphaBody);
  rig.head.rotation.y = lerp(rig.head.rotation.y, target.headRotY, alphaBody);
  rig.head.rotation.z = lerp(rig.head.rotation.z, target.headRotZ, alphaBody);

  rig.clavicleL.rotation.x = lerp(rig.clavicleL.rotation.x, target.clavicleL[0], alphaLimbs);
  rig.clavicleL.rotation.y = lerp(rig.clavicleL.rotation.y, target.clavicleL[1], alphaLimbs);
  rig.clavicleL.rotation.z = lerp(rig.clavicleL.rotation.z, target.clavicleL[2], alphaLimbs);

  rig.upperArmL.rotation.x = lerp(rig.upperArmL.rotation.x, target.armL[0], alphaLimbs);
  rig.upperArmL.rotation.y = lerp(rig.upperArmL.rotation.y, target.armL[1], alphaLimbs);
  rig.upperArmL.rotation.z = lerp(rig.upperArmL.rotation.z, target.armL[2], alphaLimbs);

  rig.forearmL.rotation.x = lerp(rig.forearmL.rotation.x, target.forearmL[0], alphaLimbs);
  rig.forearmL.rotation.y = lerp(rig.forearmL.rotation.y, target.forearmL[1], alphaLimbs);
  rig.forearmL.rotation.z = lerp(rig.forearmL.rotation.z, target.forearmL[2], alphaLimbs);

  rig.clavicleR.rotation.x = lerp(rig.clavicleR.rotation.x, target.clavicleR[0], alphaLimbs);
  rig.clavicleR.rotation.y = lerp(rig.clavicleR.rotation.y, target.clavicleR[1], alphaLimbs);
  rig.clavicleR.rotation.z = lerp(rig.clavicleR.rotation.z, target.clavicleR[2], alphaLimbs);

  rig.upperArmR.rotation.x = lerp(rig.upperArmR.rotation.x, target.armR[0], alphaLimbs);
  rig.upperArmR.rotation.y = lerp(rig.upperArmR.rotation.y, target.armR[1], alphaLimbs);
  rig.upperArmR.rotation.z = lerp(rig.upperArmR.rotation.z, target.armR[2], alphaLimbs);

  rig.forearmR.rotation.x = lerp(rig.forearmR.rotation.x, target.forearmR[0], alphaLimbs);
  rig.forearmR.rotation.y = lerp(rig.forearmR.rotation.y, target.forearmR[1], alphaLimbs);
  rig.forearmR.rotation.z = lerp(rig.forearmR.rotation.z, target.forearmR[2], alphaLimbs);

  rig.thighL.rotation.x = lerp(rig.thighL.rotation.x, target.thighL[0], alphaLimbs);
  rig.thighL.rotation.y = lerp(rig.thighL.rotation.y, target.thighL[1], alphaLimbs);
  rig.thighL.rotation.z = lerp(rig.thighL.rotation.z, target.thighL[2], alphaLimbs);
  rig.shinL.rotation.x = lerp(rig.shinL.rotation.x, target.shinL[0], alphaLimbs);
  rig.footL.rotation.x = lerp(rig.footL.rotation.x, target.footL[0], alphaLimbs);
  rig.footL.rotation.y = lerp(rig.footL.rotation.y, target.footL[1], alphaLimbs);
  rig.footL.rotation.z = lerp(rig.footL.rotation.z, target.footL[2], alphaLimbs);

  rig.thighR.rotation.x = lerp(rig.thighR.rotation.x, target.thighR[0], alphaLimbs);
  rig.thighR.rotation.y = lerp(rig.thighR.rotation.y, target.thighR[1], alphaLimbs);
  rig.thighR.rotation.z = lerp(rig.thighR.rotation.z, target.thighR[2], alphaLimbs);
  rig.shinR.rotation.x = lerp(rig.shinR.rotation.x, target.shinR[0], alphaLimbs);
  rig.footR.rotation.x = lerp(rig.footR.rotation.x, target.footR[0], alphaLimbs);
  rig.footR.rotation.y = lerp(rig.footR.rotation.y, target.footR[1], alphaLimbs);
  rig.footR.rotation.z = lerp(rig.footR.rotation.z, target.footR[2], alphaLimbs);
}

export function applyMainMenuHeroPose(
  rig: JointMap,
  timeSec: number,
  dt: number,
) {
  // Cinematic close-up bust pose matching image_c94e6796.png
  rig.root.position.set(0.36, 0, 0.22);
  rig.root.rotation.y = -0.34;

  const breath = Math.sin(timeSec * 1.65) * 0.011;
  const pose = createZeroPose();
  pose.pelvisY = 0.94 + breath * 0.2;
  pose.chestRotX = -0.04 + breath;
  pose.chestRotY = 0.06;
  pose.headRotX = -0.14; // proud slight chin-up gaze
  pose.headRotY = 0.22 + Math.sin(timeSec * 0.65) * 0.035;
  pose.headRotZ = -0.025;

  pose.armL = [-0.1, 0.06, -0.13];
  pose.forearmL = [-0.28, 0.1, 0.06];
  pose.armR = [-0.1, -0.06, 0.13];
  pose.forearmR = [-0.28, -0.1, -0.06];

  const alpha = 1 - Math.exp(-8 * Math.min(dt, 0.05));
  interpolatePose(rig, pose, alpha, alpha);
  rig.skinMaterial.emissiveIntensity = 0;
  rig.abdomenSkinMaterial.emissiveIntensity = 0;
  rig.faceMaterial.emissiveIntensity = 0;
}

export function applySelectShowcasePose(
  rig: JointMap,
  corner: 'red' | 'blue',
  timeSec: number,
  dt: number,
) {
  const isRed = corner === 'red';
  rig.root.position.set(isRed ? -1.02 : 1.02, 0, 0.35);
  rig.root.rotation.y = isRed ? 0.18 : -0.18;

  const breath = Math.sin(timeSec * 2.2 + (isRed ? 0 : 1.1)) * 0.015;
  const pose = createZeroPose();
  pose.pelvisY = 0.94 + breath * 0.3;
  pose.chestRotX = -0.04 + breath;
  pose.headRotX = -0.04;
  pose.headRotY = isRed ? -0.1 : 0.1;

  pose.armL = [-0.22, 0.12, -0.2];
  pose.forearmL = [-0.6, 0.16, 0.1];
  pose.armR = [-0.22, -0.12, 0.2];
  pose.forearmR = [-0.6, -0.16, -0.1];
  pose.thighL = [-0.04, 0.08, -0.09];
  pose.thighR = [-0.04, -0.08, 0.09];
  pose.shinL = [0.06, 0, 0];
  pose.shinR = [0.06, 0, 0];

  const alpha = 1 - Math.exp(-10 * Math.min(dt, 0.05));
  interpolatePose(rig, pose, alpha, alpha);
  rig.skinMaterial.emissiveIntensity = 0;
  rig.abdomenSkinMaterial.emissiveIntensity = 0;
  rig.faceMaterial.emissiveIntensity = 0;
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
  const base = getStanceGuardPose(state.stance, state.gaitPhase, speed, timeSec);
  let target: PoseAngles = base;

  if (isKoWinner && state.action !== 'ko') {
    // Walk-off / Raised-Arms Victory Celebration after scoring a knockout
    const celeb = Math.sin(timeSec * 4.2) * 0.04;
    target = { ...base };
    target.pelvisY = 0.955 + Math.abs(celeb) * 0.25;
    target.chestRotX = -0.14;
    target.chestRotY = 0.14;
    target.headRotX = -0.22;
    target.headRotY = Math.sin(timeSec * 1.4) * 0.12;
    target.clavicleL = [-0.24, 0, -0.25];
    target.clavicleR = [-0.24, 0, 0.25];
    target.armL = [-2.55 + celeb, 0.22, -0.46];
    target.forearmL = [-0.42, 0.1, 0.14];
    target.armR = [-2.68 - celeb, -0.2, 0.42];
    target.forearmR = [-0.36, -0.1, -0.14];
    target.thighL = [-0.08, 0.12, -0.12];
    target.thighR = [0.06, -0.1, 0.12];
    target.shinL = [0.12, 0, 0];
    target.shinR = [0.08, 0, 0];
  } else if (state.action === 'strike' && state.currentStrike) {
    const progress = Math.min(
      1,
      state.actionTime / Math.max(0.01, state.actionDuration),
    );
    target = getStrikePose(state.currentStrike, state.stance, progress, base);
  } else if (state.action === 'slipLeft' || state.action === 'slipRight') {
    const p = Math.sin(
      Math.min(1, state.actionTime / Math.max(0.01, state.actionDuration)) *
        Math.PI,
    );
    const dir = state.action === 'slipLeft' ? -1 : 1;
    target = { ...base };
    target.pelvisY = base.pelvisY - 0.09 * p;
    target.abdomenRotZ = dir * 0.4 * p;
    target.chestRotZ = dir * 0.28 * p;
    target.abdomenRotX = 0.24 * p;
    target.headRotZ = -dir * 0.24 * p;
  } else if (state.action === 'pullBack') {
    const p = Math.sin(
      Math.min(1, state.actionTime / Math.max(0.01, state.actionDuration)) *
        Math.PI,
    );
    target = { ...base };
    target.abdomenRotX = -0.36 * p;
    target.chestRotX = -0.3 * p;
    target.headRotX = 0.24 * p;
  } else if (state.action === 'duck') {
    const p = Math.sin(
      Math.min(1, state.actionTime / Math.max(0.01, state.actionDuration)) *
        Math.PI,
    );
    target = { ...base };
    target.pelvisY = base.pelvisY - 0.19 * p;
    target.abdomenRotX = 0.56 * p;
    target.chestRotX = 0.42 * p;
    target.headRotX = -0.25 * p;
    target.thighL = [-0.62 * p + base.thighL[0], base.thighL[1], base.thighL[2]];
    target.shinL = [0.76 * p + base.shinL[0], 0, 0];
    target.thighR = [-0.45 * p + base.thighR[0], base.thighR[1], base.thighR[2]];
    target.shinR = [0.68 * p + base.shinR[0], 0, 0];
    target.armL = [-1.2, 0.24, -0.1];
    target.armR = [-1.2, -0.24, 0.1];
  } else if (state.action === 'hitReact') {
    const p = Math.sin(
      Math.min(1, state.actionTime / Math.max(0.01, state.actionDuration)) *
        Math.PI,
    );
    const k = state.hitReactIntensity * p;
    const hitDir = state.hitReactSide === 0 ? 1 : state.hitReactSide;
    target = { ...base };
    if (state.hitReactZone === 'head') {
      target.abdomenRotX = -0.14 * k;
      target.chestRotX = -0.34 * k;
      target.chestRotY = base.chestRotY + 0.22 * hitDir * k;
      target.headRotX = -0.72 * k;
      target.headRotY = base.headRotY + 0.44 * hitDir * k;
      target.headRotZ = -0.26 * hitDir * k;
      target.armL = [-0.52, -0.24, -0.38];
      target.armR = [-0.52, 0.24, 0.38];
    } else if (state.hitReactZone === 'body') {
      target.abdomenRotX = 0.54 * k;
      target.chestRotX = 0.44 * k;
      target.chestRotZ = 0.16 * hitDir * k;
      target.pelvisY = base.pelvisY - 0.12 * k;
      target.armL = [-0.7, 0.18, -0.25];
      target.armR = [-0.7, -0.18, 0.25];
    } else {
      target.pelvisY = base.pelvisY - 0.13 * k;
      target.pelvisRotZ = 0.28 * hitDir * k;
      target.thighL = [-0.62 * k, 0.12, -0.14];
      target.shinL = [0.74 * k, 0, 0];
    }
  } else if (state.action === 'stunned') {
    const wobble = Math.sin(timeSec * 10.5);
    const kneeBuckle = Math.max(0, Math.sin(timeSec * 7.2));
    target = { ...base };
    target.pelvisY = base.pelvisY - 0.12 - kneeBuckle * 0.05;
    target.pelvisRotZ = wobble * 0.16;
    target.abdomenRotZ = wobble * 0.28;
    target.chestRotZ = wobble * 0.32;
    target.chestRotX = -0.16;
    target.headRotX = -0.28;
    target.headRotZ = -wobble * 0.22;
    target.thighL = [base.thighL[0] - kneeBuckle * 0.28, base.thighL[1], -0.12];
    target.shinL = [base.shinL[0] + kneeBuckle * 0.38, 0, 0];
    target.thighR = [base.thighR[0] - (1 - kneeBuckle) * 0.22, base.thighR[1], 0.12];
    target.shinR = [base.shinR[0] + (1 - kneeBuckle) * 0.3, 0, 0];
    target.armL = [-0.42, -0.18, -0.48 + wobble * 0.12];
    target.forearmL = [-0.85, 0, 0.1];
    target.armR = [-0.42, 0.18, 0.48 + wobble * 0.12];
    target.forearmR = [-0.85, 0, -0.1];
  } else if (state.action === 'knockdown') {
    const kneeCollapse = smoothstep(0, 0.22, state.actionTime);
    const fall = smoothstep(0.08, 0.54, state.actionTime);
    const recover =
      state.actionTime > 0.88
        ? smoothstep(0.88, state.actionDuration, state.actionTime)
        : 0;
    const f = fall * (1 - recover);
    const kc = kneeCollapse * (1 - recover);
    const side = state.hitReactSide || 1;
    target = { ...base };
    target.pelvisY = lerp(base.pelvisY - kc * 0.16, 0.16, f);
    target.pelvisRotX = lerp(0, -Math.PI * 0.47, f);
    target.pelvisRotZ = lerp(0, 0.2 * side, f);
    target.chestRotX = lerp(base.chestRotX, -0.16, f);
    target.headRotX = lerp(base.headRotX, 0.28, f);
    target.headRotY = lerp(base.headRotY, 0.35 * side, f);
    target.armL = [lerp(base.armL[0], -0.32, f), -0.44 * f, -0.92 * f];
    target.armR = [lerp(base.armR[0], -0.26, f), 0.44 * f, 0.92 * f];
    target.forearmL = [lerp(base.forearmL[0], -0.42, f), 0, 0];
    target.forearmR = [lerp(base.forearmR[0], -0.42, f), 0, 0];
    target.thighL = [lerp(base.thighL[0] - kc * 0.35, -0.16, f), 0, -0.18 * f];
    target.thighR = [lerp(base.thighR[0] - kc * 0.25, 0.06, f), 0, 0.18 * f];
    target.shinL = [lerp(base.shinL[0] + kc * 0.48, 0.26, f), 0, 0];
    target.shinR = [lerp(base.shinR[0] + kc * 0.36, 0.14, f), 0, 0];
  } else if (state.action === 'ko') {
    const t = state.actionTime;
    const side = state.hitReactSide === 0 ? 1 : state.hitReactSide;
    const whiplash = Math.sin(clamp(t / 0.19, 0, 1) * Math.PI);
    const kneeGive = smoothstep(0.02, 0.24, t);
    const dropRaw = clamp((t - 0.1) / 0.42, 0, 1);
    const gravityDrop = dropRaw * dropRaw * (2 - dropRaw * 0.85);
    const drop = clamp(gravityDrop, 0, 1);
    const bounce =
      t > 0.48 && t < 0.84
        ? Math.sin(((t - 0.48) / 0.36) * Math.PI) * 0.055 * (1 - (t - 0.48) / 0.36)
        : 0;
    const settle = smoothstep(0.5, 0.86, t);
    const headSlamBounce =
      t > 0.52 && t < 0.88
        ? Math.sin(((t - 0.52) / 0.36) * Math.PI) * 0.26
        : 0;

    target = { ...base };
    if (state.koStyle === 'crumple') {
      // Devastating fold-under crumple KO (knees buckle forward first, torso folds onto mat)
      const crumpleDrop = smoothstep(0.08, 0.55, t);
      target.pelvisY = lerp(base.pelvisY - kneeGive * 0.32, 0.15, crumpleDrop) + bounce * 0.7;
      target.pelvisRotX = lerp(0, -Math.PI * 0.42, crumpleDrop);
      target.pelvisRotZ = lerp(0, 0.42 * side, crumpleDrop);
      target.abdomenRotX = lerp(base.abdomenRotX, 0.45 * (1 - settle * 0.5), crumpleDrop);
      target.chestRotX = lerp(base.chestRotX, 0.25 * (1 - settle * 0.6), crumpleDrop);
      target.chestRotZ = 0.28 * side * crumpleDrop;
      target.headRotX = -0.65 * whiplash + lerp(0, 0.44, settle) - headSlamBounce;
      target.headRotY = 0.52 * side * drop;
      target.headRotZ = -0.35 * side * settle;
      target.thighL = [-1.15 * kneeGive * (1 - settle * 0.55), -0.18 * side, -0.28 * settle];
      target.shinL = [1.85 * kneeGive * (1 - settle * 0.65), 0, 0];
      target.thighR = [-0.95 * kneeGive * (1 - settle * 0.5), 0.16 * side, 0.26 * settle];
      target.shinR = [1.55 * kneeGive * (1 - settle * 0.55), 0, 0];
      target.armL = [lerp(-0.1, 0.18, settle), -0.38 * drop, -0.78 * drop];
      target.armR = [lerp(-0.15, -0.34, settle), 0.48 * drop, 1.05 * drop];
      target.forearmL = [-0.35 - 0.3 * bounce, 0.15, 0];
      target.forearmR = [-0.25 - 0.25 * bounce, -0.15, 0];
    } else if (state.koStyle === 'twisted') {
      // Corkscrew hook / head kick KO: violent head snap & twisted flat sprawl
      target.pelvisY = lerp(base.pelvisY - kneeGive * 0.12, 0.145, drop) + bounce;
      target.pelvisRotX = lerp(0, -Math.PI * 0.48, drop);
      target.pelvisRotY = lerp(0, 0.48 * side, drop);
      target.pelvisRotZ = lerp(0, 0.36 * side, drop);
      target.abdomenRotY = lerp(0, 0.22 * side, drop);
      target.chestRotX = lerp(-0.32 * whiplash, -0.12, drop);
      target.chestRotY = 0.35 * side * whiplash;
      target.headRotX = -0.92 * whiplash - headSlamBounce + 0.18 * settle;
      target.headRotY = 0.68 * side * clamp(whiplash + settle * 0.85, 0, 1);
      target.headRotZ = -0.4 * side * drop;
      // Fencing / flail arm reflex mid-fall turning into asymmetric unconscious sprawl
      target.armL = [
        lerp(-0.85 * whiplash, -0.12, settle),
        lerp(-0.4, -0.58, settle),
        lerp(-1.25 * drop, -1.12, settle),
      ];
      target.armR = [
        lerp(-1.05 * whiplash, -0.38, settle),
        lerp(0.35, 0.62, settle),
        lerp(1.18 * drop, 0.94, settle),
      ];
      target.forearmL = [lerp(-0.18, -0.45, settle) - bounce * 2.5, 0, 0.15];
      target.forearmR = [lerp(-0.55, -0.18, settle) - bounce * 2.2, 0, -0.15];
      target.thighL = [lerp(-0.32 * kneeGive, -0.24, settle), -0.14 * settle, -0.26 * settle];
      target.thighR = [lerp(-0.15 * kneeGive, 0.12, settle), 0.16 * settle, 0.14 * settle];
      target.shinL = [lerp(0.55 * kneeGive, 0.48, settle), 0, 0];
      target.shinR = [lerp(0.28 * kneeGive, 0.16, settle), 0, 0];
    } else {
      // Classic clean straight/kick "Timber" backward knockout with mat head-bounce
      target.pelvisY = lerp(base.pelvisY - kneeGive * 0.14, 0.145, drop) + bounce;
      target.pelvisRotX = lerp(0, -Math.PI * 0.49, drop);
      target.pelvisRotZ = lerp(0, 0.16 * side, drop);
      target.chestRotX = lerp(-0.38 * whiplash, -0.1, drop);
      target.headRotX = -0.88 * whiplash - headSlamBounce + 0.16 * settle;
      target.headRotY = 0.46 * side * settle;
      target.headRotZ = -0.24 * side * settle;
      target.armL = [
        lerp(-0.45 * whiplash, -0.22, settle),
        -0.55 * drop,
        lerp(-0.95, -1.16, settle) * drop,
      ];
      target.armR = [
        lerp(-0.92 * whiplash, -0.08, settle),
        0.5 * drop,
        lerp(1.05, 0.88, settle) * drop,
      ];
      target.forearmL = [-0.28 - bounce * 2.4, 0, 0];
      target.forearmR = [-0.52 - bounce * 2.2, 0, 0];
      target.thighL = [lerp(-0.28 * kneeGive, -0.22, settle), 0, -0.22 * drop];
      target.thighR = [lerp(-0.14 * kneeGive, 0.08, settle), 0, 0.16 * drop];
      target.shinL = [lerp(0.48 * kneeGive, 0.36, settle), 0, 0];
      target.shinR = [lerp(0.24 * kneeGive, 0.14, settle), 0, 0];
    }
  } else if (state.guard === 'high') {
    target = { ...base };
    target.armL = [-1.22, 0.28, -0.05];
    target.forearmL = [-2.05, 0, 0.12];
    target.armR = [-1.22, -0.28, 0.05];
    target.forearmR = [-2.05, 0, -0.12];
    target.abdomenRotX = 0.18;
    target.headRotX = 0.15;
  } else if (state.guard === 'low') {
    target = { ...base };
    target.pelvisY = base.pelvisY - 0.06;
    target.armL = [-0.62, 0.22, -0.12];
    target.forearmL = [-1.45, 0.2, 0.1];
    target.armR = [-0.62, -0.22, 0.12];
    target.forearmR = [-1.45, 0.2, -0.1];
    target.abdomenRotX = 0.24;
  }

  const limbRate =
    state.action === 'strike' || state.action === 'hitReact' || state.action === 'ko'
      ? 36
      : 18;
  const bodyRate = state.action === 'strike' || state.action === 'ko' ? 24 : 14;
  const alphaBody = 1 - Math.exp(-bodyRate * Math.min(dt, 0.05));
  const alphaLimbs = 1 - Math.exp(-limbRate * Math.min(dt, 0.05));
  interpolatePose(rig, target, alphaBody, alphaLimbs);

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
  } else if (state.hitFlashTimer > 0) {
    const intensity = Math.min(0.6, state.hitFlashTimer * 8);
    rig.skinMaterial.emissive.setHex(0x883322);
    rig.skinMaterial.emissiveIntensity = intensity;
    rig.abdomenSkinMaterial.emissive.setHex(0x883322);
    rig.abdomenSkinMaterial.emissiveIntensity = intensity;
    rig.faceMaterial.emissive.setHex(0x883322);
    rig.faceMaterial.emissiveIntensity = intensity;
  } else {
    rig.skinMaterial.emissiveIntensity = 0;
    rig.abdomenSkinMaterial.emissiveIntensity = 0;
    rig.faceMaterial.emissiveIntensity = 0;
  }
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
