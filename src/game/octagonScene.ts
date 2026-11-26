import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArenaType,
  BACKYARD_HALF_SIZE,
  BoutState,
  BOXING_RING_HALF_SIZE,
  OCTAGON_RADIUS,
} from './combatEngine';
import {
  applyFighterPose,
  applyMainMenuHeroPose,
  applySelectShowcasePose,
  BloodParticlePool,
  buildFighterRig,
  getFighterHeadWorldPosition,
  JointMap,
  setFighterHeadHidden,
  SweatParticlePool,
} from './mocapRig';
import {
  preloadConorMcgregorModel,
  preloadMixamoAnimations,
} from './mixamoFbxAnimator';
import { CameraPreset } from './controlSettings';

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createCanvasMatTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Immediate neutral UFC canvas grey fallback while image decodes
  ctx.fillStyle = '#b9c1c9';
  ctx.fillRect(0, 0, 1024, 1024);

  for (let i = 0; i < 4500; i++) {
    const x = (i * 197) % 1024;
    const y = (i * 313) % 1024;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return;

    // Detect inner grey mat rectangle inside the black outer cage perimeter
    let sx = Math.round(w * 0.112);
    let sy = Math.round(h * 0.112);
    let ex = Math.round(w * 0.888);
    let ey = Math.round(h * 0.888);

    try {
      const probe = document.createElement('canvas');
      probe.width = w;
      probe.height = h;
      const pctx = probe.getContext('2d');
      if (pctx) {
        pctx.drawImage(img, 0, 0, w, h);
        const data = pctx.getImageData(0, 0, w, h).data;
        const lum = (px: number, py: number) => {
          const idx = (py * w + px) * 4;
          return data[idx] + data[idx + 1] + data[idx + 2];
        };

        const findInner = (
          len: number,
          fromEnd: boolean,
          sampleAt: (pos: number) => number,
        ): number | null => {
          let sawDarkRim = false;
          const limit = Math.floor(len * 0.28);
          for (let step = 0; step < limit; step++) {
            const pos = fromEnd ? len - 1 - step : step;
            const s = sampleAt(pos);
            if (s < 150) {
              sawDarkRim = true;
            } else if (sawDarkRim && s > 340) {
              return fromEnd ? pos - 4 : pos + 4;
            }
          }
          return null;
        };

        const yProbeA = Math.round(h * 0.36);
        const yProbeB = Math.round(h * 0.64);
        const xProbeA = Math.round(w * 0.36);
        const xProbeB = Math.round(w * 0.64);

        const lA = findInner(w, false, (x) => lum(x, yProbeA));
        const lB = findInner(w, false, (x) => lum(x, yProbeB));
        const rA = findInner(w, true, (x) => lum(x, yProbeA));
        const rB = findInner(w, true, (x) => lum(x, yProbeB));
        const tA = findInner(h, false, (y) => lum(xProbeA, y));
        const tB = findInner(h, false, (y) => lum(xProbeB, y));
        const bA = findInner(h, true, (y) => lum(xProbeA, y));
        const bB = findInner(h, true, (y) => lum(xProbeB, y));

        if (lA !== null && lB !== null) sx = Math.max(lA, lB);
        if (rA !== null && rB !== null) ex = Math.min(rA, rB);
        if (tA !== null && tB !== null) sy = Math.max(tA, tB);
        if (bA !== null && bB !== null) ey = Math.min(bA, bB);
      }
    } catch {
      // Fall back to proportional inner crop if pixel readback is restricted
    }

    const sw = Math.max(64, ex - sx);
    const sh = Math.max(64, ey - sy);
    ctx.clearRect(0, 0, 1024, 1024);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1024, 1024);

    // Subtle canvas weave grain for physical specular break-up under arena spots
    for (let i = 0; i < 4500; i++) {
      const x = (i * 197) % 1024;
      const y = (i * 313) % 1024;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.022)' : 'rgba(255,255,255,0.024)';
      ctx.fillRect(x, y, 2, 2);
    }

    tex.needsUpdate = true;
  };
  img.src = '/assets/aistudio/236PR-Canvas_68b1196b.jpg';

  return tex;
}

function createFenceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  ctx.strokeStyle = 'rgba(20, 22, 26, 0.88)';
  ctx.lineWidth = 4;

  // Diamond chain-link pattern
  for (let i = -128; i < 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 128, 128);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i, 128);
    ctx.lineTo(i + 128, 0);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 4.5);
  tex.needsUpdate = true;
  return tex;
}

function createPostDecalTexture(
  bgHex: string,
  label: string,
  accentHex: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 128, 512);

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 24, 128, 18);
  ctx.fillRect(0, 470, 128, 18);

  ctx.save();
  ctx.translate(64, 256);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 40px "Barlow Condensed", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createBoxingMatTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Dark championship outer apron border
  ctx.fillStyle = '#111927';
  ctx.fillRect(0, 0, 1024, 1024);

  // Inner classic slate-blue boxing canvas
  ctx.fillStyle = '#263e63';
  ctx.fillRect(62, 62, 900, 900);

  // Subtle woven canvas texture
  for (let i = 0; i < 6500; i++) {
    const x = 62 + ((i * 197) % 900);
    const y = 62 + ((i * 313) % 900);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.035)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Red & Blue corner triangles inside the ring
  ctx.fillStyle = 'rgba(210, 38, 38, 0.72)';
  ctx.beginPath();
  ctx.moveTo(62, 62);
  ctx.lineTo(220, 62);
  ctx.lineTo(62, 220);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(34, 102, 224, 0.72)';
  ctx.beginPath();
  ctx.moveTo(962, 62);
  ctx.lineTo(804, 62);
  ctx.lineTo(962, 220);
  ctx.closePath();
  ctx.fill();

  // Ring rope boundary lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 6;
  ctx.strokeRect(62, 62, 900, 900);
  ctx.strokeStyle = 'rgba(244, 192, 56, 0.38)';
  ctx.lineWidth = 3;
  ctx.strokeRect(108, 108, 808, 808);

  // Center ring championship medallion
  ctx.save();
  ctx.translate(512, 512);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 175, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.font = 'italic 800 84px "Barlow Condensed", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OFC BOXING', 0, -16);
  ctx.fillStyle = 'rgba(244, 192, 56, 0.28)';
  ctx.font = '700 30px "Barlow Condensed", sans-serif';
  ctx.fillText('CHAMPIONSHIP RING', 0, 44);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function createBoxingApronTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0d1320';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#d4a64a';
  ctx.fillRect(0, 0, 512, 8);
  ctx.fillRect(0, 120, 512, 8);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic 800 44px "Barlow Condensed", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OFC  ·  CHAMPIONSHIP BOXING', 256, 66);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createBackyardGroundTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Rich evening backyard turf grass outer surround
  ctx.fillStyle = '#23361b';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle turf patches
  for (let i = 0; i < 4200; i++) {
    const x = (i * 223) % 1024;
    const y = (i * 359) % 1024;
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(48, 78, 34, 0.35)'
        : i % 3 === 1
          ? 'rgba(18, 28, 14, 0.35)'
          : 'rgba(65, 86, 38, 0.22)';
    ctx.fillRect(x, y, 4, 4);
  }

  // Worn central dirt pit gradient
  const dirtGrad = ctx.createRadialGradient(512, 512, 160, 512, 512, 470);
  dirtGrad.addColorStop(0, '#5d4732');
  dirtGrad.addColorStop(0.55, '#4b3927');
  dirtGrad.addColorStop(0.82, 'rgba(59, 52, 31, 0.72)');
  dirtGrad.addColorStop(1, 'rgba(35, 54, 27, 0)');
  ctx.fillStyle = dirtGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Scuffed earth grit inside fighting pit
  for (let i = 0; i < 4800; i++) {
    const x = 180 + ((i * 197) % 664);
    const y = 180 + ((i * 313) % 664);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.09)' : 'rgba(195,165,120,0.08)';
    ctx.fillRect(x, y, 3, 2);
  }

  // Chalk / spray-painted square fighting ring boundary
  ctx.strokeStyle = 'rgba(240, 232, 210, 0.62)';
  ctx.lineWidth = 7;
  ctx.setLineDash([28, 12]);
  ctx.strokeRect(216, 216, 592, 592);
  ctx.setLineDash([]);

  // Center backyard street emblem
  ctx.save();
  ctx.translate(512, 512);
  ctx.strokeStyle = 'rgba(255, 142, 28, 0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 118, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 244, 224, 0.22)';
  ctx.font = 'italic 800 58px "Barlow Condensed", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BACKYARD', 0, -14);
  ctx.font = '700 26px "Barlow Condensed", sans-serif';
  ctx.fillText('BRAWL PIT', 0, 28);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function buildOfficialFigure(isCameraman: boolean): THREE.Group {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({
    color: isCameraman ? 0x111216 : 0x1b1e24,
    roughness: 0.78,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x0e0f12,
    roughness: 0.86,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc69473,
    roughness: 0.58,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x171514,
    roughness: 0.85,
  });

  // Left & Right Legs
  const legGeo = new THREE.CapsuleGeometry(0.068, 0.72, 6, 10);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.095, 0.43, 0);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.095, 0.43, 0);
  g.add(legL, legR);

  // Torso
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.155, 0.36, 8, 12),
    shirtMat,
  );
  torso.scale.set(1.12, 1.0, 0.75);
  torso.position.y = 1.13;
  g.add(torso);

  // Arms
  const armGeo = new THREE.CapsuleGeometry(0.044, 0.42, 6, 10);
  const armL = new THREE.Mesh(armGeo, isCameraman ? shirtMat : skinMat);
  armL.position.set(-0.21, 1.1, 0.04);
  armL.rotation.x = isCameraman ? -0.9 : -0.35;
  const armR = new THREE.Mesh(armGeo, isCameraman ? shirtMat : skinMat);
  armR.position.set(0.21, 1.1, 0.04);
  armR.rotation.x = isCameraman ? -1.1 : -0.35;
  g.add(armL, armR);

  // Neck & Head
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.055, 0.1, 10),
    skinMat,
  );
  neck.position.y = 1.44;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 10),
    skinMat,
  );
  head.position.y = 1.56;
  head.scale.set(0.9, 1.06, 0.96);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.103, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat,
  );
  hair.position.set(0, 1.57, -0.006);
  hair.scale.set(0.91, 1.05, 0.98);
  g.add(neck, head, hair);

  if (isCameraman) {
    const camBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.16, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.35, metalness: 0.45 }),
    );
    camBody.position.set(0.19, 1.54, 0.16);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0x090a0c, roughness: 0.2, metalness: 0.75 }),
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0.19, 1.54, 0.38);
    g.add(camBody, lens);
  }

  return g;
}

