import React, { useEffect, useState } from 'react';
import { Gamepad2, Keyboard, RotateCcw, Skull, Smartphone, Trophy } from 'lucide-react';
import { BoutState } from '../game/combatEngine';
import {
  ControlSettings,
  DEFAULT_CONTROL_SETTINGS,
  formatKeyCode,
  KEYBOARD_ACTION_LABELS,
  KeyboardAction,
} from '../game/controlSettings';
import { getFighterPortraitUrl } from '../game/portraits';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onOpenControls: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onReturnTitle,
  onOpenControls,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fight Paused"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#111319] border border-white/20 border-t-2 border-t-[#d92626] p-6 shadow-2xl">
        <h2 className="font-display font-extrabold text-3xl uppercase tracking-wide text-white mb-1">
          Bout Paused
        </h2>
        <p className="text-xs text-white/60 mb-6">
          Press Esc or P to jump straight back into the Octagon.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 bg-[#d92626] hover:bg-[#ef3333] text-white font-display font-bold text-lg uppercase tracking-wider transition-colors cursor-pointer"
          >
            Resume Fight
          </button>
          <button
            type="button"
            onClick={onOpenControls}
            className="w-full py-2.5 bg-[#191c25] hover:bg-[#232734] border border-white/15 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            Controls &amp; Controller Mapping
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 bg-[#191c25] hover:bg-[#232734] border border-white/15 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            Restart Bout
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2.5 bg-transparent hover:bg-white/5 border border-white/10 text-sm font-medium text-white/75 transition-colors cursor-pointer"
          >
            Fighter Select
          </button>
        </div>
      </div>
    </div>
  );
};

