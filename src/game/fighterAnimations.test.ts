import assert from 'node:assert/strict';
import test from 'node:test';
import { createBoutState, createFighterState } from './combatEngine';
import { UFC_ROSTER } from './fighters';
import {
  getBlockPose,
  getIdleGuardPose,
  getKnockdownPose,
  getStrikeKeyframePose,
} from './fighterAnimations';

const p0 = UFC_ROSTER[0];

test('idle guard animation exhibits breathing, guard bounce, and bladed stance rotation', () => {
  const poseA = getIdleGuardPose('orthodox', 0, 0, 0.0);
  const poseB = getIdleGuardPose('orthodox', 0, 0, 0.27);
  // Pelvis bounce changes height cleanly over time
  assert.notEqual(poseA.pelvisY, poseB.pelvisY);
  // Orthodox stance advances left hip forward (+Y rotation) and tucks chin
  assert.ok(poseA.pelvisRot[1] > 0.3);
  assert.ok(poseA.headRot[1] < -0.3);
  // Both elbows remain folded in tight guard
  assert.ok(poseA.elbowL[0] < -1.3);
  assert.ok(poseA.elbowR[0] < -1.5);
});

test('jab animation extends lead shoulder & elbow with hip rotation and torso snap', () => {
  const base = getIdleGuardPose('orthodox', 0, 0, 0);
  const peak = getStrikeKeyframePose('jab', 'orthodox', 0.42, base);
  const end = getStrikeKeyframePose('jab', 'orthodox', 1.0, base);

  // Full extension: elbow opens near straight (-0.07) vs bent guard (-1.56)
  assert.ok(peak.elbowL[0] > -0.35, `Expected extended elbow, got ${peak.elbowL[0]}`);
  // Lead shoulder elevates forward toward horizontal (-1.56)
  assert.ok(peak.shoulderL[0] < -1.35);
  // Hips & chest rotate forward behind lead shoulder (+Y)
  assert.ok(peak.pelvisRot[1] > base.pelvisRot[1]);
  assert.ok(peak.chestRot[1] > base.chestRot[1]);
  // Rear hand remains glued to chin in guard
  assert.ok(peak.elbowR[0] < -1.8);
  // Smoothly recovers back to base guard pose at t=1
  assert.ok(Math.abs(end.elbowL[0] - base.elbowL[0]) < 0.001);
});

test('hook animation winds up in coil phase then snaps hips & torso across horizontal arc', () => {
  const base = getIdleGuardPose('orthodox', 0, 0, 0);
  const coil = getStrikeKeyframePose('leadHook', 'orthodox', 0.25, base);
  const impact = getStrikeKeyframePose('leadHook', 'orthodox', 0.45, base);

  // Coil phase rotates torso opposite the swing (-Y relative to base)
  assert.ok(coil.pelvisRot[1] < base.pelvisRot[1]);
  // Impact phase whips pelvis and chest strongly across (+Y)
  assert.ok(impact.pelvisRot[1] > 0.6);
  assert.ok(impact.chestRot[1] > 0.4);
  // Hook elbow stays bent near 90 deg (-1.48 rad) while shoulder abducts outward
  assert.ok(impact.elbowL[0] < -1.2 && impact.elbowL[0] > -1.8);
  assert.ok(impact.shoulderL[2] < -0.7);
});

test('roundhouse kick turns hips over, bends then whips knee pivot, and swings counter arm', () => {
  const base = getIdleGuardPose('orthodox', 0, 0, 0);
  const chamber = getStrikeKeyframePose('headKick', 'orthodox', 0.22, base);
  const whip = getStrikeKeyframePose('headKick', 'orthodox', 0.44, base);
  const reChamber = getStrikeKeyframePose('headKick', 'orthodox', 0.72, base);

  // Hip turns over toward standing leg (-1.12 rad) with lateral counterbalance lean
  assert.ok(whip.pelvisRot[1] < -0.8);
  assert.ok(Math.abs(whip.pelvisRot[2]) > 0.3);
  // Kicking knee starts folded in chamber, extends straight on whip, then re-chambers
  assert.ok(chamber.kneeR[0] > 0.9);
  assert.ok(whip.kneeR[0] < 0.2);
  assert.ok(reChamber.kneeR[0] > 0.5);
  // Kicking-side arm swings down-back while guard hand stays high
  assert.ok(whip.shoulderR[0] > 0.4);
  assert.ok(whip.elbowL[0] < -1.9);
});

