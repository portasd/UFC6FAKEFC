import { EvadeType, FighterInput, GuardMode } from './combatEngine';
import {
  ControlSettings,
  DEFAULT_CONTROL_SETTINGS,
  matchesKeyBinding,
} from './controlSettings';
import { StrikeId } from './strikes';

export interface ControllerStatus {
  connected: boolean;
  name: string;
}

export class InputHub {
  private keysHeld = new Set<string>();
  private bufferedStrike: StrikeId | null = null;
  private strikeBufferTimer = 0;
  private bufferedEvade: EvadeType | null = null;
  private evadeBufferTimer = 0;
  private bufferedLunge: { x: number; z: number } | null = null;
  private bufferedScreenLunge: { x: number; y: number } | null = null;
  private bufferedFeint = false;

  private lastTapTime: Record<string, number> = {};
  private prevStickMag = 0;
  private prevGamepadButtons: boolean[] = [];
  private prevRightStickDir: 'none' | EvadeType = 'none';
  private onPauseCallback: (() => void) | null = null;

  private touchScreenX = 0;
  private touchScreenY = 0;
  private touchGuard: GuardMode = 'none';
  private touchHeldEvade: EvadeType | null = null;
  private settings: ControlSettings = DEFAULT_CONTROL_SETTINGS;

  public controllerStatus: ControllerStatus = {
    connected: false,
    name: '',
  };

  constructor(onPause?: () => void, initialSettings?: ControlSettings) {
    this.onPauseCallback = onPause ?? null;
    if (initialSettings) this.settings = initialSettings;
  }

  public setPauseCallback(cb: () => void) {
    this.onPauseCallback = cb;
  }

  public setSettings(settings: ControlSettings) {
    this.settings = settings;
  }

  private isBoundHeld(boundCode: string): boolean {
    for (const held of this.keysHeld) {
      if (matchesKeyBinding(boundCode, held)) return true;
    }
    return false;
  }

