import { EvadeType, FighterInput, GuardMode } from './combatEngine';
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
  private bufferedFeint = false;

  private lastTapTime: Record<string, number> = {};
  private prevStickMag = 0;
  private prevGamepadButtons: boolean[] = [];
  private prevRightStickDir: 'none' | EvadeType = 'none';
  private onPauseCallback: (() => void) | null = null;

  public controllerStatus: ControllerStatus = {
    connected: false,
    name: '',
  };

  constructor(onPause?: () => void) {
    this.onPauseCallback = onPause ?? null;
  }

  public setPauseCallback(cb: () => void) {
    this.onPauseCallback = cb;
  }

  public bindListeners(): () => void {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          e.code,
        ) ||
        ((e.ctrlKey || e.metaKey) &&
          ['KeyJ', 'KeyI', 'KeyK', 'KeyL'].includes(e.code))
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
    this.bufferedFeint = false;
    this.lastTapTime = {};
    this.prevStickMag = 0;
    this.prevRightStickDir = 'none';
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
    const shiftMod =
      Boolean(e?.shiftKey) ||
      this.keysHeld.has('ShiftLeft') ||
      this.keysHeld.has('ShiftRight');
    const ctrlMod =
      Boolean(e?.ctrlKey) ||
      this.keysHeld.has('ControlLeft') ||
      this.keysHeld.has('ControlRight');

    // Quick double-tap WASD directional lunges (within 250ms)
    if (
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD'
    ) {
      const now = performance.now();
      const prev = this.lastTapTime[code] ?? 0;
      if (now - prev < 250) {
        if (code === 'KeyD') this.bufferedLunge = { x: 0, z: 1 };
        else if (code === 'KeyA') this.bufferedLunge = { x: 0, z: -1 };
        else if (code === 'KeyW') this.bufferedLunge = { x: -1, z: 0 };
        else if (code === 'KeyS') this.bufferedLunge = { x: 1, z: 0 };
        this.lastTapTime[code] = 0;
      } else {
        this.lastTapTime[code] = now;
      }
      return;
    }

    switch (code) {
      // Exact EA UFC 4-Limb Keyboard Mapping: J=Lead Punch, I=Rear Punch, K=Lead Kick, L=Rear Kick
      case 'KeyJ':
        this.bufferStrike(
          this.resolveStrikeFromModifiers(
            'leadPunch',
            shiftMod,
            ctrlMod,
            shiftMod && ctrlMod,
          ),
        );
        break;
      case 'KeyI':
        this.bufferStrike(
          this.resolveStrikeFromModifiers(
            'rearPunch',
            shiftMod,
            ctrlMod,
            shiftMod && ctrlMod,
          ),
        );
        break;
      case 'KeyK':
        this.bufferStrike(
          this.resolveStrikeFromModifiers(
            'leadKick',
            shiftMod,
            ctrlMod,
            shiftMod && ctrlMod,
          ),
        );
        break;
      case 'KeyL':
        this.bufferStrike(
          this.resolveStrikeFromModifiers(
            'rearKick',
            shiftMod,
            ctrlMod,
            shiftMod && ctrlMod,
          ),
        );
        break;

      // Head Movement (Slips, Ducks, Pulls): Arrow Keys
      case 'ArrowUp':
        this.bufferEvade('slipLeft');
        break;
      case 'ArrowRight':
        this.bufferEvade('slipRight');
        break;
      case 'ArrowDown':
        this.bufferEvade('duck');
        break;
      case 'ArrowLeft':
        this.bufferEvade('pullBack');
        break;

      // Tap Space (Block) mid-windup = Strike Feint / Cancel
      case 'Space':
        this.bufferedFeint = true;
        break;

      case 'Escape':
      case 'KeyP':
        this.onPauseCallback?.();
        break;
    }
  }

  public pollGamepad(): {
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

    const deadzone = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    const lx = deadzone(pad.axes[0] ?? 0);
    const ly = deadzone(pad.axes[1] ?? 0);
    const rx = deadzone(pad.axes[2] ?? 0);
    const ry = deadzone(pad.axes[3] ?? 0);

    // D-pad fallback
    const dUp = pad.buttons[12]?.pressed ? 1 : 0;
    const dDown = pad.buttons[13]?.pressed ? 1 : 0;
    const dLeft = pad.buttons[14]?.pressed ? 1 : 0;
    const dRight = pad.buttons[15]?.pressed ? 1 : 0;

    // Detect Left Stick rapid flicks for directional lunges
    const stickMag = Math.hypot(lx, ly);
    if (stickMag > 0.78 && this.prevStickMag < 0.25) {
      this.bufferedLunge = { x: ly, z: lx };
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

    // EA Sports UFC Bumper/Trigger mapping:
    // LB / L1 (buttons[4]) = Hooks / Roundhouse Kicks modifier
    // LT / L2 (buttons[6]) = Body Strikes modifier
    // RB / R1 (buttons[5]) = High Block (and Feint tap; also LB+RB special uppercut/spin modifier)
    // RT / R2 (buttons[7]) = combined RB + RT = Low/Body Block
    const lb = Boolean(pad.buttons[4]?.pressed);
    const rb = Boolean(pad.buttons[5]?.pressed);
    const lt =
      (pad.buttons[6]?.value ?? 0) > 0.35 || Boolean(pad.buttons[6]?.pressed);
    const rt =
      (pad.buttons[7]?.value ?? 0) > 0.35 || Boolean(pad.buttons[7]?.pressed);

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

    // Tap RB / R1 mid-windup = Feint Cancel (when not holding LB for LB+RB modifier)
    if (justPressed(5) && !lb) {
      this.bufferedFeint = true;
    }

    if (justPressed(9)) {
      this.onPauseCallback?.();
    }

    this.prevGamepadButtons = pad.buttons.map((b) => Boolean(b.pressed));

    // In side-on broadcast camera, Left Stick Right (+lx) moves toward opponent (+moveZ), Up (-ly) circles away
    const moveZ = Math.max(-1, Math.min(1, lx + (dRight - dLeft)));
    const moveX = Math.max(-1, Math.min(1, ly + (dDown - dUp)));

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

  public samplePlayerInput(dt: number): FighterInput {
    if (this.strikeBufferTimer > 0) {
      this.strikeBufferTimer = Math.max(0, this.strikeBufferTimer - dt);
      if (this.strikeBufferTimer === 0) this.bufferedStrike = null;
    }
    if (this.evadeBufferTimer > 0) {
      this.evadeBufferTimer = Math.max(0, this.evadeBufferTimer - dt);
      if (this.evadeBufferTimer === 0) this.bufferedEvade = null;
    }

    const gp = this.pollGamepad();

    // Keyboard WASD footwork:
    // D = forward toward opponent (+moveZ), A = back away (-moveZ)
    // W = circle into cage (-moveX), S = circle toward camera (+moveX)
    let kbZ = 0;
    if (this.keysHeld.has('KeyD')) kbZ += 1;
    if (this.keysHeld.has('KeyA')) kbZ -= 1;

    let kbX = 0;
    if (this.keysHeld.has('KeyS')) kbX += 1;
    if (this.keysHeld.has('KeyW')) kbX -= 1;

    // Keyboard High/Low Block: Space = High Block, Space + Ctrl = Low/Body Block
    const ctrlHeld =
      this.keysHeld.has('ControlLeft') || this.keysHeld.has('ControlRight');
    let kbGuard: GuardMode = 'none';
    if (this.keysHeld.has('Space')) {
      kbGuard = ctrlHeld ? 'low' : 'high';
    }

    // Keyboard held head movement (Arrow Keys)
    let kbHeldEvade: EvadeType | null = null;
    if (this.keysHeld.has('ArrowDown')) kbHeldEvade = 'duck';
    else if (this.keysHeld.has('ArrowLeft')) kbHeldEvade = 'pullBack';
    else if (this.keysHeld.has('ArrowUp')) kbHeldEvade = 'slipLeft';
    else if (this.keysHeld.has('ArrowRight')) kbHeldEvade = 'slipRight';

    const requestedStrike = this.bufferedStrike;
    const requestedEvade = this.bufferedEvade;
    const requestedLunge = this.bufferedLunge;
    const requestedFeint = this.bufferedFeint;

    this.bufferedStrike = null;
    this.bufferedEvade = null;
    this.bufferedLunge = null;
    this.bufferedFeint = false;

    return {
      moveX: Math.abs(gp.moveX) > 0.05 ? gp.moveX : kbX,
      moveZ: Math.abs(gp.moveZ) > 0.05 ? gp.moveZ : kbZ,
      guard: gp.guard !== 'none' ? gp.guard : kbGuard,
      requestedStrike,
      requestedEvade,
      heldEvade: gp.heldEvade ?? kbHeldEvade,
      requestedLunge,
      requestedFeint,
    };
  }
}
