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

export type TouchControlId =
  | 'stick'
  | 'heavy'
  | 'punch'
  | 'kick'
  | 'block'
  | 'body'
  | 'evade'
  | 'leadPunch'
  | 'rearPunch'
  | 'leadKick'
  | 'rearKick'
  | 'hook'
  | 'bodyHook'
  | 'headKick'
  | 'lowKick';

export interface TouchControlPosition {
  x: number; // Normalized viewport horizontal center (0.06 .. 0.94)
  y: number; // Normalized viewport vertical center (0.14 .. 0.92)
}

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
  showQuickStrikeButtons: boolean;
  customPositions?: Partial<Record<TouchControlId, TouchControlPosition>>;
  customScales?: Partial<Record<TouchControlId, number>>;
}

export interface GamepadControlSettings {
  deadzone: number;
  swapBumpersTriggers: boolean;
  invertY: boolean;
}

export type CameraPreset =
  | 'default'
  | 'wide'
  | 'close'
  | 'firstPerson'
  | 'thirdPerson'
  | 'topToSide';

export const CAMERA_PRESET_OPTIONS: Array<{
  id: CameraPreset;
  label: string;
  shortLabel: string;
}> = [
  { id: 'default', label: 'DEFAULT', shortLabel: 'Default' },
  { id: 'wide', label: 'WIDE', shortLabel: 'Wide' },
  { id: 'close', label: 'CLOSE', shortLabel: 'Close' },
  { id: 'firstPerson', label: 'FIRST PERSON', shortLabel: '1st Person' },
  { id: 'thirdPerson', label: 'THIRD PERSON', shortLabel: '3rd Person' },
  { id: 'topToSide', label: 'TOP TO SIDE', shortLabel: 'Top-Side' },
];

export interface ControlSettings {
  cameraPreset: CameraPreset;
  keyboard: Record<KeyboardAction, string>;
  touch: TouchControlSettings;
  gamepad: GamepadControlSettings;
}

export const TOUCH_CONTROL_META: Record<
  TouchControlId,
  { label: string; shortLabel: string; accent: string }
> = {
  stick: { label: 'Move Stick', shortLabel: 'STICK', accent: '#ffffff' },
  heavy: { label: 'Heavy Strike', shortLabel: 'HEAVY', accent: '#ff8e1c' },
  punch: { label: 'Punch Combo', shortLabel: 'PUNCH', accent: '#ff5d47' },
  kick: { label: 'Kick', shortLabel: 'KICK', accent: '#54a6ff' },
  block: { label: 'Block / Feint', shortLabel: 'BLOCK', accent: '#4ba3ff' },
  body: { label: 'Body Modifier', shortLabel: 'BODY', accent: '#ff8e1c' },
  evade: { label: 'Head Slip / Duck', shortLabel: 'SLIP', accent: '#f4c038' },
  leadPunch: { label: 'Lead Jab', shortLabel: 'JAB', accent: '#ff5d47' },
  rearPunch: { label: 'Rear Cross', shortLabel: 'CROSS', accent: '#ff8e1c' },
  leadKick: { label: 'Lead Kick', shortLabel: 'L.KICK', accent: '#54a6ff' },
  rearKick: { label: 'Rear Kick', shortLabel: 'R.KICK', accent: '#54a6ff' },
  hook: { label: 'Hook Modifier', shortLabel: 'HOOK', accent: '#ff5d47' },
  bodyHook: { label: 'Body Hook', shortLabel: 'B.HOOK', accent: '#ff8e1c' },
  headKick: { label: 'Head Kick', shortLabel: 'H.KICK', accent: '#ff5d47' },
  lowKick: { label: 'Low Kick', shortLabel: 'LOW.K', accent: '#54a6ff' },
};

export function getControlsForPreset(
  preset: TouchLayoutPreset,
  includeQuickStrikes = true,
): TouchControlId[] {
  const base: TouchControlId[] =
    preset === 'fourLimb'
      ? [
          'stick',
          'leadPunch',
          'rearPunch',
          'leadKick',
          'rearKick',
          'block',
          'hook',
          'body',
          'evade',
        ]
      : ['stick', 'heavy', 'punch', 'kick', 'block', 'body', 'evade'];
  return includeQuickStrikes
    ? [...base, 'headKick', 'bodyHook', 'lowKick']
    : base;
}

export function clampTouchPosition(
  pos: TouchControlPosition,
): TouchControlPosition {
  return {
    x: Math.max(0.06, Math.min(0.94, Number(pos.x.toFixed(4)))),
    y: Math.max(0.16, Math.min(0.92, Number(pos.y.toFixed(4)))),
  };
}