  public bindListeners(): () => void {
    const onKeyDown = (e: KeyboardEvent) => {
      const kb = this.settings.keyboard;
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          e.code,
        ) ||
        matchesKeyBinding(kb.block, e.code) ||
        ((e.ctrlKey || e.metaKey) &&
          [kb.leadPunch, kb.rearPunch, kb.leadKick, kb.rearKick].some((c) =>
            matchesKeyBinding(c, e.code),
          ))
      ) {
        e.preventDefault();
      }
      if (!e.repeat) {
        this.handleKeyEdge(e.code, e);
      }
      this.keysHeld.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keysHeld.delete(e.code);
    };

    const onBlur = () => {
      this.clear();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        this.clear();
      }
    };

    const onGamepadConnected = (e: GamepadEvent) => {
      this.controllerStatus = {
        connected: true,
        name: e.gamepad.id.split('(')[0].trim() || 'Controller',
      };
    };

    const onGamepadDisconnected = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const active = Array.from(pads).find((p) => p && p.connected);
      this.controllerStatus = active
        ? { connected: true, name: active.id.split('(')[0].trim() || 'Controller' }
        : { connected: false, name: '' };
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('gamepadconnected', onGamepadConnected);
    window.addEventListener('gamepaddisconnected', onGamepadDisconnected);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('gamepadconnected', onGamepadConnected);
      window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
    };
  }

  public clear() {
    this.keysHeld.clear();
    this.bufferedStrike = null;
    this.strikeBufferTimer = 0;
    this.bufferedEvade = null;
    this.evadeBufferTimer = 0;
    this.bufferedLunge = null;
    this.bufferedScreenLunge = null;
    this.bufferedFeint = false;
    this.lastTapTime = {};
    this.prevStickMag = 0;
    this.prevRightStickDir = 'none';
    this.touchScreenX = 0;
    this.touchScreenY = 0;
    this.touchGuard = 'none';
    this.touchHeldEvade = null;
  }

  public setTouchStick(screenX: number, screenY: number) {
    this.touchScreenX = Math.max(-1, Math.min(1, screenX));
    this.touchScreenY = Math.max(-1, Math.min(1, screenY));
  }

  public triggerTouchLunge(screenX: number, screenY: number) {
    this.bufferedScreenLunge = { x: screenX, y: screenY };
  }

  public setTouchGuard(guard: GuardMode) {
    this.touchGuard = guard;
  }

  public triggerTouchFeint() {
    this.bufferedFeint = true;
  }

  public triggerTouchStrike(
    limb: 'leadPunch' | 'rearPunch' | 'leadKick' | 'rearKick',
    hookRoundMod = false,
    bodyMod = false,
    specialMod = false,
  ) {
    this.bufferStrike(
      this.resolveStrikeFromModifiers(limb, hookRoundMod, bodyMod, specialMod),
    );
  }

  public triggerTouchEvade(evade: EvadeType, hold = false) {
    this.bufferEvade(evade);
    this.touchHeldEvade = hold ? evade : null;
  }

  public setTouchHeldEvade(evade: EvadeType | null) {
    this.touchHeldEvade = evade;
  }

  private bufferStrike(id: StrikeId) {
    this.bufferedStrike = id;
    this.strikeBufferTimer = 0.18;
  }

  private bufferEvade(evade: EvadeType) {
    this.bufferedEvade = evade;
    this.evadeBufferTimer = 0.16;
  }

  private resolveStrikeFromModifiers(
    limb: 'leadPunch' | 'rearPunch' | 'leadKick' | 'rearKick',
    hookRoundMod: boolean,
    bodyMod: boolean,
    specialMod: boolean,
  ): StrikeId {
    const isSpecial = specialMod || (hookRoundMod && bodyMod);
    if (isSpecial) {
      if (limb === 'leadPunch') return 'leadUppercut';
      if (limb === 'rearPunch') return 'overhand';
      if (limb === 'leadKick') return 'rearUppercut';
      return 'spinningBackfist';
    }
    if (bodyMod) {
      if (limb === 'leadPunch') return 'bodyHook';
      if (limb === 'rearPunch') return 'rearBodyHook';
      if (limb === 'leadKick') return 'bodyKick';
      return 'rearBodyKick';
    }
    if (hookRoundMod) {
      if (limb === 'leadPunch') return 'leadHook';
      if (limb === 'rearPunch') return 'rearHook';
      if (limb === 'leadKick') return 'leadHeadKick';
      return 'headKick';
    }
    if (limb === 'leadPunch') return 'jab';
    if (limb === 'rearPunch') return 'cross';
    if (limb === 'leadKick') return 'legKick';
    return 'rearLegKick';
  }

  private handleKeyEdge(code: string, e?: KeyboardEvent) {
    const kb = this.settings.keyboard;
    const hookMod =
      this.isBoundHeld(kb.hookMod) ||
      (kb.hookMod === 'ShiftLeft' && Boolean(e?.shiftKey));
    const bodyMod =
      this.isBoundHeld(kb.bodyMod) ||
      (kb.bodyMod === 'ControlLeft' && Boolean(e?.ctrlKey));

    // Quick double-tap directional lunges (within 250ms)
    if (
      matchesKeyBinding(kb.circleUp, code) ||
      matchesKeyBinding(kb.moveBack, code) ||
      matchesKeyBinding(kb.circleDown, code) ||
      matchesKeyBinding(kb.moveForward, code)
    ) {
      const now = performance.now();
      const prev = this.lastTapTime[code] ?? 0;
      if (now - prev < 250) {
        if (matchesKeyBinding(kb.moveForward, code)) {
          this.bufferedLunge = { x: 0, z: 1 };
        } else if (matchesKeyBinding(kb.moveBack, code)) {
          this.bufferedLunge = { x: 0, z: -1 };
        } else if (matchesKeyBinding(kb.circleUp, code)) {
          this.bufferedScreenLunge = { x: 0, y: -1 };
        } else if (matchesKeyBinding(kb.circleDown, code)) {
          this.bufferedScreenLunge = { x: 0, y: 1 };
        }
        this.lastTapTime[code] = 0;
      } else {
        this.lastTapTime[code] = now;
      }
      return;
    }

    const specialMod = hookMod && bodyMod;
    if (matchesKeyBinding(kb.leadPunch, code)) {
      this.bufferStrike(
        this.resolveStrikeFromModifiers('leadPunch', hookMod, bodyMod, specialMod),
      );
    } else if (matchesKeyBinding(kb.rearPunch, code)) {
      this.bufferStrike(
        this.resolveStrikeFromModifiers('rearPunch', hookMod, bodyMod, specialMod),
      );
    } else if (matchesKeyBinding(kb.leadKick, code)) {
      this.bufferStrike(
        this.resolveStrikeFromModifiers('leadKick', hookMod, bodyMod, specialMod),
      );
    } else if (matchesKeyBinding(kb.rearKick, code)) {
      this.bufferStrike(
        this.resolveStrikeFromModifiers('rearKick', hookMod, bodyMod, specialMod),
      );
    } else if (matchesKeyBinding(kb.evadeUp, code)) {
      this.bufferEvade('slipLeft');
    } else if (matchesKeyBinding(kb.evadeRight, code)) {
      this.bufferEvade('slipRight');
    } else if (matchesKeyBinding(kb.evadeDown, code)) {
      this.bufferEvade('duck');
    } else if (matchesKeyBinding(kb.evadeLeft, code)) {
      this.bufferEvade('pullBack');
    } else if (matchesKeyBinding(kb.block, code)) {
      // Tap Block mid-windup = Strike Feint / Cancel
      this.bufferedFeint = true;
    } else if (code === 'Escape' || matchesKeyBinding(kb.pause, code)) {
      this.onPauseCallback?.();
    }
  }

  public pollGamepad(
    playerFacingYaw = Math.PI / 2,
    isPerspectiveFollowCam = false,
  ): {
    moveX: number;
    moveZ: number;
    guard: GuardMode;
    heldEvade: EvadeType | null;
  } {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = Array.from(pads).find((p) => p && p.connected);
    if (!pad) {
      if (this.controllerStatus.connected) {
        this.controllerStatus = { connected: false, name: '' };
      }
      return { moveX: 0, moveZ: 0, guard: 'none', heldEvade: null };
    }

    if (!this.controllerStatus.connected) {
      this.controllerStatus = {
        connected: true,
        name: pad.id.split('(')[0].trim() || 'Controller',
      };
    }

    const gpCfg = this.settings.gamepad;
    const dz = gpCfg.deadzone;
    const deadzone = (v: number) => (Math.abs(v) < dz ? 0 : v);
    const lx = deadzone(pad.axes[0] ?? 0);
    const rawLy = deadzone(pad.axes[1] ?? 0);
    const ly = gpCfg.invertY ? -rawLy : rawLy;
    const rx = deadzone(pad.axes[2] ?? 0);
    const ry = deadzone(pad.axes[3] ?? 0);

    // D-pad fallback
    const dUp = pad.buttons[12]?.pressed ? 1 : 0;
    const dDown = pad.buttons[13]?.pressed ? 1 : 0;
    const dLeft = pad.buttons[14]?.pressed ? 1 : 0;
    const dRight = pad.buttons[15]?.pressed ? 1 : 0;

    // Detect Left Stick rapid flicks for directional lunges (screen-space projected)
    const stickMag = Math.hypot(lx, ly);
    if (stickMag > 0.78 && this.prevStickMag < 0.25) {
      this.bufferedScreenLunge = { x: lx, y: ly };
    }
    this.prevStickMag = stickMag;

    // Right Analog Stick flicks & holds (Slips, Ducks, Pulls)
    let rDir: 'none' | EvadeType = 'none';
    if (Math.abs(rx) >= Math.abs(ry)) {
      if (rx < -0.5) rDir = 'pullBack';
      else if (rx > 0.5) rDir = 'slipRight';
    } else {
      if (ry < -0.5) rDir = 'slipLeft';
      else if (ry > 0.5) rDir = 'duck';
    }

    if (rDir !== 'none' && rDir !== this.prevRightStickDir) {
      this.bufferEvade(rDir);
    }
    this.prevRightStickDir = rDir;

    // EA Sports UFC Bumper/Trigger mapping (optionally swapped):
    const rawLb = Boolean(pad.buttons[4]?.pressed);
    const rawRb = Boolean(pad.buttons[5]?.pressed);
    const rawLt =
      (pad.buttons[6]?.value ?? 0) > 0.35 || Boolean(pad.buttons[6]?.pressed);
    const rawRt =
      (pad.buttons[7]?.value ?? 0) > 0.35 || Boolean(pad.buttons[7]?.pressed);

    const lb = gpCfg.swapBumpersTriggers ? rawLt : rawLb;
    const rb = gpCfg.swapBumpersTriggers ? rawRt : rawRb;
    const lt = gpCfg.swapBumpersTriggers ? rawLb : rawLt;
    const rt = gpCfg.swapBumpersTriggers ? rawRb : rawRt;

    const specialMod = (lb && lt) || (lb && rb);

    const justPressed = (idx: number) => {
      const curr = Boolean(pad.buttons[idx]?.pressed);
      const prev = Boolean(this.prevGamepadButtons[idx]);
      return curr && !prev;
    };

    // 4-Limb Face Buttons: X/Square=2 (Lead Jab), Y/Triangle=3 (Rear Cross), A/Cross=0 (Lead Kick), B/Circle=1 (Rear Kick)
    if (justPressed(2)) {
      this.bufferStrike(
        this.resolveStrikeFromModifiers('leadPunch', lb, lt, specialMod),
      );
    }
    if (justPressed(3)) {
      this.bufferStrike(
        this.resolveStrikeFromModifiers('rearPunch', lb, lt, specialMod),
      );
    }
    if (justPressed(0)) {
      this.bufferStrike(
        this.resolveStrikeFromModifiers('leadKick', lb, lt, specialMod),
      );
    }
    if (justPressed(1)) {
      this.bufferStrike(
        this.resolveStrikeFromModifiers('rearKick', lb, lt, specialMod),
      );
    }

    // Tap Block bumper/trigger mid-windup = Feint Cancel (when not holding LB for LB+RB modifier)
    const blockBtnIdx = gpCfg.swapBumpersTriggers ? 7 : 5;
    if (justPressed(blockBtnIdx) && !lb) {
      this.bufferedFeint = true;
    }

    if (justPressed(9)) {
      this.onPauseCallback?.();
    }

    this.prevGamepadButtons = pad.buttons.map((b) => Boolean(b.pressed));

    // Project stick onto fighter facing basis (perspective camera vs broadcast side-view)
    const gpScreenX = Math.max(-1, Math.min(1, lx + (dRight - dLeft)));
    const gpScreenY = Math.max(-1, Math.min(1, ly + (dDown - dUp)));
    const sinY = Math.sin(playerFacingYaw);
    const cosY = Math.cos(playerFacingYaw);
    const moveZ = isPerspectiveFollowCam
      ? Math.max(-1, Math.min(1, -gpScreenY))
      : Math.max(-1, Math.min(1, gpScreenX * sinY + gpScreenY * cosY));
    const moveX = isPerspectiveFollowCam
      ? Math.max(-1, Math.min(1, -gpScreenX))
      : Math.max(-1, Math.min(1, gpScreenX * cosY - gpScreenY * sinY));

    let guard: GuardMode = 'none';
    if (rb && rt) guard = 'low';
    else if (rb && !lb) guard = 'high';

    return {
      moveX,
      moveZ,
      guard,
      heldEvade: rDir === 'none' ? null : rDir,
    };
  }

  public samplePlayerInput(
    dt: number,
    playerFacingYaw = Math.PI / 2,
    isPerspectiveFollowCam = false,
  ): FighterInput {
    if (this.strikeBufferTimer > 0) {
      this.strikeBufferTimer = Math.max(0, this.strikeBufferTimer - dt);
      if (this.strikeBufferTimer === 0) this.bufferedStrike = null;
    }
    if (this.evadeBufferTimer > 0) {
      this.evadeBufferTimer = Math.max(0, this.evadeBufferTimer - dt);
      if (this.evadeBufferTimer === 0) this.bufferedEvade = null;
    }

    const sinY = Math.sin(playerFacingYaw);
    const cosY = Math.cos(playerFacingYaw);

    const gp = this.pollGamepad(playerFacingYaw, isPerspectiveFollowCam);
    const kb = this.settings.keyboard;

    let kbZ = 0;
    let kbX = 0;
    if (isPerspectiveFollowCam) {
      if (this.isBoundHeld(kb.circleUp)) kbZ += 1;
      if (this.isBoundHeld(kb.circleDown)) kbZ -= 1;
      if (this.isBoundHeld(kb.moveBack)) kbX += 1;
      if (this.isBoundHeld(kb.moveForward)) kbX -= 1;
    } else {
      if (this.isBoundHeld(kb.moveForward)) kbZ += 1;
      if (this.isBoundHeld(kb.moveBack)) kbZ -= 1;

      // W circles toward cage (-Z), S circles toward camera (+Z)
      let kbScreenY = 0;
      if (this.isBoundHeld(kb.circleDown)) kbScreenY += 1;
      if (this.isBoundHeld(kb.circleUp)) kbScreenY -= 1;
      kbX = kbScreenY * -(sinY >= 0 ? 1 : -1);
    }

    // Project touch stick into fighter basis
    const touchMoveZ = isPerspectiveFollowCam
      ? -this.touchScreenY
      : this.touchScreenX * sinY + this.touchScreenY * cosY;
    const touchMoveX = isPerspectiveFollowCam
      ? -this.touchScreenX
      : this.touchScreenX * cosY - this.touchScreenY * sinY;

    // Keyboard High/Low Block
    const bodyHeld = this.isBoundHeld(kb.bodyMod);
    let kbGuard: GuardMode = 'none';
    if (this.isBoundHeld(kb.block)) {
      kbGuard = bodyHeld ? 'low' : 'high';
    }

    // Keyboard held head movement
    let kbHeldEvade: EvadeType | null = null;
    if (this.isBoundHeld(kb.evadeDown)) kbHeldEvade = 'duck';
    else if (this.isBoundHeld(kb.evadeLeft)) kbHeldEvade = 'pullBack';
    else if (this.isBoundHeld(kb.evadeUp)) kbHeldEvade = 'slipLeft';
    else if (this.isBoundHeld(kb.evadeRight)) kbHeldEvade = 'slipRight';

    const requestedStrike = this.bufferedStrike;
    const requestedEvade = this.bufferedEvade;
    let requestedLunge = this.bufferedLunge;
    if (!requestedLunge && this.bufferedScreenLunge) {
      const sx = this.bufferedScreenLunge.x;
      const sy = this.bufferedScreenLunge.y;
      requestedLunge = isPerspectiveFollowCam
        ? { x: -sx, z: -sy }
        : {
            x: sx * cosY - sy * sinY,
            z: sx * sinY + sy * cosY,
          };
    }
    const requestedFeint = this.bufferedFeint;

    this.bufferedStrike = null;
    this.bufferedEvade = null;
    this.bufferedLunge = null;
    this.bufferedScreenLunge = null;
    this.bufferedFeint = false;

    const moveX =
      Math.abs(gp.moveX) > 0.05
        ? gp.moveX
        : Math.abs(touchMoveX) > 0.05
          ? touchMoveX
          : kbX;
    const moveZ =
      Math.abs(gp.moveZ) > 0.05
        ? gp.moveZ
        : Math.abs(touchMoveZ) > 0.05
          ? touchMoveZ
          : kbZ;
    const guard =
      gp.guard !== 'none'
        ? gp.guard
        : this.touchGuard !== 'none'
          ? this.touchGuard
          : kbGuard;

    return {
      moveX,
      moveZ,
      guard,
      requestedStrike,
      requestedEvade,
      heldEvade: gp.heldEvade ?? this.touchHeldEvade ?? kbHeldEvade,
      requestedLunge,
      requestedFeint,
    };
  }
}
