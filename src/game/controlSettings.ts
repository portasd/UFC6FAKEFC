export type KeyboardAction =
  | 'moveForward'
  | 'moveBack'
  | 'circleUp'
  | 'circleDown'
  | 'leadPunch'
  | 'rearPunch'
  | 'leadKick'
  | 'rearKick'
  | 'hookMod'
  | 'bodyMod'
  | 'block'
  | 'evadeUp'
  | 'evadeRight'
  | 'evadeDown'
  | 'evadeLeft'
  | 'pause';

export type TouchLayoutPreset = 'arc' | 'fourLimb';
export type JoystickMode = 'fixed' | 'floating';
export type StickLungeMode = 'flick' | 'doubleTap' | 'off';
export type ModifierBehavior = 'toggle' | 'hold';

export interface TouchControlSettings {
  preset: TouchLayoutPreset;
  handedness: 'standard' | 'leftHanded';
  joystickMode: JoystickMode;
  joystickScale: number;
  scale: number;
  buttonSpacing: number;
  opacity: number;
  edgeMargin: number;
  verticalOffset: number;
  joystickDeadzone: number;
  lungeMode: StickLungeMode;
  stickLunge: boolean;
  modifierBehavior: ModifierBehavior;
  showLabels: boolean;
}

export interface GamepadControlSettings {
  deadzone: number;
  swapBumpersTriggers: boolean;
  invertY: boolean;
}

export interface ControlSettings {
  keyboard: Record<KeyboardAction, string>;
  touch: TouchControlSettings;
  gamepad: GamepadControlSettings;
}

export const KEYBOARD_ACTION_LABELS: Array<{
  action: KeyboardAction;
  label: string;
  group: 'Footwork' | 'Strikes & Modifiers' | 'Defense & Head Move' | 'System';
}> = [
  { action: 'moveForward', label: 'Step Forward (+2x Lunge)', group: 'Footwork' },
  { action: 'moveBack', label: 'Step Back (+2x Lunge)', group: 'Footwork' },
  { action: 'circleUp', label: 'Circle Toward Cage', group: 'Footwork' },
  { action: 'circleDown', label: 'Circle Toward Camera', group: 'Footwork' },
  { action: 'leadPunch', label: 'Lead Jab', group: 'Strikes & Modifiers' },
  { action: 'rearPunch', label: 'Rear Cross', group: 'Strikes & Modifiers' },
  { action: 'leadKick', label: 'Lead Leg Kick', group: 'Strikes & Modifiers' },
  { action: 'rearKick', label: 'Rear Leg Kick', group: 'Strikes & Modifiers' },
  { action: 'hookMod', label: 'Hook / Head Kick Modifier (Hold)', group: 'Strikes & Modifiers' },
  { action: 'bodyMod', label: 'Body Strike / Low Guard Mod (Hold)', group: 'Strikes & Modifiers' },
  { action: 'block', label: 'High Block (Hold) / Feint (Tap)', group: 'Defense & Head Move' },
  { action: 'evadeUp', label: 'Slip Left (Head Move)', group: 'Defense & Head Move' },
  { action: 'evadeRight', label: 'Slip Right (Head Move)', group: 'Defense & Head Move' },
  { action: 'evadeDown', label: 'Duck (Head Move)', group: 'Defense & Head Move' },
  { action: 'evadeLeft', label: 'Pull Back (Head Move)', group: 'Defense & Head Move' },
  { action: 'pause', label: 'Pause Bout', group: 'System' },
];

export const DEFAULT_CONTROL_SETTINGS: ControlSettings = {
  keyboard: {
    moveForward: 'KeyD',
    moveBack: 'KeyA',
    circleUp: 'KeyW',
    circleDown: 'KeyS',
    leadPunch: 'KeyJ',
    rearPunch: 'KeyI',
    leadKick: 'KeyK',
    rearKick: 'KeyL',
    hookMod: 'ShiftLeft',
    bodyMod: 'ControlLeft',
    block: 'Space',
    evadeUp: 'ArrowUp',
    evadeRight: 'ArrowRight',
    evadeDown: 'ArrowDown',
    evadeLeft: 'ArrowLeft',
    pause: 'KeyP',
  },
  touch: {
    preset: 'arc',
    handedness: 'standard',
    joystickMode: 'fixed',
    joystickScale: 1,
    scale: 1,
    buttonSpacing: 1,
    opacity: 0.92,
    edgeMargin: 16,
    verticalOffset: 10,
    joystickDeadzone: 0.14,
    lungeMode: 'flick',
    stickLunge: true,
    modifierBehavior: 'toggle',
    showLabels: true,
  },
  gamepad: {
    deadzone: 0.18,
    swapBumpersTriggers: false,
    invertY: false,
  },
};

const STORAGE_KEY = 'octagon_control_settings_v1';

export function cloneDefaultControlSettings(): ControlSettings {
  return {
    keyboard: { ...DEFAULT_CONTROL_SETTINGS.keyboard },
    touch: { ...DEFAULT_CONTROL_SETTINGS.touch },
    gamepad: { ...DEFAULT_CONTROL_SETTINGS.gamepad },
  };
}

export function loadControlSettings(): ControlSettings {
  if (typeof window === 'undefined') return cloneDefaultControlSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaultControlSettings();
    const parsed = JSON.parse(raw) as Partial<ControlSettings>;
    const mergedTouch: TouchControlSettings = {
      ...DEFAULT_CONTROL_SETTINGS.touch,
      ...(parsed.touch ?? {}),
    };
    if (!parsed.touch?.lungeMode && parsed.touch?.stickLunge === false) {
      mergedTouch.lungeMode = 'off';
    }
    return {
      keyboard: {
        ...DEFAULT_CONTROL_SETTINGS.keyboard,
        ...(parsed.keyboard ?? {}),
      },
      touch: mergedTouch,
      gamepad: {
        ...DEFAULT_CONTROL_SETTINGS.gamepad,
        ...(parsed.gamepad ?? {}),
      },
    };
  } catch {
    return cloneDefaultControlSettings();
  }
}

export function saveControlSettings(settings: ControlSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function matchesKeyBinding(boundCode: string, actualCode: string): boolean {
  if (boundCode === actualCode) return true;
  if (
    (boundCode === 'ShiftLeft' || boundCode === 'ShiftRight') &&
    (actualCode === 'ShiftLeft' || actualCode === 'ShiftRight')
  ) {
    return true;
  }
  if (
    (boundCode === 'ControlLeft' || boundCode === 'ControlRight') &&
    (actualCode === 'ControlLeft' || actualCode === 'ControlRight')
  ) {
    return true;
  }
  if (
    (boundCode === 'AltLeft' || boundCode === 'AltRight') &&
    (actualCode === 'AltLeft' || actualCode === 'AltRight')
  ) {
    return true;
  }
  return false;
}

export function formatKeyCode(code: string): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  if (code === 'AltLeft' || code === 'AltRight') return 'Alt';
  if (code === 'Space') return 'Space';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  if (code === 'Enter') return 'Enter';
  if (code === 'Escape') return 'Esc';
  if (code === 'Backquote') return '`';
  if (code === 'BracketLeft') return '[';
  if (code === 'BracketRight') return ']';
  if (code === 'Semicolon') return ';';
  if (code === 'Quote') return "'";
  if (code === 'Comma') return ',';
  if (code === 'Period') return '.';
  if (code === 'Slash') return '/';
  return code;
}