function createMatBloodSplatTexture(variant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 44);
  grad.addColorStop(0, 'rgba(110, 6, 8, 0.94)');
  grad.addColorStop(0.5, 'rgba(138, 10, 10, 0.78)');
  grad.addColorStop(0.85, 'rgba(90, 6, 8, 0.25)');
  grad.addColorStop(1, 'rgba(60, 4, 4, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(64, 64, 38, 28 + (variant % 2) * 8, variant * 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Satellite splatter drops & directional streaks
  ctx.fillStyle = 'rgba(128, 8, 10, 0.82)';
  for (let i = 0; i < 12; i++) {
    const a = ((i * 1.9 + variant * 1.1) % (Math.PI * 2));
    const dist = 24 + ((i * 19 + variant * 13) % 34);
    const rx = 2.5 + ((i * 7) % 5);
    const ry = 2.0 + ((i * 5) % 4);
    ctx.beginPath();
    ctx.ellipse(
      64 + Math.cos(a) * dist,
      64 + Math.sin(a) * dist,
      rx,
      ry,
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class OctagonSceneManager {
  public readonly isSoftwareGl: boolean;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly sweatPool: SweatParticlePool;
  public readonly bloodPool: BloodParticlePool;

  private container: HTMLElement;
  private rigRed: JointMap | null = null;
  private rigBlue: JointMap | null = null;
  private hemiLight: THREE.HemisphereLight;
  private keySpot: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private coolFill: THREE.DirectionalLight;
  private referee: THREE.Group;
  private cameraman: THREE.Group;
  private octagonGroup: THREE.Group;
  private boxingRingGroup: THREE.Group;
  private backyardGroup: THREE.Group;
  private indoorArenaGroup: THREE.Group;
  private bloodDecalGroup: THREE.Group;
  private bloodDecalMeshes: THREE.Mesh[] = [];
  private bloodDecalCursor = 0;
  private bleedDripTimers: [number, number] = [0, 0];
  private currentArena: ArenaType = 'octagon';
  private flashMeshes: THREE.Mesh[] = [];
  private showcaseGroup: THREE.Group;
  private showcaseRedLight: THREE.PointLight;
  private showcaseBlueLight: THREE.PointLight;
  private menuStageGroup: THREE.Group;
  private menuKeyLight: THREE.PointLight;
  private menuFireRimLight: THREE.PointLight;
  private rockedLight: THREE.PointLight;
  private rockedLightTimer = 0;
  private readonly tmpHeadWorld = new THREE.Vector3();
  private readonly tmpDesiredPos = new THREE.Vector3();
  private readonly tmpDesiredLook = new THREE.Vector3();
  private readonly tmpFpHeadPos = new THREE.Vector3();

  private camPos = new THREE.Vector3(0.03, 1.48, 1.24);
  private camLook = new THREE.Vector3(0.2, 1.43, 0.2);
  private lastMode = '';
  private cameraPreset: CameraPreset = 'default';
  private lastCameraPreset: CameraPreset = 'default';
  private targetFov = 42;
  private trauma = 0;
  private frameId = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;
  private disposableResources: Array<{ dispose: () => void }> = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const rect = container.getBoundingClientRect();
    const w = Math.max(320, rect.width || window.innerWidth);
    const h = Math.max(240, rect.height || window.innerHeight);
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060507);
    this.scene.fog = new THREE.FogExp2(0x060507, 0.052);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 120);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // Mandatory studio environment reflection map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTex;
    this.disposableResources.push(envTex);
    pmrem.dispose();

    // Arena 3-point warm/cool spotlight rig (1 shadow caster)
    this.hemiLight = new THREE.HemisphereLight(0xb8c9e8, 0x261a12, 0.36);
    this.scene.add(this.hemiLight);

    this.keySpot = new THREE.DirectionalLight(0xffebd1, 3.15);
    this.keySpot.position.set(2.5, 11.5, 4.5);
    this.keySpot.castShadow = !this.isSoftwareGl;
    this.keySpot.shadow.mapSize.set(1024, 1024);
    this.keySpot.shadow.camera.near = 2;
    this.keySpot.shadow.camera.far = 30;
    const d = 8.5;
    this.keySpot.shadow.camera.left = -d;
    this.keySpot.shadow.camera.right = d;
    this.keySpot.shadow.camera.top = d;
    this.keySpot.shadow.camera.bottom = -d;
    this.keySpot.shadow.bias = -0.0005;
    this.keySpot.shadow.normalBias = 0.02;
    this.scene.add(this.keySpot);

    this.rimLight = new THREE.DirectionalLight(0xffb56e, 1.85);
    this.rimLight.position.set(-4.5, 7.5, -5.5);
    this.scene.add(this.rimLight);

    this.coolFill = new THREE.DirectionalLight(0x6e98de, 0.55);
    this.coolFill.position.set(5.5, 4.5, -3.5);
    this.scene.add(this.coolFill);

    // Preload Mixamo FBX skeletons & clips + Conor McGregor FBX character model asynchronously
    void preloadMixamoAnimations();
    void preloadConorMcgregorModel();

    // Build Octagon, Boxing Ring & Backyard Arenas
    this.octagonGroup = this.buildOctagon();
    this.scene.add(this.octagonGroup);
    this.boxingRingGroup = this.buildBoxingRing();
    this.boxingRingGroup.visible = false;
    this.scene.add(this.boxingRingGroup);
    this.backyardGroup = this.buildBackyardArena();
    this.backyardGroup.visible = false;
    this.scene.add(this.backyardGroup);

    this.referee = buildOfficialFigure(false);
    this.referee.position.set(0.3, 0, -2.55);
    this.scene.add(this.referee);

    this.cameraman = buildOfficialFigure(true);
    this.cameraman.position.set(5.8, 0, -6.9);
    this.cameraman.rotation.y = -0.62;
    this.scene.add(this.cameraman);

    this.indoorArenaGroup = new THREE.Group();
    this.buildArenaBowl(this.indoorArenaGroup);
    this.buildOverheadLights(this.indoorArenaGroup);
    this.scene.add(this.indoorArenaGroup);

    // Split Red/Blue Showcase Stage Rig for Fighter Select Screen
    this.showcaseGroup = this.buildShowcaseStage();
    this.scene.add(this.showcaseGroup);

    this.showcaseRedLight = new THREE.PointLight(0xff2c1f, 0, 8.5, 1.2);
    this.showcaseRedLight.position.set(-2.3, 2.0, 1.4);
    this.scene.add(this.showcaseRedLight);

    this.showcaseBlueLight = new THREE.PointLight(0x2475ff, 0, 8.5, 1.2);
    this.showcaseBlueLight.position.set(2.3, 2.0, 1.4);
    this.scene.add(this.showcaseBlueLight);

    // Blazing Amber-Orange-Red Main Menu Hero Stage (matching image_c94e6796.png)
    this.menuStageGroup = this.buildMainMenuStage();
    this.scene.add(this.menuStageGroup);

    this.menuKeyLight = new THREE.PointLight(0xffb574, 0, 5.5, 1.2);
    this.menuKeyLight.position.set(0.92, 1.98, 0.88);
    this.scene.add(this.menuKeyLight);

    this.menuFireRimLight = new THREE.PointLight(0xff3000, 0, 6.0, 1.2);
    this.menuFireRimLight.position.set(-0.42, 1.65, -0.45);
    this.scene.add(this.menuFireRimLight);

    // Orange-red rocked impact flash point light
    this.rockedLight = new THREE.PointLight(0xff4a00, 0, 6.0, 1.3);
    this.rockedLight.position.set(0, 1.5, 0.4);
    this.scene.add(this.rockedLight);

    this.sweatPool = new SweatParticlePool();
    this.scene.add(this.sweatPool.points);

    this.bloodPool = new BloodParticlePool();
    this.scene.add(this.bloodPool.points);

    // Pooled glossy mat blood splatter decals
    this.bloodDecalGroup = new THREE.Group();
    const splatGeo = new THREE.PlaneGeometry(1, 1);
    const splatMats = [0, 1, 2].map((variant) => {
      const tex = createMatBloodSplatTexture(variant);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        roughness: 0.2,
        metalness: 0.08,
      });
      this.disposableResources.push(tex, mat);
      return mat;
    });
    this.disposableResources.push(splatGeo);
    for (let i = 0; i < 96; i++) {
      const m = new THREE.Mesh(splatGeo, splatMats[i % splatMats.length]);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.008 + i * 0.00006;
      m.visible = false;
      this.bloodDecalGroup.add(m);
      this.bloodDecalMeshes.push(m);
    }
    this.scene.add(this.bloodDecalGroup);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  private buildOctagon(): THREE.Group {
    const group = new THREE.Group();
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const matTex = createCanvasMatTexture(maxAniso);
    this.disposableResources.push(matTex);

    // Octagon canvas platform with planar world-aligned top-cap UVs
    const matGeo = new THREE.CylinderGeometry(
      OCTAGON_RADIUS,
      OCTAGON_RADIUS + 0.15,
      0.55,
      8,
    );
    const posAttr = matGeo.attributes.position;
    const normAttr = matGeo.attributes.normal;
    const uvAttr = matGeo.attributes.uv;
    const rot = Math.PI / 8;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const matSpan = 2 * OCTAGON_RADIUS * Math.cos(Math.PI / 8);
    for (let i = 0; i < posAttr.count; i++) {
      if (normAttr.getY(i) > 0.9) {
        const lx = posAttr.getX(i);
        const lz = posAttr.getZ(i);
        const wx = lx * cosR + lz * sinR;
        const wz = -lx * sinR + lz * cosR;
        uvAttr.setXY(i, 0.5 + wx / matSpan, 0.5 - wz / matSpan);
      }
    }
    uvAttr.needsUpdate = true;

    const matSideMaterial = new THREE.MeshStandardMaterial({
      color: 0x16181e,
      roughness: 0.85,
      metalness: 0.05,
    });
    const matMaterial = new THREE.MeshStandardMaterial({
      map: matTex,
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.02,
    });
    const platform = new THREE.Mesh(matGeo, [
      matSideMaterial,
      matMaterial,
      matSideMaterial,
    ]);
    platform.position.y = -0.275;
    platform.rotation.y = Math.PI / 8;
    platform.receiveShadow = true;
    group.add(platform);
    this.disposableResources.push(matGeo, matMaterial, matSideMaterial);

    // Outer apron floor scaled around larger Octagon
    const apronGeo = new THREE.CylinderGeometry(
      OCTAGON_RADIUS + 4.4,
      OCTAGON_RADIUS + 4.4,
      0.25,
      16,
    );
    const apronMat = new THREE.MeshStandardMaterial({
      color: 0x0a0b0e,
      roughness: 0.92,
      metalness: 0.04,
    });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.position.y = -0.68;
    group.add(apron);
    this.disposableResources.push(apronGeo, apronMat);

    // 8 Corner Posts + Top/Bottom Rim Pads + Chain-Link Fence Panels
    const fenceTex = createFenceTexture();
    this.disposableResources.push(fenceTex);

    const fenceMat = new THREE.MeshStandardMaterial({
      map: fenceTex,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0.35,
    });

    const railMat = new THREE.MeshStandardMaterial({
      color: 0x16181d,
      roughness: 0.58,
      metalness: 0.08,
    });

    const postGeo = new THREE.CylinderGeometry(0.13, 0.13, 1.92, 12);
    this.disposableResources.push(postGeo, fenceMat, railMat);

    const postConfigs = [
      { bg: '#a61c1c', label: 'FIGHT PASS', accent: '#ffffff' },
      { bg: '#15171c', label: 'OCTAGON', accent: '#c92a2a' },
      { bg: '#18427a', label: 'TOYO TIRES', accent: '#ffffff' },
      { bg: '#15171c', label: 'UFC', accent: '#d9b152' },
      { bg: '#15171c', label: 'UFC', accent: '#c92a2a' },
      { bg: '#18427a', label: 'FIGHT NIGHT', accent: '#ffffff' },
      { bg: '#15171c', label: 'VENUM', accent: '#ffffff' },
      { bg: '#a61c1c', label: 'UFC', accent: '#ffffff' },
    ];

    const corners: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      corners.push(
        new THREE.Vector3(
          Math.cos(a) * OCTAGON_RADIUS,
          0,
          Math.sin(a) * OCTAGON_RADIUS,
        ),
      );
    }

    for (let i = 0; i < 8; i++) {
      const c = corners[i];
      const cfg = postConfigs[i];
      const pTex = createPostDecalTexture(cfg.bg, cfg.label, cfg.accent);
      const pMat = new THREE.MeshStandardMaterial({
        map: pTex,
        color: 0xffffff,
        roughness: 0.55,
      });
      this.disposableResources.push(pTex, pMat);

      const post = new THREE.Mesh(postGeo, pMat);
      post.position.set(c.x, 0.96, c.z);
      post.rotation.y = -Math.atan2(c.z, c.x) + Math.PI / 2;
      post.castShadow = true;
      group.add(post);

      const next = corners[(i + 1) % 8];
      const mid = c.clone().add(next).multiplyScalar(0.5);
      const segLen = c.distanceTo(next);
      const segAngle = Math.atan2(next.z - c.z, next.x - c.x);

      const isFrontCameraPanel = mid.z > OCTAGON_RADIUS * 0.64;

      const railGeo = new THREE.CylinderGeometry(0.065, 0.065, segLen, 10);
      const topRail = new THREE.Mesh(railGeo, railMat);
      topRail.rotation.z = Math.PI / 2;
      topRail.rotation.y = -segAngle;
      topRail.position.set(mid.x, isFrontCameraPanel ? 0.06 : 1.78, mid.z);
      group.add(topRail);
      this.disposableResources.push(railGeo);

      if (!isFrontCameraPanel) {
        const panelGeo = new THREE.PlaneGeometry(segLen, 1.7);
        const panel = new THREE.Mesh(panelGeo, fenceMat);
        panel.position.set(mid.x, 0.9, mid.z);
        panel.rotation.y = -segAngle;
        group.add(panel);
        this.disposableResources.push(panelGeo);
      }
    }

    return group;
  }

  private buildBoxingRing(): THREE.Group {
    const group = new THREE.Group();
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const matTex = createBoxingMatTexture(maxAniso);
    const apronTex = createBoxingApronTexture();
    this.disposableResources.push(matTex, apronTex);

    const deckSpan = (BOXING_RING_HALF_SIZE + 0.55) * 2; // 10.1m square canvas
    const ropeHalf = BOXING_RING_HALF_SIZE + 0.12; // 4.62m

    const topMat = new THREE.MeshStandardMaterial({
      map: matTex,
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.02,
    });
    const apronMat = new THREE.MeshStandardMaterial({
      map: apronTex,
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.08,
    });
    const deckGeo = new THREE.BoxGeometry(deckSpan, 0.68, deckSpan);
    const deck = new THREE.Mesh(deckGeo, [
      apronMat,
      apronMat,
      topMat,
      apronMat,
      apronMat,
      apronMat,
    ]);
    deck.position.y = -0.34;
    deck.receiveShadow = true;
    group.add(deck);
    this.disposableResources.push(deckGeo, topMat, apronMat);

    // Arena floor base under boxing apron
    const floorGeo = new THREE.CylinderGeometry(9.6, 9.6, 0.25, 16);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0b0e,
      roughness: 0.92,
      metalness: 0.04,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.8;
    group.add(floor);
    this.disposableResources.push(floorGeo, floorMat);

    // 4 Corner Steel Posts + Padded Turnbuckles
    const postGeo = new THREE.CylinderGeometry(0.11, 0.12, 1.85, 12);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x1d212b,
      roughness: 0.42,
      metalness: 0.65,
    });
    const padGeo = new THREE.BoxGeometry(0.3, 1.24, 0.3);
    const ringCorners: Array<{ x: number; z: number; padHex: number }> = [
      { x: -ropeHalf, z: -ropeHalf, padHex: 0xc92424 }, // Red Corner
      { x: ropeHalf, z: -ropeHalf, padHex: 0x1d5ec9 }, // Blue Corner
      { x: -ropeHalf, z: ropeHalf, padHex: 0xe6e8ee }, // Neutral Front-Left
      { x: ropeHalf, z: ropeHalf, padHex: 0xe6e8ee }, // Neutral Front-Right
    ];
    this.disposableResources.push(postGeo, postMat, padGeo);

    for (const corner of ringCorners) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(corner.x, 0.72, corner.z);
      post.castShadow = true;
      group.add(post);

      const padMat = new THREE.MeshStandardMaterial({
        color: corner.padHex,
        roughness: 0.55,
        metalness: 0.05,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(
        corner.x * 0.96,
        0.86,
        corner.z * 0.96,
      );
      pad.rotation.y = Math.PI / 4;
      pad.castShadow = true;
      group.add(pad);
      this.disposableResources.push(padMat);
    }

    // 4 Horizontal Ring Ropes (Back, Left, Right full height; Front lowered to floor edge so camera never clips)
    const ropeLen = ropeHalf * 2;
    const ropeGeo = new THREE.CylinderGeometry(0.024, 0.024, ropeLen, 10);
    const ropeTiers: Array<{ y: number; color: number }> = [
      { y: 1.38, color: 0xd62424 },
      { y: 1.06, color: 0xedf0f5 },
      { y: 0.74, color: 0xedf0f5 },
      { y: 0.42, color: 0x2563eb },
    ];
    const ropeMats = ropeTiers.map(
      (t) =>
        new THREE.MeshStandardMaterial({
          color: t.color,
          roughness: 0.48,
          metalness: 0.08,
        }),
    );
    this.disposableResources.push(ropeGeo, ...ropeMats);

    ropeTiers.forEach((tier, idx) => {
      const mat = ropeMats[idx];
      // Back side (-Z)
      const backRope = new THREE.Mesh(ropeGeo, mat);
      backRope.rotation.z = Math.PI / 2;
      backRope.position.set(0, tier.y, -ropeHalf);
      group.add(backRope);

      // Left side (-X)
      const leftRope = new THREE.Mesh(ropeGeo, mat);
      leftRope.rotation.x = Math.PI / 2;
      leftRope.position.set(-ropeHalf, tier.y, 0);
      group.add(leftRope);

      // Right side (+X)
      const rightRope = new THREE.Mesh(ropeGeo, mat);
      rightRope.rotation.x = Math.PI / 2;
      rightRope.position.set(ropeHalf, tier.y, 0);
      group.add(rightRope);
    });

    // Low camera-side edge trim bar
    const frontTrim = new THREE.Mesh(ropeGeo, ropeMats[0]);
    frontTrim.rotation.z = Math.PI / 2;
    frontTrim.position.set(0, 0.05, ropeHalf);
    group.add(frontTrim);

    // Corner ring steps on back-left & back-right outer apron
    const stepMat = new THREE.MeshStandardMaterial({
      color: 0x262b36,
      roughness: 0.55,
      metalness: 0.5,
    });
    const stepGeo = new THREE.BoxGeometry(0.95, 0.24, 0.52);
    this.disposableResources.push(stepMat, stepGeo);
    for (const sx of [-3.4, 3.4]) {
      const s1 = new THREE.Mesh(stepGeo, stepMat);
      s1.position.set(sx, -0.54, -(BOXING_RING_HALF_SIZE + 0.85));
      group.add(s1);
    }

    return group;
  }

  private buildBackyardArena(): THREE.Group {
    const group = new THREE.Group();
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const groundTex = createBackyardGroundTexture(maxAniso);
    this.disposableResources.push(groundTex);

    // Wide grassy dusk backyard lawn fading smoothly into horizon fog
    const lawnOuterGeo = new THREE.CircleGeometry(30, 48);
    const lawnOuterMat = new THREE.MeshStandardMaterial({
      color: 0x1e2d17,
      roughness: 0.96,
      metalness: 0.0,
    });
    const lawnOuter = new THREE.Mesh(lawnOuterGeo, lawnOuterMat);
    lawnOuter.rotation.x = -Math.PI / 2;
    lawnOuter.position.y = -0.02;
    lawnOuter.receiveShadow = true;
    group.add(lawnOuter);
    this.disposableResources.push(lawnOuterGeo, lawnOuterMat);

    // Textured dirt & chalk fighting pit square in the yard center
    const pitGeo = new THREE.PlaneGeometry(15.2, 15.2);
    const pitMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.94,
      metalness: 0.02,
    });
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.rotation.x = -Math.PI / 2;
    pit.position.y = 0.0;
    pit.receiveShadow = true;
    group.add(pit);
    this.disposableResources.push(pitGeo, pitMat);

    // Weathered wooden privacy fence around back (-Z), left (-X), right (+X)
    const fenceHalf = BACKYARD_HALF_SIZE + 0.65;
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x563f2c,
      roughness: 0.88,
      metalness: 0.04,
    });
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x3b2a1d,
      roughness: 0.9,
      metalness: 0.05,
    });
    const plankGeo = new THREE.BoxGeometry(0.32, 1.85, 0.06);
    const railGeo = new THREE.BoxGeometry(fenceHalf * 2 + 0.3, 0.09, 0.08);
    const fencePostGeo = new THREE.BoxGeometry(0.14, 1.98, 0.14);
    this.disposableResources.push(woodMat, postMat, plankGeo, railGeo, fencePostGeo);

    const buildFenceWall = (
      axis: 'zBack' | 'xLeft' | 'xRight',
    ) => {
      const wall = new THREE.Group();
      const span = fenceHalf * 2;
      const count = Math.floor(span / 0.35);
      for (let i = 0; i <= count; i++) {
        const offset = -fenceHalf + i * (span / count);
        const plank = new THREE.Mesh(plankGeo, woodMat);
        plank.position.set(offset, 0.92, 0);
        plank.rotation.z = ((i % 5) - 2) * 0.008;
        plank.castShadow = true;
        plank.receiveShadow = true;
        wall.add(plank);
      }
      for (const ry of [0.42, 1.42]) {
        const rail = new THREE.Mesh(railGeo, postMat);
        rail.position.set(0, ry, 0.05);
        wall.add(rail);
      }
      for (let p = -1; p <= 1; p++) {
        const post = new THREE.Mesh(fencePostGeo, postMat);
        post.position.set(p * fenceHalf, 0.99, 0.06);
        post.castShadow = true;
        wall.add(post);
      }
      if (axis === 'zBack') {
        wall.position.set(0, 0, -fenceHalf);
      } else if (axis === 'xLeft') {
        wall.position.set(-fenceHalf, 0, 0);
        wall.rotation.y = Math.PI / 2;
      } else {
        wall.position.set(fenceHalf, 0, 0);
        wall.rotation.y = -Math.PI / 2;
      }
      group.add(wall);
    };

    buildFenceWall('zBack');
    buildFenceWall('xLeft');
    buildFenceWall('xRight');

    // Low camera-side timber kerb on +Z so camera sightline stays 100% open
    const kerbGeo = new THREE.BoxGeometry(fenceHalf * 2, 0.12, 0.16);
    const kerb = new THREE.Mesh(kerbGeo, postMat);
    kerb.position.set(0, 0.05, fenceHalf);
    group.add(kerb);
    this.disposableResources.push(kerbGeo);

    // Composite Stacked Tires & Straw Hay Bales at pit corners
    const tireGeo = new THREE.TorusGeometry(0.36, 0.14, 10, 20);
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x191b1f,
      roughness: 0.85,
      metalness: 0.1,
    });
    const hayGeo = new THREE.BoxGeometry(0.95, 0.46, 0.52);
    const hayMat = new THREE.MeshStandardMaterial({
      color: 0xb9943f,
      roughness: 0.94,
      metalness: 0.02,
    });
    const twineGeo = new THREE.BoxGeometry(0.97, 0.48, 0.04);
    const twineMat = new THREE.MeshStandardMaterial({
      color: 0x5c3e1e,
      roughness: 0.9,
    });
    this.disposableResources.push(
      tireGeo,
      tireMat,
      hayGeo,
      hayMat,
      twineGeo,
      twineMat,
    );

    const tireStacks = [
      [-4.65, -4.65],
      [4.65, -4.65],
    ];
    for (const [tx, tz] of tireStacks) {
      for (let h = 0; h < 3; h++) {
        const tire = new THREE.Mesh(tireGeo, tireMat);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(tx + (h === 2 ? 0.05 : 0), 0.14 + h * 0.25, tz);
        tire.castShadow = true;
        group.add(tire);
      }
    }

    const hayBales = [
      { x: -3.2, z: -4.75, ry: 0.08 },
      { x: 3.1, z: -4.75, ry: -0.06 },
      { x: -4.72, z: 2.2, ry: Math.PI / 2 + 0.1 },
      { x: 4.72, z: 2.1, ry: Math.PI / 2 - 0.08 },
    ];
    for (const hb of hayBales) {
      const baleGroup = new THREE.Group();
      const bale = new THREE.Mesh(hayGeo, hayMat);
      bale.castShadow = true;
      bale.receiveShadow = true;
      baleGroup.add(bale);
      for (const tzOff of [-0.14, 0.14]) {
        const twine = new THREE.Mesh(twineGeo, twineMat);
        twine.position.z = tzOff;
        baleGroup.add(twine);
      }
      baleGroup.position.set(hb.x, 0.23, hb.z);
      baleGroup.rotation.y = hb.ry;
      group.add(baleGroup);
    }

    // Two Tripod Work Floodlights illuminating the backyard pit
    const tripodLegGeo = new THREE.CylinderGeometry(0.022, 0.026, 2.35, 8);
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x353942,
      roughness: 0.5,
      metalness: 0.65,
    });
    const headGeo = new THREE.BoxGeometry(0.46, 0.26, 0.16);
    const housingMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.45,
      metalness: 0.35,
    });
    const lensGeo = new THREE.PlaneGeometry(0.38, 0.2);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff3d4 });
    this.disposableResources.push(
      tripodLegGeo,
      poleMat,
      headGeo,
      housingMat,
      lensGeo,
      lensMat,
    );

    for (const fx of [-4.45, 4.45]) {
      const rig = new THREE.Group();
      const mast = new THREE.Mesh(tripodLegGeo, poleMat);
      mast.position.y = 1.18;
      rig.add(mast);
      const head = new THREE.Mesh(headGeo, housingMat);
      head.position.y = 2.42;
      rig.add(head);
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(0, 2.42, 0.085);
      rig.add(lens);
      rig.position.set(fx, 0, -4.35);
      rig.lookAt(0, 0.6, 0);
      group.add(rig);

      const floodLight = new THREE.PointLight(0xffe1ad, 14, 15, 1.4);
      floodLight.position.set(fx * 0.92, 2.45, -4.0);
      group.add(floodLight);
    }

    // Backyard dusk tree silhouettes & garden shed outside fence fading into dusk fog
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 2.4, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x261d17,
      roughness: 0.95,
    });
    const canopyGeo = new THREE.DodecahedronGeometry(1.55, 1);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x162415,
      roughness: 0.94,
    });
    this.disposableResources.push(trunkGeo, trunkMat, canopyGeo, canopyMat);

    const trees: Array<[number, number, number]> = [
      [-7.8, -7.2, 1.1],
      [-3.5, -8.8, 1.25],
      [4.2, -8.5, 1.15],
      [8.2, -6.5, 1.3],
      [-8.5, 1.2, 1.05],
      [8.6, 1.5, 1.1],
    ];
    for (const [x, z, sc] of trees) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 1.2 * sc, z);
      trunk.scale.setScalar(sc);
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(x, 3.0 * sc, z);
      canopy.scale.set(sc * 1.15, sc * 0.9, sc);
      group.add(trunk, canopy);
    }

    // Small backyard timber shed behind left corner
    const shedGeo = new THREE.BoxGeometry(3.2, 2.2, 2.4);
    const shedMat = new THREE.MeshStandardMaterial({
      color: 0x2d241d,
      roughness: 0.92,
    });
    const roofGeo = new THREE.ConeGeometry(2.5, 0.95, 4);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x1d1d22,
      roughness: 0.85,
    });
    const shed = new THREE.Mesh(shedGeo, shedMat);
    shed.position.set(-0.2, 1.1, -8.4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(-0.2, 2.65, -8.4);
    roof.rotation.y = Math.PI / 4;
    group.add(shed, roof);
    this.disposableResources.push(shedGeo, shedMat, roofGeo, roofMat);

    return group;
  }

  public setArena(arena: ArenaType) {
    this.currentArena = arena;
    this.octagonGroup.visible = arena === 'octagon';
    this.boxingRingGroup.visible = arena === 'boxingRing';
    this.backyardGroup.visible = arena === 'backyard';
  }

  public setCameraPreset(preset: CameraPreset) {
    this.cameraPreset = preset;
  }

  public getCameraPreset(): CameraPreset {
    return this.cameraPreset;
  }

  private buildArenaBowl(target: THREE.Group): THREE.InstancedMesh {
    // Deep dark arena surround
    const ringGeo = new THREE.CylinderGeometry(34, 13.5, 14, 24, 1, true);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x070609,
      roughness: 0.95,
      side: THREE.BackSide,
    });
    const bowl = new THREE.Mesh(ringGeo, ringMat);
    bowl.position.y = 4.6;
    target.add(bowl);
    this.disposableResources.push(ringGeo, ringMat);

    // Stepped dark bleacher risers
    const tierMat = new THREE.MeshStandardMaterial({
      color: 0x0b0a0e,
      roughness: 0.95,
    });
    this.disposableResources.push(tierMat);
    for (let t = 0; t < 4; t++) {
      const rIn = 12.2 + t * 2.9;
      const riserGeo = new THREE.CylinderGeometry(rIn + 2.7, rIn, 0.9, 24, 1, true);
      const riser = new THREE.Mesh(riserGeo, tierMat);
      riser.position.y = 0.2 + t * 1.1;
      target.add(riser);
      this.disposableResources.push(riserGeo);
    }

    // Densely packed dark crowd silhouettes
    const count = 420;
    const geo = new THREE.CapsuleGeometry(0.19, 0.34, 4, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a2524,
      roughness: 0.9,
    });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const tier = Math.floor(i / 105);
      const angle = ((i % 105) / 105) * Math.PI * 2 + tier * 0.07;
      const radius = 12.8 + tier * 2.9 + (Math.random() - 0.5) * 0.45;
      const y = 0.55 + tier * 1.15;

      dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      dummy.lookAt(0, y, 0);
      const sc = 0.92 + Math.random() * 0.26;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      color.setHSL(0.06, 0.16, 0.08 + Math.random() * 0.1);
      inst.setColorAt(i, color);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    target.add(inst);
    this.disposableResources.push(geo, mat);

    // Subtle crowd camera flashes
    const flashGeo = new THREE.SphereGeometry(0.13, 6, 6);
    for (let i = 0; i < 6; i++) {
      const fMat = new THREE.MeshBasicMaterial({
        color: 0xfff5dc,
        transparent: true,
        opacity: 0,
      });
      const m = new THREE.Mesh(flashGeo, fMat);
      const a = (i / 6) * Math.PI * 2;
      m.position.set(Math.cos(a) * 18.5, 4.5 + (i % 3) * 1.2, Math.sin(a) * 18.5);
      target.add(m);
      this.flashMeshes.push(m);
      this.disposableResources.push(fMat);
    }
    this.disposableResources.push(flashGeo);

    return inst;
  }

  private buildOverheadLights(target: THREE.Group) {
    const beamGeo = new THREE.ConeGeometry(4.6, 12, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd299,
      transparent: true,
      opacity: 0.022,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const fixGeo = new THREE.BoxGeometry(0.9, 0.25, 0.5);
    const fixMat = new THREE.MeshBasicMaterial({ color: 0xfff0d4 });
    this.disposableResources.push(beamGeo, beamMat, fixGeo, fixMat);

    const spots = [
      [-3.5, 9.5, -2.5],
      [3.5, 9.5, -2.5],
      [0, 10.2, 0.5],
    ];
    for (const [x, y, z] of spots) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(x, y - 5.2, z);
      target.add(beam);

      const fixture = new THREE.Mesh(fixGeo, fixMat);
      fixture.position.set(x, y + 0.8, z);
      target.add(fixture);
    }
  }

  private buildShowcaseStage(): THREE.Group {
    const group = new THREE.Group();

    const makeGlowTex = (innerHex: string, midHex: string) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(128, 118, 12, 128, 128, 124);
      g.addColorStop(0, innerHex);
      g.addColorStop(0.45, midHex);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    const redTex = makeGlowTex('rgba(235, 38, 28, 0.72)', 'rgba(170, 18, 16, 0.35)');
    const blueTex = makeGlowTex('rgba(32, 108, 245, 0.72)', 'rgba(18, 58, 155, 0.35)');
    const panelGeo = new THREE.PlaneGeometry(4.8, 3.8);

    const redMat = new THREE.MeshBasicMaterial({
      map: redTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const blueMat = new THREE.MeshBasicMaterial({
      map: blueTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const redBackdrop = new THREE.Mesh(panelGeo, redMat);
    redBackdrop.position.set(-1.75, 1.55, -2.0);
    const blueBackdrop = new THREE.Mesh(panelGeo, blueMat);
    blueBackdrop.position.set(1.75, 1.55, -2.0);

    // Angled arena spotlight beams behind left and right fighters
    const beamGeo = new THREE.PlaneGeometry(0.14, 4.2);
    const redBeamMat = new THREE.MeshBasicMaterial({
      color: 0xff4538,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const blueBeamMat = new THREE.MeshBasicMaterial({
      color: 0x3b8eff,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    for (let i = 0; i < 3; i++) {
      const rb = new THREE.Mesh(beamGeo, redBeamMat);
      rb.position.set(-2.35 + i * 0.55, 1.9, -1.65);
      rb.rotation.z = -0.32;
      group.add(rb);

      const bb = new THREE.Mesh(beamGeo, blueBeamMat);
      bb.position.set(2.35 - i * 0.55, 1.9, -1.65);
      bb.rotation.z = 0.32;
      group.add(bb);
    }

    group.add(redBackdrop, blueBackdrop);
    this.disposableResources.push(
      redTex,
      blueTex,
      panelGeo,
      redMat,
      blueMat,
      beamGeo,
      redBeamMat,
      blueBeamMat,
    );
    return group;
  }

  private buildMainMenuStage(): THREE.Group {
    const group = new THREE.Group();

    // Rich fiery orange-amber-crimson backdrop behind hero fighter
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 512;
    bgCanvas.height = 512;
    const ctx = bgCanvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 40, 512, 460);
    grad.addColorStop(0, '#090605');
    grad.addColorStop(0.32, '#7d1103');
    grad.addColorStop(0.56, '#e82400');
    grad.addColorStop(0.82, '#ff8e00');
    grad.addColorStop(1, '#ffb700');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Angled bright amber stage light planes (iconic UFC 6 triangle light shape)
    ctx.fillStyle = 'rgba(255, 185, 25, 0.72)';
    ctx.beginPath();
    ctx.moveTo(220, 48);
    ctx.lineTo(440, 220);
    ctx.lineTo(410, 512);
    ctx.lineTo(130, 512);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 68, 0, 0.55)';
    ctx.beginPath();
    ctx.moveTo(310, 0);
    ctx.lineTo(512, 160);
    ctx.lineTo(512, 512);
    ctx.lineTo(260, 512);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(bgCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;

    const wallGeo = new THREE.PlaneGeometry(5.8, 3.6);
    const wallMat = new THREE.MeshBasicMaterial({
      map: tex,
      depthWrite: true,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0.18, 1.45, -1.05);
    group.add(wall);

    // Subtle fiery side glow streaks
    const flareGeo = new THREE.PlaneGeometry(0.28, 3.2);
    const flareMat = new THREE.MeshBasicMaterial({
      color: 0xff941a,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const f1 = new THREE.Mesh(flareGeo, flareMat);
    f1.position.set(-0.22, 1.6, -0.75);
    f1.rotation.z = -0.35;
    const f2 = new THREE.Mesh(flareGeo, flareMat);
    f2.position.set(0.88, 1.55, -0.75);
    f2.rotation.z = 0.28;
    group.add(f1, f2);

    this.disposableResources.push(tex, wallGeo, wallMat, flareGeo, flareMat);
    return group;
  }

  public clearMatBlood() {
    for (const m of this.bloodDecalMeshes) {
      m.visible = false;
    }
    this.bloodDecalCursor = 0;
  }

  public addMatBloodSplat(
    x: number,
    z: number,
    size = 0.28,
    dirX = 0,
    dirZ = 0,
  ) {
    let sx = x;
    let sz = z;
    if (this.currentArena === 'octagon') {
      const r = Math.hypot(sx, sz);
      const maxR = OCTAGON_RADIUS - 0.55;
      if (r > maxR) {
        sx = (sx / r) * maxR;
        sz = (sz / r) * maxR;
      }
    } else {
      const half =
        (this.currentArena === 'boxingRing'
          ? BOXING_RING_HALF_SIZE
          : BACKYARD_HALF_SIZE) - 0.5;
      sx = THREE.MathUtils.clamp(sx, -half, half);
      sz = THREE.MathUtils.clamp(sz, -half, half);
    }

    const m = this.bloodDecalMeshes[this.bloodDecalCursor];
    this.bloodDecalCursor =
      (this.bloodDecalCursor + 1) % this.bloodDecalMeshes.length;
    m.position.x = sx;
    m.position.z = sz;
    const stretch = Math.hypot(dirX, dirZ) > 0.2 ? 1.45 : 1.05;
    m.scale.set(size * stretch, size * (0.85 + Math.random() * 0.35), 1);
    m.rotation.z =
      Math.hypot(dirX, dirZ) > 0.2
        ? Math.atan2(dirZ, dirX)
        : Math.random() * Math.PI * 2;
    m.visible = true;
  }

  public syncFighters(bout: BoutState) {
    if (this.rigRed) {
      this.rigRed.mixamo?.dispose();
      this.scene.remove(this.rigRed.root);
    }
    if (this.rigBlue) {
      this.rigBlue.mixamo?.dispose();
      this.scene.remove(this.rigBlue.root);
    }
    this.rigRed = buildFighterRig(bout.fighters[0].profile, 'red');
    this.rigBlue = buildFighterRig(bout.fighters[1].profile, 'blue');
    this.scene.add(this.rigRed.root, this.rigBlue.root);
    this.clearMatBlood();
    this.bleedDripTimers = [0, 0];
  }

  public addCameraTrauma(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  public triggerRockedFlash(pos?: { x: number; y: number; z: number }) {
    this.rockedLightTimer = 2.35;
    if (pos) {
      this.rockedLight.position.set(pos.x, Math.max(1.2, pos.y + 0.1), pos.z + 0.45);
    }
  }

  public updateVisuals(
    bout: BoutState,
    mode: 'menu' | 'setup' | 'select' | 'playing' | 'paused' | 'gameover',
    timeSec: number,
    dt: number,
  ) {
    const isMenu = mode === 'menu';
    const isSetup = mode === 'setup';
    const isSelect = mode === 'select';
    const showBackyardSky =
      !isMenu && !isSelect && this.currentArena === 'backyard';

    // Modulate studio vs broadcast arena vs backyard outdoor twilight lighting cleanly
    this.indoorArenaGroup.visible = !showBackyardSky;
    if (showBackyardSky) {
      (this.scene.background as THREE.Color).setHex(0x111724);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0x111724);
        this.scene.fog.density = 0.036;
      }
      this.hemiLight.intensity = 0.52;
      this.keySpot.intensity = 2.65;
      this.rimLight.intensity = 1.45;
      this.coolFill.intensity = 0.65;
      this.scene.environmentIntensity = 0.78;
    } else {
      (this.scene.background as THREE.Color).setHex(0x060507);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0x060507);
        this.scene.fog.density = 0.052;
      }
      this.hemiLight.intensity = isMenu ? 0.11 : isSelect ? 0.24 : 0.36;
      this.keySpot.intensity = isMenu ? 0.52 : isSelect ? 1.85 : 3.15;
      this.rimLight.intensity = isMenu ? 0.28 : isSelect ? 1.15 : 1.85;
      this.coolFill.intensity = isMenu ? 0.06 : isSelect ? 0.4 : 0.55;
      this.scene.environmentIntensity = isMenu ? 0.24 : isSelect ? 0.65 : 0.92;
    }

    this.menuStageGroup.visible = isMenu;
    this.menuKeyLight.intensity = isMenu ? 9.5 : 0;
    this.menuFireRimLight.intensity = isMenu ? 15.5 : 0;

    this.showcaseGroup.visible = isSelect;
    this.showcaseRedLight.intensity = isSelect ? 14 : 0;
    this.showcaseBlueLight.intensity = isSelect ? 14 : 0;

    this.referee.visible = !isMenu && !isSetup && !isSelect;
    this.cameraman.visible =
      !isMenu && !isSetup && !isSelect && this.currentArena !== 'backyard';

    const hideRedHead =
      this.cameraPreset === 'firstPerson' &&
      !isMenu &&
      !isSetup &&
      !isSelect &&
      bout.koWinnerIndex === null;

    this.bloodDecalGroup.visible = !isMenu && !isSetup && !isSelect;

    if (this.rigRed && this.rigBlue) {
      this.rigRed.root.visible = !isSetup;
      this.rigBlue.root.visible = !isMenu && !isSetup;
      setFighterHeadHidden(this.rigRed, hideRedHead);
      setFighterHeadHidden(this.rigBlue, false);
      if (isMenu) {
        applyMainMenuHeroPose(this.rigRed, timeSec, dt);
      } else if (isSelect) {
        applySelectShowcasePose(this.rigRed, 'red', timeSec, dt);
        applySelectShowcasePose(this.rigBlue, 'blue', timeSec, dt);
      } else if (!isSetup) {
        const koWin = bout.koWinnerIndex;
        applyFighterPose(this.rigRed, bout.fighters[0], timeSec, dt, koWin === 0);
        applyFighterPose(this.rigBlue, bout.fighters[1], timeSec, dt, koWin === 1);

        // Passive active-cut bleeding drips during fight
        if (mode === 'playing') {
          const pairs: Array<[0 | 1, JointMap]> = [
            [0, this.rigRed],
            [1, this.rigBlue],
          ];
          const headWorld = this.tmpHeadWorld;
          for (const [idx, rig] of pairs) {
            const f = bout.fighters[idx];
            if (f.headCutSeverity >= 0.24 && f.action !== 'ko') {
              this.bleedDripTimers[idx] -= dt;
              if (this.bleedDripTimers[idx] <= 0) {
                this.bleedDripTimers[idx] =
                  0.18 + (1 - f.headCutSeverity) * 0.42;
                getFighterHeadWorldPosition(rig, headWorld);
                this.bloodPool.spawnDrip({
                  x: headWorld.x,
                  y: headWorld.y - 0.04,
                  z: headWorld.z,
                });
              }
            }
          }
        }
      }
    }

    // Prolonged orange-to-red rocked point spotlight
    if (this.rockedLightTimer > 0) {
      this.rockedLightTimer = Math.max(0, this.rockedLightTimer - dt);
      const pulse = 0.72 + 0.28 * Math.sin(timeSec * 12);
      this.rockedLight.intensity =
        Math.min(1, this.rockedLightTimer / 0.85) * pulse * 20;
    } else {
      this.rockedLight.intensity = 0;
    }

    this.sweatPool.update(dt);
    this.bloodPool.update(dt, (x, z) =>
      this.addMatBloodSplat(x, z, 0.14 + Math.random() * 0.14),
    );

    // Referee tracks midpoint
    const f0 = bout.fighters[0];
    const f1 = bout.fighters[1];
    const midX = (f0.x + f1.x) * 0.5;
    const midZ = (f0.z + f1.z) * 0.5;
    const dist = Math.hypot(f1.x - f0.x, f1.z - f0.z);

    if (!isMenu && !isSetup && !isSelect) {
      const refTargetX = midX * 0.55;
      const refTargetZ = Math.max(-(OCTAGON_RADIUS - 1.5), midZ - 2.55);
      this.referee.position.x = THREE.MathUtils.damp(
        this.referee.position.x,
        refTargetX,
        3.5,
        dt,
      );
      this.referee.position.z = THREE.MathUtils.damp(
        this.referee.position.z,
        refTargetZ,
        3.5,
        dt,
      );
      this.referee.lookAt(midX, 0, midZ);
      this.cameraman.lookAt(midX, 1.1, midZ);
    }

    // Subtle crowd camera flash twinkles
    for (let i = 0; i < this.flashMeshes.length; i++) {
      const m = this.flashMeshes[i];
      const mat = m.material as THREE.MeshBasicMaterial;
      const pulse = Math.sin(timeSec * (4.1 + i * 1.7) + i * 9);
      mat.opacity = pulse > 0.965 ? 0.9 : 0;
    }

    // Camera choreography (zero per-frame Vector3 allocations)
    const desiredPos = this.tmpDesiredPos;
    const desiredLook = this.tmpDesiredLook;
    let desiredFov = 42;
    let desiredNear = 0.1;

    if (isMenu) {
      // Heroic close-up bust framing on right side matching image_c94e6796.png with clean headroom
      const isPortrait = this.camera.aspect < 0.85;
      desiredPos.set(
        0.03 + Math.sin(timeSec * 0.4) * 0.025,
        1.48 + Math.cos(timeSec * 0.35) * 0.012,
        isPortrait ? 1.56 : 1.24,
      );
      desiredLook.set(isPortrait ? 0.06 : 0.2, 1.43, 0.2);
    } else if (isSetup) {
      // Sweeping broadcast arena showcase behind Match Setup overlay
      const orbitAngle = Math.sin(timeSec * 0.16) * 0.38;
      const orbitR = this.camera.aspect < 0.9 ? 11.4 : 9.6;
      desiredPos.set(
        Math.sin(orbitAngle) * orbitR,
        3.75,
        Math.cos(orbitAngle) * orbitR,
      );
      desiredLook.set(0, 0.55, 0);
    } else if (isSelect) {
      // Split showcase framing adapting cleanly to portrait mobile vs widescreen desktop
      const isPortrait = this.camera.aspect < 0.9;
      const selectZ = isPortrait
        ? THREE.MathUtils.clamp(3.9 / (this.camera.aspect * 1.15), 4.4, 7.6)
        : 3.9;
      desiredPos.set(
        Math.sin(timeSec * 0.35) * 0.08,
        isPortrait ? 1.42 : 1.38,
        selectZ,
      );
      desiredLook.set(0, isPortrait ? 0.62 : 1.02, 0.35);
    } else if (bout.koWinnerIndex !== null) {
      const loser = bout.fighters[bout.koWinnerIndex === 0 ? 1 : 0];
      const focusX = THREE.MathUtils.lerp(midX, loser.x, 0.45);
      const focusZ = THREE.MathUtils.lerp(midZ, loser.z, 0.45);
      const koSweep = Math.sin(timeSec * 0.72) * 2.15;
      desiredPos.set(
        focusX + koSweep,
        1.28,
        focusZ + THREE.MathUtils.clamp(2.55 + dist * 0.35, 2.75, 4.2),
      );
      desiredLook.set(focusX, 0.56, focusZ);
    } else {
      // Selectable active fight cameras
      if (this.cameraPreset === 'wide') {
        const aspectScale =
          this.camera.aspect < 1.0
            ? Math.min(1.6, 1.1 / Math.max(0.5, this.camera.aspect))
            : 1.0;
        const camDist = THREE.MathUtils.clamp(
          (5.3 + dist * 0.85) * aspectScale,
          5.6,
          11.4,
        );
        desiredPos.set(midX, 2.55 + dist * 0.12, midZ + camDist);
        desiredLook.set(midX, 0.92, midZ);
        desiredFov = 48;
      } else if (this.cameraPreset === 'close') {
        const aspectScale =
          this.camera.aspect < 1.0
            ? Math.min(1.35, 0.98 / Math.max(0.5, this.camera.aspect))
            : 1.0;
        const camDist = THREE.MathUtils.clamp(
          (2.25 + dist * 0.56) * aspectScale,
          2.45,
          5.8,
        );
        desiredPos.set(midX, 1.48 + dist * 0.04, midZ + camDist);
        desiredLook.set(midX, 1.18, midZ);
        desiredFov = 38;
      } else if (this.cameraPreset === 'firstPerson') {
        const headPos = this.tmpFpHeadPos.set(
          f0.x,
          1.48 * f0.profile.heightScale,
          f0.z,
        );
        if (this.rigRed) {
          getFighterHeadWorldPosition(this.rigRed, headPos);
        }
        const fwdX = Math.sin(f0.facingYaw);
        const fwdZ = Math.cos(f0.facingYaw);
        desiredPos.set(
          headPos.x + fwdX * 0.14,
          Math.max(0.45, headPos.y + 0.04),
          headPos.z + fwdZ * 0.14,
        );
        desiredLook.set(
          f1.x,
          Math.max(0.55, 1.34 * f1.profile.heightScale),
          f1.z,
        );
        desiredFov = 64;
        desiredNear = 0.08;
      } else if (this.cameraPreset === 'thirdPerson') {
        const fwdX = Math.sin(f0.facingYaw);
        const fwdZ = Math.cos(f0.facingYaw);
        const rightX = -Math.cos(f0.facingYaw);
        const rightZ = Math.sin(f0.facingYaw);
        let camX = f0.x - fwdX * 2.15 + rightX * 0.36;
        let camZ = f0.z - fwdZ * 2.15 + rightZ * 0.36;
        if (this.currentArena === 'octagon') {
          const rMax = OCTAGON_RADIUS - 0.35;
          const r = Math.hypot(camX, camZ);
          if (r > rMax) {
            camX = (camX / r) * rMax;
            camZ = (camZ / r) * rMax;
          }
        } else {
          const halfMax =
            (this.currentArena === 'boxingRing'
              ? BOXING_RING_HALF_SIZE
              : BACKYARD_HALF_SIZE) - 0.25;
          camX = THREE.MathUtils.clamp(camX, -halfMax, halfMax);
          camZ = THREE.MathUtils.clamp(camZ, -halfMax, halfMax);
        }
        desiredPos.set(camX, 1.74, camZ);
        desiredLook.set(
          THREE.MathUtils.lerp(f0.x, f1.x, 0.72),
          1.18,
          THREE.MathUtils.lerp(f0.z, f1.z, 0.72),
        );
        desiredFov = 52;
      } else if (this.cameraPreset === 'topToSide') {
        const camZOff = THREE.MathUtils.clamp(5.0 + dist * 0.58, 5.2, 8.2);
        desiredPos.set(midX + 3.0, 5.4 + dist * 0.28, midZ + camZOff);
        desiredLook.set(midX, 0.75, midZ);
        desiredFov = 44;
      } else {
        // Default broadcast side-angle camera framing both fighters dynamically
        const aspectScale =
          this.camera.aspect < 1.0
            ? Math.min(1.55, 1.05 / Math.max(0.5, this.camera.aspect))
            : 1.0;
        const camDist = THREE.MathUtils.clamp(
          (3.35 + dist * 0.74) * aspectScale,
          3.6,
          8.6,
        );
        desiredPos.set(midX, 1.66 + dist * 0.075, midZ + camDist);
        desiredLook.set(midX, 1.06, midZ);
        desiredFov = 42;
      }
    }

    const presetChanged = this.lastCameraPreset !== this.cameraPreset;
    if (this.lastMode !== mode || presetChanged) {
      this.lastMode = mode;
      this.lastCameraPreset = this.cameraPreset;
      this.camPos.copy(desiredPos);
      this.camLook.copy(desiredLook);
      this.targetFov = desiredFov;
      if (
        Math.abs(this.camera.fov - desiredFov) > 0.01 ||
        Math.abs(this.camera.near - desiredNear) > 0.001
      ) {
        this.camera.fov = desiredFov;
        this.camera.near = desiredNear;
        this.camera.updateProjectionMatrix();
      }
    } else {
      const dampLambda =
        isMenu || isSetup || isSelect
          ? 7.2
          : this.cameraPreset === 'firstPerson'
            ? 18
            : this.cameraPreset === 'thirdPerson'
              ? 12
              : 9.2;
      this.camPos.x = THREE.MathUtils.damp(this.camPos.x, desiredPos.x, dampLambda, dt);
      this.camPos.y = THREE.MathUtils.damp(this.camPos.y, desiredPos.y, dampLambda, dt);
      this.camPos.z = THREE.MathUtils.damp(this.camPos.z, desiredPos.z, dampLambda, dt);

      this.camLook.x = THREE.MathUtils.damp(this.camLook.x, desiredLook.x, dampLambda, dt);
      this.camLook.y = THREE.MathUtils.damp(this.camLook.y, desiredLook.y, dampLambda, dt);
      this.camLook.z = THREE.MathUtils.damp(this.camLook.z, desiredLook.z, dampLambda, dt);

      this.targetFov = desiredFov;
      if (
        Math.abs(this.camera.fov - this.targetFov) > 0.05 ||
        Math.abs(this.camera.near - desiredNear) > 0.005
      ) {
        this.camera.fov = THREE.MathUtils.damp(
          this.camera.fov,
          this.targetFov,
          8,
          dt,
        );
        this.camera.near = desiredNear;
        this.camera.updateProjectionMatrix();
      }
    }

    this.trauma = Math.max(0, this.trauma - 2.4 * dt);
    const shake = this.trauma * this.trauma;
    const shakeScale = this.cameraPreset === 'firstPerson' ? 0.45 : 1.0;

    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * shake * 0.24 * shakeScale,
      this.camPos.y + (Math.random() - 0.5) * shake * 0.18 * shakeScale,
      this.camPos.z,
    );
    this.camera.lookAt(this.camLook);
  }

  public startLoop(onTick: (dt: number, elapsedSec: number) => void) {
    let lastTime = performance.now();
    const startTime = lastTime;

    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      onTick(dt, (now - startTime) / 1000);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    tick();
  }

  private handleResize() {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(320, rect.width || window.innerWidth);
    const h = Math.max(240, rect.height || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.rigRed?.mixamo?.dispose();
    this.rigBlue?.mixamo?.dispose();
    this.sweatPool.dispose();
    this.bloodPool.dispose();
    for (const r of this.disposableResources) {
      r.dispose();
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