test('block animation shells clavicles, elbows, and chin tightly in high and low guard', () => {
  const base = getIdleGuardPose('orthodox', 0, 0, 0);
  const high = getBlockPose('high', 'orthodox', base, 0.5);
  const low = getBlockPose('low', 'orthodox', base, 0.5);

  assert.ok(high.headRot[0] > 0.1);
  assert.ok(high.elbowL[0] < -2.0);
  assert.ok(high.elbowR[0] < -2.0);
  assert.ok(low.pelvisY < base.pelvisY - 0.05);
  assert.ok(low.hipL[0] < base.hipL[0]);
});

test('knockdown animation progresses through knee buckle, canvas drop, bounce, sit-up, and stand-up', () => {
  const f = createFighterState(0, p0);
  f.action = 'knockdown';
  f.actionDuration = 1.45;
  const base = getIdleGuardPose('orthodox', 0, 0, 0);

  f.actionTime = 0.26; // Buckle
  const buckle = getKnockdownPose(f, base);
  assert.ok(buckle.kneeL[0] > 0.7);

  f.actionTime = 0.64; // Mat impact
  const mat = getKnockdownPose(f, base);
  assert.ok(mat.pelvisY < 0.22);
  assert.ok(mat.pelvisRot[0] < -1.2);

  f.actionTime = 1.19; // Sit-up recovery brace
  const situp = getKnockdownPose(f, base);
  assert.ok(situp.abdomenRot[0] > 0.25);

  f.actionTime = 1.45; // Back in fighting guard
  const recovered = getKnockdownPose(f, base);
  assert.ok(Math.abs(recovered.pelvisY - base.pelvisY) < 0.01);
});

test('bout state initializes cleanly for southpaw stance mirroring', () => {
  const bout = createBoutState(UFC_ROSTER[0], UFC_ROSTER[2]); // Conor is southpaw
  const spPose = getIdleGuardPose(bout.fighters[1].stance, 0, 0, 0);
  // Southpaw mirrors orthodox (-Y pelvis rotation advances right lead side)
  assert.ok(spPose.pelvisRot[1] < -0.3 || spPose.pelvisRot[1] > 0.3);
});

test('low legKick sinks into standing knee and drives horizontal shin chop', () => {
  const base = getIdleGuardPose('orthodox', 0, 0, 0);
  const lowWhip = getStrikeKeyframePose('rearLegKick', 'orthodox', 0.44, base);

  // Standing left knee sinks deeply for power base while pelvis drops
  assert.ok(lowWhip.kneeL[0] > 0.3, `Expected bent standing knee > 0.3, got ${lowWhip.kneeL[0]}`);
  assert.ok(lowWhip.pelvisY < base.pelvisY, 'Low kick should lower center of gravity');
  // Kicking right ankle plantarflexed to strike with shin/instep
  assert.ok(lowWhip.ankleR[0] > 0.4);
});