export function getDefaultTouchPositions(
  preset: TouchLayoutPreset,
  handedness: 'standard' | 'leftHanded',
): Record<TouchControlId, TouchControlPosition> {
  const mirrorX = (x: number) => (handedness === 'leftHanded' ? 1 - x : x);

  const base: Record<TouchControlId, TouchControlPosition> =
    preset === 'fourLimb'
      ? {
          stick: { x: 0.14, y: 0.74 },
          leadPunch: { x: 0.81, y: 0.48 },
          rearPunch: { x: 0.9, y: 0.54 },
          leadKick: { x: 0.81, y: 0.82 },
          rearKick: { x: 0.9, y: 0.74 },
          block: { x: 0.71, y: 0.65 },
          hook: { x: 0.72, y: 0.47 },
          body: { x: 0.71, y: 0.84 },
          evade: { x: 0.8, y: 0.65 },
          headKick: { x: 0.62, y: 0.52 },
          bodyHook: { x: 0.6, y: 0.68 },
          lowKick: { x: 0.61, y: 0.84 },
          heavy: { x: 0.88, y: 0.45 },
          punch: { x: 0.9, y: 0.66 },
          kick: { x: 0.8, y: 0.84 },
        }
      : {
          stick: { x: 0.14, y: 0.74 },
          heavy: { x: 0.88, y: 0.45 },
          punch: { x: 0.9, y: 0.67 },
          kick: { x: 0.8, y: 0.84 },
          block: { x: 0.73, y: 0.63 },
          body: { x: 0.71, y: 0.84 },
          evade: { x: 0.78, y: 0.45 },
          headKick: { x: 0.63, y: 0.53 },
          bodyHook: { x: 0.61, y: 0.69 },
          lowKick: { x: 0.61, y: 0.85 },
          leadPunch: { x: 0.81, y: 0.48 },
          rearPunch: { x: 0.9, y: 0.54 },
          leadKick: { x: 0.81, y: 0.82 },
          rearKick: { x: 0.9, y: 0.74 },
          hook: { x: 0.72, y: 0.47 },
        };

  const out = {} as Record<TouchControlId, TouchControlPosition>;
  (Object.keys(base) as TouchControlId[]).forEach((id) => {
    out[id] = clampTouchPosition({
      x: mirrorX(base[id].x),
      y: base[id].y,
    });
  });
  return out;
}

export function hasCustomTouchLayout(touch: TouchControlSettings): boolean {
  return Boolean(
    touch.customPositions && Object.keys(touch.customPositions).length > 0,
  );
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
  cameraPreset: 'default',
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
    edgeMargin: 14,
    verticalOffset: 8,
    joystickDeadzone: 0.14,
    lungeMode: 'flick',
    stickLunge: true,
    modifierBehavior: 'toggle',
    showLabels: true,
    showQuickStrikeButtons: true,
    customPositions: {},
    customScales: {},
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
    cameraPreset: DEFAULT_CONTROL_SETTINGS.cameraPreset,
    keyboard: { ...DEFAULT_CONTROL_SETTINGS.keyboard },
    touch: {
      ...DEFAULT_CONTROL_SETTINGS.touch,
      customPositions: {},
      customScales: {},
    },
    gamepad: { ...DEFAULT_CONTROL_SETTINGS.gamepad },
  };
}

function sanitizeCustomPositions(
  raw: unknown,
): Partial<Record<TouchControlId, TouchControlPosition>> {
  if (!raw || typeof raw !== 'object') return {};
  const validIds = new Set<TouchControlId>(
    Object.keys(TOUCH_CONTROL_META) as TouchControlId[],
  );
  const out: Partial<Record<TouchControlId, TouchControlPosition>> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!validIds.has(key as TouchControlId) || !val || typeof val !== 'object') {
      continue;
    }
    const maybe = val as { x?: unknown; y?: unknown };
    if (
      typeof maybe.x === 'number' &&
      Number.isFinite(maybe.x) &&
      typeof maybe.y === 'number' &&
      Number.isFinite(maybe.y)
    ) {
      out[key as TouchControlId] = clampTouchPosition({ x: maybe.x, y: maybe.y });
    }
  }
  return out;
}

function sanitizeCustomScales(
  raw: unknown,
): Partial<Record<TouchControlId, number>> {
  if (!raw || typeof raw !== 'object') return {};
  const validIds = new Set<TouchControlId>(
    Object.keys(TOUCH_CONTROL_META) as TouchControlId[],
  );
  const out: Partial<Record<TouchControlId, number>> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!validIds.has(key as TouchControlId)) continue;
    if (typeof val === 'number' && Number.isFinite(val)) {
      out[key as TouchControlId] = Math.max(0.75, Math.min(1.45, val));
    }
  }
  return out;
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
      customPositions: sanitizeCustomPositions(parsed.touch?.customPositions),
      customScales: sanitizeCustomScales(parsed.touch?.customScales),
    };
    if (!parsed.touch?.lungeMode && parsed.touch?.stickLunge === false) {
      mergedTouch.lungeMode = 'off';
    }
    const validCameras = new Set<CameraPreset>(
      CAMERA_PRESET_OPTIONS.map((c) => c.id),
    );
    const cameraPreset: CameraPreset =
      parsed.cameraPreset && validCameras.has(parsed.cameraPreset)
        ? parsed.cameraPreset
        : DEFAULT_CONTROL_SETTINGS.cameraPreset;
    return {
      cameraPreset,
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
