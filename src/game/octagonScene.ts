import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BoutState, OCTAGON_RADIUS } from './combatEngine';
import {
  applyFighterPose,
  applyMainMenuHeroPose,
  applySelectShowcasePose,
  buildFighterRig,
  JointMap,
  SweatParticlePool,
} from './mocapRig';

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

  // Light neutral Octagon canvas grey matching reference screenshot
  ctx.fillStyle = '#d3d5da';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle woven canvas noise
  for (let i = 0; i < 6500; i++) {
    const x = (i * 197) % 1024;
    const y = (i * 313) % 1024;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Octagon inner border ring
  ctx.strokeStyle = 'rgba(25, 28, 35, 0.45)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const r = 465;
    const px = 512 + Math.cos(a) * r;
    const py = 512 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  // Center watermark decal
  ctx.save();
  ctx.translate(512, 512);
  ctx.fillStyle = 'rgba(22, 24, 30, 0.14)';
  ctx.font = 'italic 800 92px "Barlow Condensed", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('UFC', 0, -16);
  ctx.font = '700 30px "Barlow Condensed", sans-serif';
  ctx.fillText('STAND & BANG', 0, 44);
  ctx.restore();

  // Sponsor edge markings
  const sponsors = ['FIGHT PASS', 'OCTAGON', 'VENUM', 'CHAMPIONSHIP'];
  ctx.fillStyle = 'rgba(22, 24, 30, 0.22)';
  ctx.font = '700 28px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(512, 512);
    ctx.rotate((i * Math.PI) / 2);
    ctx.fillText(sponsors[i], 0, -340);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
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
  tex.repeat.set(16, 4.5);
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

export class OctagonSceneManager {
  public readonly isSoftwareGl: boolean;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly sweatPool: SweatParticlePool;

  private container: HTMLElement;
  private rigRed: JointMap | null = null;
  private rigBlue: JointMap | null = null;
  private hemiLight: THREE.HemisphereLight;
  private keySpot: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private coolFill: THREE.DirectionalLight;
  private referee: THREE.Group;
  private cameraman: THREE.Group;
  private arenaCrowd: THREE.InstancedMesh;
  private flashMeshes: THREE.Mesh[] = [];
  private showcaseGroup: THREE.Group;
  private showcaseRedLight: THREE.PointLight;
  private showcaseBlueLight: THREE.PointLight;
  private menuStageGroup: THREE.Group;
  private menuKeyLight: THREE.PointLight;
  private menuFireRimLight: THREE.PointLight;
  private rockedLight: THREE.PointLight;
  private rockedLightTimer = 0;

  private camPos = new THREE.Vector3(0.03, 1.48, 1.24);
  private camLook = new THREE.Vector3(0.2, 1.43, 0.2);
  private lastMode = '';
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
    this.keySpot.shadow.camera.far = 26;
    const d = 6.5;
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

    // Build Octagon & Arena
    this.buildOctagon();
    this.referee = buildOfficialFigure(false);
    this.referee.position.set(0.3, 0, -2.55);
    this.scene.add(this.referee);

    this.cameraman = buildOfficialFigure(true);
    this.cameraman.position.set(3.4, 0, -4.6);
    this.cameraman.rotation.y = -0.62;
    this.scene.add(this.cameraman);

    this.arenaCrowd = this.buildArenaBowl();
    this.buildOverheadLights();

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

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  private buildOctagon() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const matTex = createCanvasMatTexture(maxAniso);
    this.disposableResources.push(matTex);

    // Octagon canvas platform
    const matGeo = new THREE.CylinderGeometry(
      OCTAGON_RADIUS,
      OCTAGON_RADIUS + 0.15,
      0.55,
      8,
    );
    const matMaterial = new THREE.MeshStandardMaterial({
      map: matTex,
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.02,
    });
    const platform = new THREE.Mesh(matGeo, matMaterial);
    platform.position.y = -0.275;
    platform.rotation.y = Math.PI / 8;
    platform.receiveShadow = true;
    this.scene.add(platform);
    this.disposableResources.push(matGeo, matMaterial);

    // Outer apron floor
    const apronGeo = new THREE.CylinderGeometry(9.5, 9.5, 0.25, 16);
    const apronMat = new THREE.MeshStandardMaterial({
      color: 0x0a0b0e,
      roughness: 0.92,
      metalness: 0.04,
    });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.position.y = -0.68;
    this.scene.add(apron);
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
      this.scene.add(post);

      const next = corners[(i + 1) % 8];
      const mid = c.clone().add(next).multiplyScalar(0.5);
      const segLen = c.distanceTo(next);
      const segAngle = Math.atan2(next.z - c.z, next.x - c.x);

      const isFrontCameraPanel = mid.z > 3.5;

      const topRail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, segLen, 10),
        railMat,
      );
      topRail.rotation.z = Math.PI / 2;
      topRail.rotation.y = -segAngle;
      topRail.position.set(mid.x, isFrontCameraPanel ? 0.06 : 1.78, mid.z);
      this.scene.add(topRail);

      if (!isFrontCameraPanel) {
        const panelGeo = new THREE.PlaneGeometry(segLen, 1.7);
        const panel = new THREE.Mesh(panelGeo, fenceMat);
        panel.position.set(mid.x, 0.9, mid.z);
        panel.rotation.y = -segAngle;
        this.scene.add(panel);
        this.disposableResources.push(panelGeo);
      }
    }
  }

  private buildArenaBowl(): THREE.InstancedMesh {
    // Deep dark arena surround
    const ringGeo = new THREE.CylinderGeometry(30, 12, 13, 24, 1, true);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x070609,
      roughness: 0.95,
      side: THREE.BackSide,
    });
    const bowl = new THREE.Mesh(ringGeo, ringMat);
    bowl.position.y = 4.6;
    this.scene.add(bowl);
    this.disposableResources.push(ringGeo, ringMat);

    // Stepped dark bleacher risers
    const tierMat = new THREE.MeshStandardMaterial({
      color: 0x0b0a0e,
      roughness: 0.95,
    });
    this.disposableResources.push(tierMat);
    for (let t = 0; t < 4; t++) {
      const rIn = 10.0 + t * 2.8;
      const riserGeo = new THREE.CylinderGeometry(rIn + 2.6, rIn, 0.9, 24, 1, true);
      const riser = new THREE.Mesh(riserGeo, tierMat);
      riser.position.y = 0.2 + t * 1.1;
      this.scene.add(riser);
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
      const radius = 10.6 + tier * 2.8 + (Math.random() - 0.5) * 0.45;
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
    this.scene.add(inst);
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
      m.position.set(Math.cos(a) * 16, 4.5 + (i % 3) * 1.2, Math.sin(a) * 16);
      this.scene.add(m);
      this.flashMeshes.push(m);
      this.disposableResources.push(fMat);
    }
    this.disposableResources.push(flashGeo);

    return inst;
  }

  private buildOverheadLights() {
    const beamGeo = new THREE.ConeGeometry(4.6, 12, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd299,
      transparent: true,
      opacity: 0.022,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.disposableResources.push(beamGeo, beamMat);

    const spots = [
      [-3.5, 9.5, -2.5],
      [3.5, 9.5, -2.5],
      [0, 10.2, 0.5],
    ];
    for (const [x, y, z] of spots) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(x, y - 5.2, z);
      this.scene.add(beam);

      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.25, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xfff0d4 }),
      );
      fixture.position.set(x, y + 0.8, z);
      this.scene.add(fixture);
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

  public syncFighters(bout: BoutState) {
    if (this.rigRed) {
      this.scene.remove(this.rigRed.root);
    }
    if (this.rigBlue) {
      this.scene.remove(this.rigBlue.root);
    }
    this.rigRed = buildFighterRig(bout.fighters[0].profile, 'red');
    this.rigBlue = buildFighterRig(bout.fighters[1].profile, 'blue');
    this.scene.add(this.rigRed.root, this.rigBlue.root);
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
    mode: 'menu' | 'select' | 'playing' | 'paused' | 'gameover',
    timeSec: number,
    dt: number,
  ) {
    const isMenu = mode === 'menu';
    const isSelect = mode === 'select';

    // Modulate studio vs broadcast arena lighting cleanly per screen
    this.hemiLight.intensity = isMenu ? 0.11 : isSelect ? 0.24 : 0.36;
    this.keySpot.intensity = isMenu ? 0.52 : isSelect ? 1.85 : 3.15;
    this.rimLight.intensity = isMenu ? 0.28 : isSelect ? 1.15 : 1.85;
    this.coolFill.intensity = isMenu ? 0.06 : isSelect ? 0.4 : 0.55;
    this.scene.environmentIntensity = isMenu ? 0.24 : isSelect ? 0.65 : 0.92;

    this.menuStageGroup.visible = isMenu;
    this.menuKeyLight.intensity = isMenu ? 9.5 : 0;
    this.menuFireRimLight.intensity = isMenu ? 15.5 : 0;

    this.showcaseGroup.visible = isSelect;
    this.showcaseRedLight.intensity = isSelect ? 14 : 0;
    this.showcaseBlueLight.intensity = isSelect ? 14 : 0;

    this.referee.visible = !isMenu && !isSelect;
    this.cameraman.visible = !isMenu && !isSelect;

    if (this.rigRed && this.rigBlue) {
      this.rigBlue.root.visible = !isMenu;
      if (isMenu) {
        applyMainMenuHeroPose(this.rigRed, timeSec, dt);
      } else if (isSelect) {
        applySelectShowcasePose(this.rigRed, 'red', timeSec, dt);
        applySelectShowcasePose(this.rigBlue, 'blue', timeSec, dt);
      } else {
        const koWin = bout.koWinnerIndex;
        applyFighterPose(this.rigRed, bout.fighters[0], timeSec, dt, koWin === 0);
        applyFighterPose(this.rigBlue, bout.fighters[1], timeSec, dt, koWin === 1);
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

    // Referee tracks midpoint
    const f0 = bout.fighters[0];
    const f1 = bout.fighters[1];
    const midX = (f0.x + f1.x) * 0.5;
    const midZ = (f0.z + f1.z) * 0.5;
    const dist = Math.hypot(f1.x - f0.x, f1.z - f0.z);

    if (!isMenu && !isSelect) {
      const refTargetX = midX * 0.55;
      const refTargetZ = Math.max(-4.3, midZ - 2.35);
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

    // Camera choreography
    const desiredPos = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();

    if (isMenu) {
      // Heroic close-up bust framing on right side matching image_c94e6796.png with clean headroom
      const isPortrait = this.camera.aspect < 0.85;
      desiredPos.set(
        0.03 + Math.sin(timeSec * 0.4) * 0.025,
        1.48 + Math.cos(timeSec * 0.35) * 0.012,
        isPortrait ? 1.56 : 1.24,
      );
      desiredLook.set(isPortrait ? 0.06 : 0.2, 1.43, 0.2);
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
      // Broadcast side-angle camera framing both fighters dynamically (supports wide opening distance)
      const aspectScale = this.camera.aspect < 1.0 ? Math.min(1.55, 1.05 / Math.max(0.5, this.camera.aspect)) : 1.0;
      const camDist = THREE.MathUtils.clamp((3.35 + dist * 0.74) * aspectScale, 3.6, 8.6);
      desiredPos.set(midX, 1.66 + dist * 0.075, midZ + camDist);
      desiredLook.set(midX, 1.06, midZ);
    }

    if (this.lastMode !== mode) {
      this.lastMode = mode;
      this.camPos.copy(desiredPos);
      this.camLook.copy(desiredLook);
    } else {
      const dampLambda = isMenu || isSelect ? 6.5 : 7.5;
      this.camPos.x = THREE.MathUtils.damp(this.camPos.x, desiredPos.x, dampLambda, dt);
      this.camPos.y = THREE.MathUtils.damp(this.camPos.y, desiredPos.y, dampLambda, dt);
      this.camPos.z = THREE.MathUtils.damp(this.camPos.z, desiredPos.z, dampLambda, dt);

      this.camLook.x = THREE.MathUtils.damp(this.camLook.x, desiredLook.x, dampLambda, dt);
      this.camLook.y = THREE.MathUtils.damp(this.camLook.y, desiredLook.y, dampLambda, dt);
      this.camLook.z = THREE.MathUtils.damp(this.camLook.z, desiredLook.z, dampLambda, dt);
    }

    this.trauma = Math.max(0, this.trauma - 2.4 * dt);
    const shake = this.trauma * this.trauma;

    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * shake * 0.24,
      this.camPos.y + (Math.random() - 0.5) * shake * 0.18,
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
    this.sweatPool.dispose();
    for (const r of this.disposableResources) {
      r.dispose();
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