test('lead switch bodyKick hops into switch step before turning left hip over', () => {
  const base = getIdleGuardPose('orthodox', 0, 0, 0);
  const switchStep = getStrikeKeyframePose('bodyKick', 'orthodox', 0.11, base);
  const whip = getStrikeKeyframePose('bodyKick', 'orthodox', 0.44, base);
  const follow = getStrikeKeyframePose('bodyKick', 'orthodox', 0.58, base);

  // Switch hop lifts pelvis slightly and opens stance toward southpaw pre-load
  assert.ok(switchStep.pelvisY > base.pelvisY, 'Switch step should elevate slightly during hop');
  assert.ok(switchStep.pelvisRot[1] !== base.pelvisRot[1]);
  // Left kicking leg turns hip over (+Y pelvis rotation for left leg) and sweeps through follow-through
  assert.ok(whip.pelvisRot[1] > 0.8);
  assert.ok(follow.hipL[0] <= whip.hipL[0] + 0.05, 'Follow-through should carry thigh through arc');
});

test('All 8 Mixamo FBX rigs load at 0.01 scale, attach unrigged segments to 11 bones, strip walk drift, and drive AnimationMixer', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const THREE = await import('three');
  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
  const {
    MIXAMO_ANIMATION_SOURCES,
    MIXAMO_KEY_BONE_NAMES,
    MIXAMO_SCALE,
    attachSegmentsToMixamoBones,
    createMixamoRigController,
    extractActiveMixamoClip,
  } = await import('./mixamoFbxAnimator');

  const g = globalThis as unknown as {
    document?: unknown;
    URL?: unknown;
  };
  const prevDoc = g.document;
  const prevUrl = g.URL;
  g.document = {
    createElementNS: () => ({
      addEventListener() {},
      removeEventListener() {},
      setAttribute() {},
      style: {},
    }),
  };
  g.URL = { createObjectURL: () => 'blob:mock' };

  try {
    const loader = new FBXLoader();
    const loadLocal = (localUrl: string) => {
      const fileName = path.basename(localUrl);
      const buf = fs.readFileSync(path.resolve(process.cwd(), 'public/assets/animations', fileName));
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return loader.parse(ab, '');
    };

    const fbxMap = {
      jabPunch: loadLocal(MIXAMO_ANIMATION_SOURCES.jabPunch.localUrl),
      hookPunch: loadLocal(MIXAMO_ANIMATION_SOURCES.hookPunch.localUrl),
      walkNeutral: loadLocal(MIXAMO_ANIMATION_SOURCES.walkNeutral.localUrl),
      walkGuard: loadLocal(MIXAMO_ANIMATION_SOURCES.walkGuard.localUrl),
      mmaKick: loadLocal(MIXAMO_ANIMATION_SOURCES.mmaKick.localUrl),
      lowKick: loadLocal(MIXAMO_ANIMATION_SOURCES.lowKick.localUrl),
      receivingUppercut: loadLocal(MIXAMO_ANIMATION_SOURCES.receivingUppercut.localUrl),
      knockedOut: loadLocal(MIXAMO_ANIMATION_SOURCES.knockedOut.localUrl),
    };

    const clips = {
      jabPunch: extractActiveMixamoClip(fbxMap.jabPunch, 'JabPunch', false),
      hookPunch: extractActiveMixamoClip(fbxMap.hookPunch, 'HookPunch', false),
      walkNeutral: extractActiveMixamoClip(fbxMap.walkNeutral, 'NeutralWalking', true),
      walkGuard: extractActiveMixamoClip(fbxMap.walkGuard, 'WalkingGuardUp', true),
      mmaKick: extractActiveMixamoClip(fbxMap.mmaKick, 'MmaHeadKick', false),
      lowKick: extractActiveMixamoClip(fbxMap.lowKick, 'LowKick', false),
      receivingUppercut: extractActiveMixamoClip(
        fbxMap.receivingUppercut,
        'ReceivingUppercut',
        true,
      ),
      knockedOut: extractActiveMixamoClip(fbxMap.knockedOut, 'KnockedOut', false),
    };

    for (const [key, clip] of Object.entries(clips)) {
      assert.ok(clip && clip.tracks.length > 0, `Expected valid clip for ${key}`);
    }

    const controller = createMixamoRigController({
      templateRoot: fbxMap.mmaKick,
      clips,
    });

    // Verify scale = 0.01 and placeholder Mixamo meshes hidden
    assert.ok(Math.abs(controller.skeletonRoot.scale.x - MIXAMO_SCALE) < 1e-6);
    controller.skeletonRoot.traverse((obj) => {
      const mesh = obj as InstanceType<typeof THREE.Mesh>;
      if (mesh.isMesh) {
        assert.equal(mesh.visible, false, `Expected Mixamo placeholder mesh ${obj.name} hidden`);
      }
    });

    // Attach unrigged fighter body segment meshes to all 11 Mixamo bones
    const segMeshes = Object.fromEntries(
      MIXAMO_KEY_BONE_NAMES.map((name) => [
        name,
        new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), new THREE.MeshStandardMaterial()),
      ]),
    );
    const attached = attachSegmentsToMixamoBones(controller.skeletonRoot, segMeshes);
    for (const boneName of MIXAMO_KEY_BONE_NAMES) {
      assert.ok(attached.bones[boneName], `Missing bone ${boneName}`);
      assert.ok(attached.wrappers[boneName], `Missing scale wrapper for ${boneName}`);
      assert.equal(attached.anchors[boneName]?.children[0], segMeshes[boneName]);
      assert.ok(Math.abs((attached.wrappers[boneName]?.scale.x ?? 0) - 100) < 1e-4);
    }

    // Verify Neutral Walking (LoopRepeat) runs in-place without forward root drift
    controller.playWalkNeutral(1);
    assert.equal(controller.actions.walkNeutral?.loop, THREE.LoopRepeat);
    controller.update(0.4);
    controller.skeletonRoot.updateMatrixWorld(true);
    const walkHipsPos = new THREE.Vector3();
    attached.bones.Hips?.getWorldPosition(walkHipsPos);
    assert.ok(Math.abs(walkHipsPos.z) < 0.15, `Expected in-place walk without Z drift, got z=${walkHipsPos.z.toFixed(2)}`);

    // Verify Walking with Guard Up (LoopRepeat)
    controller.playWalkGuard(1);
    assert.equal(controller.actions.walkGuard?.loop, THREE.LoopRepeat);
    controller.update(0.25);

    // Verify Jab Punch & Hook Punch (LoopOnce)
    controller.triggerJabPunch(0.32);
    assert.equal(controller.actions.jabPunch?.loop, THREE.LoopOnce);
    assert.equal(controller.activeMode, 'jabPunch');
    controller.update(0.16);

    controller.triggerHookPunch(0.4);
    assert.equal(controller.actions.hookPunch?.loop, THREE.LoopOnce);
    assert.equal(controller.activeMode, 'hookPunch');
    controller.update(0.2);

    // Verify Low Kick (LoopOnce) from Mma Kick (2).fbx
    controller.triggerLowKick(0.45);
    assert.equal(controller.actions.lowKick?.loop, THREE.LoopOnce);
    assert.equal(controller.activeMode, 'lowKick');
    controller.update(0.18);

    // Verify Receiving An Uppercut (LoopOnce, in-place without Z teleport)
    controller.triggerReceivingUppercut(0.46);
    assert.equal(controller.actions.receivingUppercut?.loop, THREE.LoopOnce);
    assert.equal(controller.activeMode, 'receivingUppercut');
    controller.update(0.22);
    controller.skeletonRoot.updateMatrixWorld(true);
    const uppercutHipsPos = new THREE.Vector3();
    attached.bones.Hips?.getWorldPosition(uppercutHipsPos);
    assert.ok(
      Math.abs(uppercutHipsPos.z) < 0.15,
      `Expected in-place uppercut reaction without Z teleport, got z=${uppercutHipsPos.z.toFixed(2)}`,
    );

    // Trigger Mma Kick (LoopOnce) and verify RightLeg segment moves upward visibly
    controller.triggerMmaKick(0.6);
    assert.equal(controller.kickAction?.loop, THREE.LoopOnce);
    assert.equal(controller.activeMode, 'mmaKick');

    controller.skeletonRoot.updateMatrixWorld(true);
    const startFootPos = new THREE.Vector3();
    segMeshes.RightLeg.getWorldPosition(startFootPos);

    controller.update(0.24);
    controller.skeletonRoot.updateMatrixWorld(true);
    const midFootPos = new THREE.Vector3();
    segMeshes.RightLeg.getWorldPosition(midFootPos);
    assert.ok(
      midFootPos.y > startFootPos.y + 0.15,
      `Expected RightLeg mesh to lift during Mma Kick (${startFootPos.y.toFixed(2)} -> ${midFootPos.y.toFixed(2)})`,
    );

    // Trigger Knocked Out (LoopOnce, clampWhenFinished) and verify Head collapses toward canvas
    controller.triggerKnockedOut();
    assert.equal(controller.koAction?.loop, THREE.LoopOnce);
    assert.equal(controller.koAction?.clampWhenFinished, true);
    assert.equal(controller.activeMode, 'knockedOut');

    for (let i = 0; i < 40; i++) {
      controller.update(0.05);
    }
    controller.skeletonRoot.updateMatrixWorld(true);
    const koHeadPos = new THREE.Vector3();
    segMeshes.Head.getWorldPosition(koHeadPos);
    assert.ok(
      koHeadPos.y < 0.35,
      `Expected Head segment to collapse to mat during Knocked Out, got y=${koHeadPos.y.toFixed(2)}`,
    );
    // Verify floor grounding: no key bone or foot tip sinks beneath cage floor (y < 0) across all 8 Mixamo clips
    const floorCheckNames = [
      'LeftFoot',
      'RightFoot',
      'LeftToeBase',
      'RightToeBase',
      'Hips',
      'Head',
    ] as const;
    const floorBones: Array<{ name: string; obj: InstanceType<typeof THREE.Object3D> }> = [];
    controller.skeletonRoot.traverse((o) => {
      for (const n of floorCheckNames) {
        if (o.name === `mixamorig${n}` || o.name === n) {
          floorBones.push({ name: n, obj: o });
        }
      }
    });
    const probeVec = new THREE.Vector3();
    const assertClipGrounded = (clipLabel: string, triggerFn: () => void, steps: number, dt: number) => {
      triggerFn();
      let minBoneY = 999;
      for (let i = 0; i < steps; i++) {
        controller.update(dt);
        controller.skeletonRoot.updateMatrixWorld(true);
        for (const fb of floorBones) {
          fb.obj.getWorldPosition(probeVec);
          if (probeVec.y < minBoneY) minBoneY = probeVec.y;
        }
      }
      assert.ok(
        minBoneY >= 0,
        `Expected ${clipLabel} bones to stay above cage floor (y >= 0), got minBoneY=${minBoneY.toFixed(3)}`,
      );
    };
    assertClipGrounded('walkGuard', () => controller.playWalkGuard(1), 25, 0.03);
    assertClipGrounded('walkNeutral', () => controller.playWalkNeutral(1), 25, 0.03);
    assertClipGrounded('jabPunch', () => controller.triggerJabPunch(0.32), 20, 0.02);
    assertClipGrounded('hookPunch', () => controller.triggerHookPunch(0.42), 25, 0.02);
    assertClipGrounded('mmaKick', () => controller.triggerMmaKick(0.6), 30, 0.02);
    assertClipGrounded('lowKick', () => controller.triggerLowKick(0.45), 30, 0.02);
    assertClipGrounded(
      'receivingUppercut',
      () => controller.triggerReceivingUppercut(0.46),
      30,
      0.02,
    );
    assertClipGrounded('knockedOut', () => controller.triggerKnockedOut(), 35, 0.05);

    controller.dispose();
  } finally {
    g.document = prevDoc;
    g.URL = prevUrl;
  }
});