interface ResultModalProps {
  bout: BoutState;
  onRematch: () => void;
  onReturnTitle: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  bout,
  onRematch,
  onReturnTitle,
}) => {
  const winnerIdx: 0 | 1 = bout.koWinnerIndex ?? 0;
  const loserIdx: 0 | 1 = winnerIdx === 0 ? 1 : 0;
  const winner = bout.fighters[winnerIdx];
  const loser = bout.fighters[loserIdx];
  const red = bout.fighters[0];
  const blue = bout.fighters[1];
  const isPlayerWinner = winnerIdx === 0;

  const acc = (landed: number, thrown: number) =>
    thrown > 0 ? `${Math.round((landed / thrown) * 100)}%` : '0%';

  const redPortrait = getFighterPortraitUrl(red.profile);
  const bluePortrait = getFighterPortraitUrl(blue.profile);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Official Bout Result"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/82 p-3 sm:p-4"
    >
      <div
        className={`w-full max-w-2xl max-h-[94vh] overflow-y-auto bg-[#0e1017] border border-white/20 border-t-4 ${
          isPlayerWinner ? 'border-t-[#f4c038]' : 'border-t-[#d92626]'
        } p-4 sm:p-6 shadow-2xl`}
      >
        {/* HERO WINNER / LOSER VERDICT BANNER */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-4 border ${
            isPlayerWinner
              ? 'bg-gradient-to-r from-[#f4c038]/20 via-[#10b981]/15 to-transparent border-[#f4c038]/50'
              : 'bg-gradient-to-r from-[#d92626]/25 via-[#991b1b]/15 to-transparent border-[#d92626]/50'
          }`}
        >
          <div>
            <div
              className={`text-xs font-extrabold uppercase tracking-[0.2em] ${
                isPlayerWinner ? 'text-[#f4c038]' : 'text-[#ff5d47]'
              }`}
            >
              {isPlayerWinner ? 'VICTORY · YOU WIN' : 'DEFEAT · YOU LOSE'}
            </div>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl uppercase text-white tracking-tight leading-none mt-0.5">
              {winner.profile.name} DEFEATS {loser.profile.name}
            </h2>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display font-extrabold text-2xl sm:text-3xl text-[#f4c038] leading-none">
              {bout.koMethod ?? 'KO'}
            </div>
            <div className="text-xs font-mono-tabular text-white/75 mt-0.5">
              {bout.koFinishTime}
            </div>
          </div>
        </div>

        {/* CLEAR SIDE-BY-SIDE WINNER VS LOSER CARDS */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { f: red, idx: 0 as const, corner: 'Red Corner · You', img: redPortrait },
            { f: blue, idx: 1 as const, corner: 'Blue Corner · CPU', img: bluePortrait },
          ].map(({ f, idx, corner, img }) => {
            const isWin = idx === winnerIdx;
            return (
              <div
                key={f.profile.id + idx}
                data-outcome={isWin ? 'winner' : 'loser'}
                className={`relative overflow-hidden border p-2.5 sm:p-3 flex items-center gap-3 ${
                  isWin
                    ? 'bg-[#171c26] border-[#f4c038] shadow-[0_0_20px_rgba(244,192,56,0.18)]'
                    : 'bg-[#0b0c11] border-white/15 opacity-75'
                }`}
              >
                <div className="relative w-16 h-12 sm:w-20 sm:h-14 shrink-0 overflow-hidden border border-white/15 bg-black">
                  <img
                    src={img}
                    alt={f.profile.name}
                    className={`w-full h-full object-cover ${isWin ? '' : 'grayscale contrast-75 brightness-75'}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {isWin ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#f4c038] text-[#110d04] text-[10px] font-extrabold uppercase tracking-wider">
                        <Trophy className="w-3 h-3" aria-hidden="true" />
                        WINNER
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#7f1d1d] text-white/95 text-[10px] font-extrabold uppercase tracking-wider">
                        <Skull className="w-3 h-3" aria-hidden="true" />
                        LOSER · {bout.koMethod === 'DECISION' ? 'DEC' : "KO'D"}
                      </span>
                    )}
                  </div>
                  <div className="font-display font-extrabold text-lg sm:text-xl uppercase text-white leading-tight truncate">
                    {f.profile.name}
                  </div>
                  <div
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      idx === 0 ? 'text-[#ff5d47]' : 'text-[#54a6ff]'
                    }`}
                  >
                    {corner}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stat Comparison Table */}
        <div className="space-y-1.5 text-xs sm:text-sm mb-5 bg-black/30 border border-white/10 p-3">
          <div className="grid grid-cols-3 text-[11px] uppercase tracking-wider text-white/55 pb-1 border-b border-white/10">
            <span className="text-[#ff5d47] font-bold truncate">{red.profile.name}</span>
            <span className="text-center">Fight Stats</span>
            <span className="text-right text-[#54a6ff] font-bold truncate">
              {blue.profile.name}
            </span>
          </div>

          {[
            {
              label: 'Sig. Strikes',
              r: `${red.strikesLanded} / ${red.strikesThrown}`,
              b: `${blue.strikesLanded} / ${blue.strikesThrown}`,
            },
            {
              label: 'Accuracy',
              r: acc(red.strikesLanded, red.strikesThrown),
              b: acc(blue.strikesLanded, blue.strikesThrown),
            },
            {
              label: 'Head / Body / Leg',
              r: `${red.headLanded} / ${red.bodyLanded} / ${red.legLanded}`,
              b: `${blue.headLanded} / ${blue.bodyLanded} / ${blue.legLanded}`,
            },
            {
              label: 'Counters',
              r: `${red.countersLanded}`,
              b: `${blue.countersLanded}`,
            },
            {
              label: 'Knockdowns',
              r: `${blue.knockdowns}`,
              b: `${red.knockdowns}`,
            },
          ].map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-3 items-center py-0.5 border-b border-white/5 last:border-b-0"
            >
              <span className="font-mono-tabular font-bold text-white">{row.r}</span>
              <span className="text-center text-[11px] text-white/60 uppercase tracking-wider">
                {row.label}
              </span>
              <span className="font-mono-tabular font-bold text-white text-right">
                {row.b}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={onRematch}
            className="flex-1 py-2.5 sm:py-3 bg-[#d92626] hover:bg-[#ef3333] text-white font-display font-extrabold text-lg uppercase tracking-wider transition-colors cursor-pointer"
          >
            Rematch
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="flex-1 py-2.5 sm:py-3 bg-[#191c25] hover:bg-[#232734] border border-white/15 text-white font-display font-bold text-lg uppercase tracking-wider transition-colors cursor-pointer"
          >
            Fighter Select
          </button>
        </div>
      </div>
    </div>
  );
};

interface ControlsModalProps {
  settings: ControlSettings;
  touchEnabled: boolean;
  onUpdateSettings: (next: ControlSettings) => void;
  onToggleTouchEnabled: () => void;
  onResetDefaults: () => void;
  onClose: () => void;
}

type ControlsTab = 'keyboard' | 'touch' | 'gamepad';

export const ControlsModal: React.FC<ControlsModalProps> = ({
  settings,
  touchEnabled,
  onUpdateSettings,
  onToggleTouchEnabled,
  onResetDefaults,
  onClose,
}) => {
  const [tab, setTab] = useState<ControlsTab>(() =>
    touchEnabled ? 'touch' : 'keyboard',
  );
  const [capturingAction, setCapturingAction] = useState<KeyboardAction | null>(
    null,
  );

  useEffect(() => {
    if (!capturingAction) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setCapturingAction(null);
        return;
      }
      const nextKb = { ...settings.keyboard };
      const oldCode = nextKb[capturingAction];
      for (const key of Object.keys(nextKb) as KeyboardAction[]) {
        if (key !== capturingAction && nextKb[key] === e.code) {
          nextKb[key] = oldCode;
        }
      }
      nextKb[capturingAction] = e.code;
      onUpdateSettings({ ...settings, keyboard: nextKb });
      setCapturingAction(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturingAction, onUpdateSettings, settings]);

  const gamepadRows = [
    ['Move / Lunge', 'Left Stick (Flick Edge)'],
    ['Jab / Cross', 'X / Square · Y / Triangle'],
    ['Leg Kicks', 'A / Cross · B / Circle'],
    ['Hooks / High Kicks', 'Hold LB / L1 + Face Button'],
    ['Body Strikes', 'Hold LT / L2 + Face Button'],
    ['Uppercut / Overhand / Spin', 'Hold LB+LT (or LB+RB) + Face'],
    ['High / Low Block', 'Hold RB / Hold RB + RT'],
    ['Strike Feint', 'Tap RB mid-windup'],
    ['Head Movement', 'Right Stick Flick / Hold'],
    ['Pause', 'Start / Options'],
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customize Controls"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/82 p-2.5 sm:p-4"
    >
      <div className="w-full max-w-3xl max-h-[94vh] flex flex-col bg-[#111319] border border-white/20 border-t-2 border-t-[#ff8e1c] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/15 px-4 sm:px-6 py-3 shrink-0">
          <div>
            <h2 className="font-display font-extrabold text-xl sm:text-2xl uppercase text-white tracking-wide leading-none">
              Customize Controls
            </h2>
            <p className="text-[11px] text-white/55 mt-0.5">
              Changes save automatically and apply immediately in the Octagon.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-xs font-bold uppercase text-white cursor-pointer min-h-[36px]"
          >
            Close
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className="grid grid-cols-3 bg-[#0a0c10] border-b border-white/15 p-1 gap-1 shrink-0"
          role="tablist"
          aria-label="Control Device Tabs"
        >
          {[
            { id: 'keyboard' as const, label: 'Keyboard', icon: Keyboard },
            { id: 'touch' as const, label: 'Mobile Touch', icon: Smartphone },
            { id: 'gamepad' as const, label: 'Gamepad', icon: Gamepad2 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setCapturingAction(null);
                setTab(id);
              }}
              className={`py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                tab === id
                  ? 'bg-[#ff8e1c] text-[#090a0d]'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Scrollable Tab Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {tab === 'keyboard' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/65 pb-2 border-b border-white/10">
                <span>
                  Click any key button below, then press a new key to rebind (Esc cancels).
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      ...settings,
                      keyboard: { ...DEFAULT_CONTROL_SETTINGS.keyboard },
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-white/15 border border-white/15 text-[11px] font-semibold text-white cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  Reset Keys
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {KEYBOARD_ACTION_LABELS.map(({ action, label }) => {
                  const isCapturing = capturingAction === action;
                  const code = settings.keyboard[action];
                  return (
                    <div
                      key={action}
                      className="flex items-center justify-between gap-2 px-3 py-2 bg-[#161922] border border-white/10"
                    >
                      <span className="text-xs font-medium text-white/90 truncate">
                        {label}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCapturingAction(isCapturing ? null : action)
                        }
                        aria-label={`Rebind ${label}`}
                        className={`min-w-[78px] px-2.5 py-1.5 text-xs font-mono-tabular font-bold uppercase border transition-colors cursor-pointer shrink-0 ${
                          isCapturing
                            ? 'bg-[#ff8e1c] border-[#ff8e1c] text-[#090a0d] animate-pulse'
                            : 'bg-[#0b0d12] hover:bg-[#1e2330] border-white/25 text-white'
                        }`}
                      >
                        {isCapturing ? 'Press Key' : formatKeyCode(code)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'touch' && (
            <div className="space-y-3.5">
              {/* Row 1: Overlay Toggle + Show Button Labels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 bg-[#161922] border border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-white">
                      On-Screen Touch Overlay
                    </div>
                    <div className="text-[11px] text-white/55">
                      Show virtual stick &amp; strike buttons in fight
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={touchEnabled}
                    onClick={onToggleTouchEnabled}
                    className={`px-3 py-1.5 text-xs font-extrabold uppercase cursor-pointer border min-w-[64px] ${
                      touchEnabled
                        ? 'bg-[#ff8e1c] border-[#ff8e1c] text-[#090a0d]'
                        : 'bg-[#0b0d12] border-white/25 text-white/75'
                    }`}
                  >
                    {touchEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="p-3 bg-[#161922] border border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-white">
                      Button Text Labels
                    </div>
                    <div className="text-[11px] text-white/55">
                      Show HEAVY / PUNCH / KICK / BLOCK captions
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={settings.touch.showLabels}
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        touch: {
                          ...settings.touch,
                          showLabels: !settings.touch.showLabels,
                        },
                      })
                    }
                    className={`px-3 py-1.5 text-xs font-extrabold uppercase cursor-pointer border min-w-[64px] ${
                      settings.touch.showLabels
                        ? 'bg-[#10b981] border-[#10b981] text-[#090a0d]'
                        : 'bg-[#0b0d12] border-white/25 text-white/75'
                    }`}
                  >
                    {settings.touch.showLabels ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Row 2: Style + Handedness + Joystick Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-[#161922] border border-white/10">
                  <div className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                    Button Style
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'arc' as const, label: 'Shadow Arc' },
                        { id: 'fourLimb' as const, label: '4-Limb Pro' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={settings.touch.preset === opt.id}
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            touch: { ...settings.touch, preset: opt.id },
                          })
                        }
                        className={`py-2 px-1.5 text-[11px] font-bold uppercase border cursor-pointer transition-colors ${
                          settings.touch.preset === opt.id
                            ? 'bg-white border-white text-[#0b0d12]'
                            : 'bg-[#0b0d12] border-white/20 text-white/75 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-[#161922] border border-white/10">
                  <div className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                    Side Swap
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'standard' as const, label: 'Stick Left' },
                        { id: 'leftHanded' as const, label: 'Stick Right' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={settings.touch.handedness === opt.id}
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            touch: { ...settings.touch, handedness: opt.id },
                          })
                        }
                        className={`py-2 px-1.5 text-[11px] font-bold uppercase border cursor-pointer transition-colors ${
                          settings.touch.handedness === opt.id
                            ? 'bg-white border-white text-[#0b0d12]'
                            : 'bg-[#0b0d12] border-white/20 text-white/75 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-[#161922] border border-white/10">
                  <div className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                    Joystick Tracking
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'fixed' as const, label: 'Fixed' },
                        { id: 'floating' as const, label: 'Floating' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={settings.touch.joystickMode === opt.id}
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            touch: { ...settings.touch, joystickMode: opt.id },
                          })
                        }
                        className={`py-2 px-1.5 text-[11px] font-bold uppercase border cursor-pointer transition-colors ${
                          settings.touch.joystickMode === opt.id
                            ? 'bg-white border-white text-[#0b0d12]'
                            : 'bg-[#0b0d12] border-white/20 text-white/75 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 3: Lunge Gesture & Modifier Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 bg-[#161922] border border-white/10">
                  <div className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                    Stick Lunge Trigger
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'flick' as const, label: 'Fast Flick' },
                        { id: 'doubleTap' as const, label: 'Double' },
                        { id: 'off' as const, label: 'Off' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={settings.touch.lungeMode === opt.id}
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            touch: {
                              ...settings.touch,
                              lungeMode: opt.id,
                              stickLunge: opt.id !== 'off',
                            },
                          })
                        }
                        className={`py-2 px-1.5 text-[11px] font-bold uppercase border cursor-pointer transition-colors ${
                          settings.touch.lungeMode === opt.id
                            ? 'bg-white border-white text-[#0b0d12]'
                            : 'bg-[#0b0d12] border-white/20 text-white/75 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-[#161922] border border-white/10">
                  <div className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                    HOOK &amp; BODY Modifiers
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'toggle' as const, label: 'Tap Toggle' },
                        { id: 'hold' as const, label: 'Hold Button' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={settings.touch.modifierBehavior === opt.id}
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            touch: {
                              ...settings.touch,
                              modifierBehavior: opt.id,
                            },
                          })
                        }
                        className={`py-2 px-1.5 text-[11px] font-bold uppercase border cursor-pointer transition-colors ${
                          settings.touch.modifierBehavior === opt.id
                            ? 'bg-white border-white text-[#0b0d12]'
                            : 'bg-[#0b0d12] border-white/20 text-white/75 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 4: Precision Sliders (Joystick Size, Button Size, Spacing, Deadzone, Edge Pad, Vertical Lift, Opacity) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <label className="p-2.5 bg-[#161922] border border-white/10 block">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-white mb-1">
                    <span>Joystick Size</span>
                    <span className="font-mono-tabular text-[#ff8e1c]">
                      {Math.round(settings.touch.joystickScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.75}
                    max={1.35}
                    step={0.05}
                    value={settings.touch.joystickScale}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        touch: {
                          ...settings.touch,
                          joystickScale: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#ff8e1c] cursor-pointer"
                  />
                </label>

                <label className="p-2.5 bg-[#161922] border border-white/10 block">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-white mb-1">
                    <span>Button Size</span>
                    <span className="font-mono-tabular text-[#ff8e1c]">
                      {Math.round(settings.touch.scale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.75}
                    max={1.35}
                    step={0.05}
                    value={settings.touch.scale}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        touch: {
                          ...settings.touch,
                          scale: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#ff8e1c] cursor-pointer"
                  />
                </label>

                <label className="p-2.5 bg-[#161922] border border-white/10 block">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-white mb-1">
                    <span>Button Spacing</span>
                    <span className="font-mono-tabular text-[#ff8e1c]">
                      {Math.round(settings.touch.buttonSpacing * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.85}
                    max={1.25}
                    step={0.05}
                    value={settings.touch.buttonSpacing}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        touch: {
                          ...settings.touch,
                          buttonSpacing: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#ff8e1c] cursor-pointer"
                  />
                </label>

                <label className="p-2.5 bg-[#161922] border border-white/10 block">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-white mb-1">
                    <span>Stick Deadzone</span>
                    <span className="font-mono-tabular text-[#ff8e1c]">
                      {Math.round(settings.touch.joystickDeadzone * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={0.28}
                    step={0.01}
                    value={settings.touch.joystickDeadzone}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        touch: {
                          ...settings.touch,
                          joystickDeadzone: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#ff8e1c] cursor-pointer"
                  />
                </label>

                <label className="p-2.5 bg-[#161922] border border-white/10 block">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-white mb-1">
                    <span>Edge Padding</span>
                    <span className="font-mono-tabular text-[#ff8e1c]">
                      {settings.touch.edgeMargin}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={36}
                    step={2}
                    value={settings.touch.edgeMargin}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        touch: {
                          ...settings.touch,
                          edgeMargin: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="w-full accent-[#ff8e1c] cursor-pointer"
                  />
                </label>

                <label className="p-2.5 bg-[#161922] border border-white/10 block">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-white mb-1">
                    <span>Vertical Lift</span>
                    <span className="font-mono-tabular text-[#ff8e1c]">
                      {settings.touch.verticalOffset}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={48}
                    step={2}
                    value={settings.touch.verticalOffset}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        touch: {
                          ...settings.touch,
                          verticalOffset: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="w-full accent-[#ff8e1c] cursor-pointer"
                  />
                </label>

                <label className="p-2.5 bg-[#161922] border border-white/10 block sm:col-span-2 lg:col-span-3">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-white mb-1">
                    <span>Controls Opacity</span>
                    <span className="font-mono-tabular text-[#ff8e1c]">
                      {Math.round(settings.touch.opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.35}
                    max={1}
                    step={0.05}
                    value={settings.touch.opacity}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        touch: {
                          ...settings.touch,
                          opacity: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#ff8e1c] cursor-pointer"
                  />
                </label>
              </div>

              {/* Mini Visual Layout Preview */}
              <div className="p-3 bg-[#0a0c10] border border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/55 mb-2">
                  Live Touch Layout ({settings.touch.preset === 'arc' ? 'Shadow Arc' : '4-Limb Pro'} · {settings.touch.joystickMode === 'floating' ? 'Floating Stick' : 'Fixed Stick'} · {settings.touch.handedness === 'leftHanded' ? 'Stick Right' : 'Stick Left'})
                </div>
                <div
                  className={`flex items-end justify-between h-20 px-4 py-2 bg-[#121620] border border-white/10 ${
                    settings.touch.handedness === 'leftHanded'
                      ? 'flex-row-reverse'
                      : 'flex-row'
                  }`}
                  style={{ opacity: settings.touch.opacity }}
                >
                  <div
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${
                      settings.touch.joystickMode === 'floating'
                        ? 'border-dashed border-white/55'
                        : 'border-white/60'
                    }`}
                    style={{ transform: `scale(${Math.min(1.15, Math.max(0.8, settings.touch.joystickScale))})` }}
                  >
                    <div className="w-5 h-5 rounded-full bg-white/45" />
                  </div>
                  <div
                    className="flex items-center"
                    style={{
                      gap: `${Math.round(6 * settings.touch.buttonSpacing)}px`,
                      transform: `scale(${Math.min(1.15, Math.max(0.8, settings.touch.scale))})`,
                    }}
                  >
                    {settings.touch.preset === 'fourLimb' ? (
                      <>
                        <div className="w-7 h-7 rounded-full border border-white/60 flex items-center justify-center text-[8px] font-bold">
                          JAB
                        </div>
                        <div className="w-7 h-7 rounded-full border border-white/60 flex items-center justify-center text-[8px] font-bold">
                          CRS
                        </div>
                        <div className="w-7 h-7 rounded-full border border-[#54a6ff] flex items-center justify-center text-[8px] font-bold">
                          LK
                        </div>
                        <div className="w-7 h-7 rounded-full border border-[#54a6ff] flex items-center justify-center text-[8px] font-bold">
                          RK
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-full border border-[#4ba3ff] flex items-center justify-center text-[8px] font-bold">
                          BLK
                        </div>
                        <div className="w-8 h-8 rounded-full border border-[#54a6ff] flex items-center justify-center text-[8px] font-bold">
                          KICK
                        </div>
                        <div className="w-9 h-9 rounded-full border-2 border-[#ff5d47] flex items-center justify-center text-[8px] font-bold">
                          HIT
                        </div>
                        <div className="w-8 h-8 rounded-full border border-[#ff8e1c] flex items-center justify-center text-[8px] font-bold">
                          HVY
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'gamepad' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="p-3 bg-[#161922] border border-white/10 block">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-white mb-1.5">
                    <span>Stick Deadzone</span>
                    <span className="font-mono-tabular text-[#54a6ff]">
                      {Math.round(settings.gamepad.deadzone * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={0.35}
                    step={0.01}
                    value={settings.gamepad.deadzone}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        gamepad: {
                          ...settings.gamepad,
                          deadzone: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#54a6ff] cursor-pointer"
                  />
                </label>

                <div className="p-3 bg-[#161922] border border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold uppercase text-white">
                      Swap Bumpers / Triggers
                    </div>
                    <div className="text-[11px] text-white/55">
                      LB/RB ↔ LT/RT
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={settings.gamepad.swapBumpersTriggers}
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        gamepad: {
                          ...settings.gamepad,
                          swapBumpersTriggers:
                            !settings.gamepad.swapBumpersTriggers,
                        },
                      })
                    }
                    className={`px-3 py-1.5 text-xs font-extrabold uppercase cursor-pointer border ${
                      settings.gamepad.swapBumpersTriggers
                        ? 'bg-[#54a6ff] border-[#54a6ff] text-[#090a0d]'
                        : 'bg-[#0b0d12] border-white/25 text-white/75'
                    }`}
                  >
                    {settings.gamepad.swapBumpersTriggers ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="p-3 bg-[#161922] border border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold uppercase text-white">
                      Invert Cage Strafe
                    </div>
                    <div className="text-[11px] text-white/55">
                      Flip Up/Down Left Stick
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={settings.gamepad.invertY}
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        gamepad: {
                          ...settings.gamepad,
                          invertY: !settings.gamepad.invertY,
                        },
                      })
                    }
                    className={`px-3 py-1.5 text-xs font-extrabold uppercase cursor-pointer border ${
                      settings.gamepad.invertY
                        ? 'bg-[#54a6ff] border-[#54a6ff] text-[#090a0d]'
                        : 'bg-[#0b0d12] border-white/25 text-white/75'
                    }`}
                  >
                    {settings.gamepad.invertY ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-white/5 text-xs bg-[#0b0d12] border border-white/10 px-3 py-1">
                {gamepadRows.map(([action, pad]) => (
                  <div
                    key={action}
                    className="flex items-center justify-between py-2 gap-3"
                  >
                    <span className="font-semibold text-white">{action}</span>
                    <span className="font-mono-tabular text-[#54a6ff] text-right">
                      {pad}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/15 px-4 sm:px-6 py-3 bg-[#0b0d12] shrink-0">
          <button
            type="button"
            onClick={() => {
              setCapturingAction(null);
              onResetDefaults();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/15 border border-white/15 text-xs font-bold uppercase text-white/80 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset All Defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-[#d92626] hover:bg-[#ef3333] text-white font-display font-bold text-base uppercase tracking-wider cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