test('ConorMcgregr.fbx loads as a Mixamo SkinnedMesh with normalized weights and plays all 8 Mixamo animations with UFC corner shorts', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const THREE = await import('three');
  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
  const {
    CONOR_MODEL_SOURCE,
    MIXAMO_ANIMATION_SOURCES,
    buildConorModelTemplateFromFbx,
    createConorMixamoController,
    extractActiveMixamoClip,
  } = await import('./mixamoFbxAnimator');

  const g = globalThis as unknown as {
    document?: unknown;
    URL?: unknown;
  };
  const prevDoc = g.document;
  const prevUrl = g.URL;
  g.document = {
    createElementNS: () => ({
      addEventListener() {},
      removeEventListener() {},
      setAttribute() {},
      style: {},
    }),
  };
  g.URL = { createObjectURL: () => 'blob:mock' };

  try {
    const loader = new FBXLoader();
    const parseFbx = (absPath: string) => {
      const buf = fs.readFileSync(absPath);
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return loader.parse(ab, '');
    };

    const conorPath = path.resolve(
      process.cwd(),
      'public',
      CONOR_MODEL_SOURCE.localUrl.replace(/^\//, ''),
    );
    const conorFbx = parseFbx(conorPath);
    const template = buildConorModelTemplateFromFbx(conorFbx);
    assert.ok(template, 'Expected valid ConorModelTemplate');

    const loadAnim = (localUrl: string) =>
      parseFbx(path.resolve(process.cwd(), 'public/assets/animations', path.basename(localUrl)));

    const jabFbx = loadAnim(MIXAMO_ANIMATION_SOURCES.jabPunch.localUrl);
    const clips = {
      jabPunch: extractActiveMixamoClip(jabFbx, 'JabPunch', false),
      hookPunch: extractActiveMixamoClip(
        loadAnim(MIXAMO_ANIMATION_SOURCES.hookPunch.localUrl),
        'HookPunch',
        false,
      ),
      walkNeutral: extractActiveMixamoClip(
        loadAnim(MIXAMO_ANIMATION_SOURCES.walkNeutral.localUrl),
        'NeutralWalking',
        true,
      ),
      walkGuard: extractActiveMixamoClip(
        loadAnim(MIXAMO_ANIMATION_SOURCES.walkGuard.localUrl),
        'WalkingGuardUp',
        true,
      ),
      mmaKick: extractActiveMixamoClip(
        loadAnim(MIXAMO_ANIMATION_SOURCES.mmaKick.localUrl),
        'MmaHeadKick',
        false,
      ),
      lowKick: extractActiveMixamoClip(
        loadAnim(MIXAMO_ANIMATION_SOURCES.lowKick.localUrl),
        'LowKick',
        false,
      ),
      receivingUppercut: extractActiveMixamoClip(
        loadAnim(MIXAMO_ANIMATION_SOURCES.receivingUppercut.localUrl),
        'ReceivingUppercut',
        true,
      ),
      knockedOut: extractActiveMixamoClip(
        loadAnim(MIXAMO_ANIMATION_SOURCES.knockedOut.localUrl),
        'KnockedOut',
        false,
      ),
    };

    const cornerShortsMat = new THREE.MeshStandardMaterial({ color: 0xcc161f });
    const controller = createConorMixamoController(
      { templateRoot: jabFbx, clips },
      template,
      cornerShortsMat,
    );

    const { skinnedMesh, shortsSkinnedMesh, displayRoot } = controller;
    assert.equal(skinnedMesh.isSkinnedMesh, true);
    assert.equal(skinnedMesh.castShadow, true);
    assert.equal(skinnedMesh.frustumCulled, false);
    assert.equal(controller.flashMaterials.length >= 1, true);
    assert.ok(shortsSkinnedMesh && shortsSkinnedMesh.isSkinnedMesh, 'Expected skinned UFC corner shorts on Conor');
    assert.ok(
      shortsSkinnedMesh.geometry.attributes.position.count > 1000,
      'Expected populated UFC corner shorts vertex buffer on Conor',
    );

    const wAttr = skinnedMesh.geometry.attributes.skinWeight as InstanceType<
      typeof THREE.BufferAttribute
    >;
    assert.equal(wAttr.count, 150000);
    for (let i = 0; i < wAttr.count; i += 250) {
      const sum =
        wAttr.getX(i) + wAttr.getY(i) + wAttr.getZ(i) + wAttr.getW(i);
      assert.ok(Number.isFinite(sum) && Math.abs(sum - 1) < 1e-3);
    }

    // Exercise all 8 Mixamo animations on Conor's skinned rig and confirm floor grounding
    controller.playWalkGuard(1);
    controller.update(0.25);
    assert.equal(controller.activeMode, 'walkGuard');

    controller.playWalkNeutral(1);
    controller.update(0.25);
    assert.equal(controller.activeMode, 'walkNeutral');

    controller.triggerJabPunch(0.32);
    controller.update(0.18);
    assert.equal(controller.activeMode, 'jabPunch');

    controller.triggerHookPunch(0.42);
    controller.update(0.22);
    assert.equal(controller.activeMode, 'hookPunch');

    controller.triggerLowKick(0.46);
    controller.update(0.2);
    assert.equal(controller.activeMode, 'lowKick');
    const conorHipsWorld = new THREE.Vector3();
    controller.hipsBone?.getWorldPosition(conorHipsWorld);
    assert.ok(
      conorHipsWorld.y > 0.8,
      `Expected Conor lowKick hips to stay grounded near standing height (>0.8m), got ${conorHipsWorld.y.toFixed(2)}`,
    );

    controller.triggerReceivingUppercut(0.46);
    controller.update(0.2);
    assert.equal(controller.activeMode, 'receivingUppercut');
    controller.hipsBone?.getWorldPosition(conorHipsWorld);
    assert.ok(
      conorHipsWorld.y > 0.72,
      `Expected Conor receivingUppercut hips to stay above mat (>0.72m), got ${conorHipsWorld.y.toFixed(2)}`,
    );

    controller.triggerMmaKick(0.6);
    controller.update(0.26);
    assert.equal(controller.activeMode, 'mmaKick');
    displayRoot.updateMatrixWorld(true);
    skinnedMesh.skeleton.update();

    const posAttr = skinnedMesh.geometry.attributes.position as InstanceType<
      typeof THREE.BufferAttribute
    >;
    const vKick = new THREE.Vector3();
    let maxKickFootY = 0;
    for (let i = 0; i < posAttr.count; i += 3) {
      vKick.fromBufferAttribute(posAttr, i);
      if (vKick.x < -0.1 && vKick.y < 0.25) {
        skinnedMesh.applyBoneTransform(i, vKick);
        if (vKick.y > maxKickFootY) maxKickFootY = vKick.y;
      }
    }
    assert.ok(
      maxKickFootY > 0.75,
      `Expected Conor skinned right foot vertices to kick high (>0.75m), got ${maxKickFootY.toFixed(2)}`,
    );

    controller.triggerKnockedOut();
    for (let i = 0; i < 40; i++) controller.update(0.05);
    assert.equal(controller.activeMode, 'knockedOut');
    displayRoot.updateMatrixWorld(true);
    skinnedMesh.skeleton.update();

    const koHeadWorld = new THREE.Vector3();
    controller.headBone?.getWorldPosition(koHeadWorld);
    assert.ok(
      koHeadWorld.y < 0.4,
      `Expected Conor Head bone to drop to mat during Knocked Out, got y=${koHeadWorld.y.toFixed(2)}`,
    );

    controller.dispose();
  } finally {
    g.document = prevDoc;
    g.URL = prevUrl;
  }
});




