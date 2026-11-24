import React from 'react';
import { Gamepad2 } from 'lucide-react';
import { BoutState, formatFightClock } from '../game/combatEngine';
import {
  DEFAULT_CONTROL_SETTINGS,
  formatKeyCode,
  KeyboardAction,
} from '../game/controlSettings';

export interface HudDomRefs {
  clockEl: HTMLDivElement | null;
  roundEl: HTMLDivElement | null;
  momentumPipEl: HTMLDivElement | null;
  redHeadBar: HTMLDivElement | null;
  redBodyBar: HTMLDivElement | null;
  redLegBar: HTMLDivElement | null;
  redStaminaBar: HTMLDivElement | null;
  redBlockBar: HTMLDivElement | null;
  blueHeadBar: HTMLDivElement | null;
  blueBodyBar: HTMLDivElement | null;
  blueLegBar: HTMLDivElement | null;
  blueStaminaBar: HTMLDivElement | null;
  blueBlockBar: HTMLDivElement | null;
  calloutEl: HTMLDivElement | null;
  comboEl: HTMLDivElement | null;
  rockedFlashEl: HTMLDivElement | null;
  redCutBadge: HTMLDivElement | null;
  blueCutBadge: HTMLDivElement | null;
  bloodVignetteEl: HTMLDivElement | null;
}

export function syncHudDom(refs: HudDomRefs, bout: BoutState) {
  const r = bout.fighters[0];
  const b = bout.fighters[1];

  const pct = (val: number, max: number) =>
    `${Math.max(0, Math.min(100, (val / Math.max(1, max)) * 100)).toFixed(1)}%`;

  if (refs.redHeadBar) refs.redHeadBar.style.width = pct(r.headHp, r.maxHeadHp);
  if (refs.redBodyBar) refs.redBodyBar.style.width = pct(r.bodyHp, r.maxBodyHp);
  if (refs.redLegBar) refs.redLegBar.style.width = pct(r.legHp, r.maxLegHp);
  if (refs.redStaminaBar) refs.redStaminaBar.style.width = pct(r.stamina, r.maxStamina);
  if (refs.redBlockBar) refs.redBlockBar.style.width = pct(r.blockHealth, r.maxBlockHealth);

  if (refs.blueHeadBar) refs.blueHeadBar.style.width = pct(b.headHp, b.maxHeadHp);
  if (refs.blueBodyBar) refs.blueBodyBar.style.width = pct(b.bodyHp, b.maxBodyHp);
  if (refs.blueLegBar) refs.blueLegBar.style.width = pct(b.legHp, b.maxLegHp);
  if (refs.blueStaminaBar) refs.blueStaminaBar.style.width = pct(b.stamina, b.maxStamina);
  if (refs.blueBlockBar) refs.blueBlockBar.style.width = pct(b.blockHealth, b.maxBlockHealth);

  if (refs.clockEl) {
    const txt = formatFightClock(bout.roundTimeRemaining);
    if (refs.clockEl.textContent !== txt) refs.clockEl.textContent = txt;
  }
  if (refs.roundEl) {
    const rTxt = `R${bout.round}`;
    if (refs.roundEl.textContent !== rTxt) refs.roundEl.textContent = rTxt;
  }
  if (refs.momentumPipEl) {
    const shift = Math.max(-44, Math.min(44, bout.momentum * 44));
    refs.momentumPipEl.style.transform = `translateX(${shift.toFixed(1)}px)`;
  }

  if (refs.calloutEl) {
    if (bout.calloutTimer > 0 && bout.calloutText) {
      refs.calloutEl.style.opacity = '1';
      refs.calloutEl.textContent = bout.calloutText;
      refs.calloutEl.dataset.corner = bout.calloutCorner;
    } else {
      refs.calloutEl.style.opacity = '0';
    }
  }

  if (refs.comboEl) {
    if (r.comboCount >= 2 && r.comboResetTimer > 0) {
      refs.comboEl.style.opacity = '1';
      refs.comboEl.textContent = `${r.comboCount} HIT COMBO`;
    } else {
      refs.comboEl.style.opacity = '0';
    }
  }

  if (refs.rockedFlashEl) {
    if (bout.rockedFlashTimer > 0) {
      const fade = Math.min(1, bout.rockedFlashTimer / 0.85);
      const pulse = 0.8 + 0.2 * Math.sin(bout.rockedFlashTimer * 12);
      refs.rockedFlashEl.style.opacity = (fade * pulse * 0.94).toFixed(3);
    } else {
      refs.rockedFlashEl.style.opacity = '0';
    }
  }

  if (refs.redCutBadge) {
    const sev = r.headCutSeverity;
    if (sev >= 0.25) {
      refs.redCutBadge.style.opacity = '1';
      const label = sev >= 0.72 ? 'HEAVY BLEED' : 'CUT';
      if (refs.redCutBadge.textContent !== label) refs.redCutBadge.textContent = label;
    } else {
      refs.redCutBadge.style.opacity = '0';
    }
  }

  if (refs.blueCutBadge) {
    const sev = b.headCutSeverity;
    if (sev >= 0.25) {
      refs.blueCutBadge.style.opacity = '1';
      const label = sev >= 0.72 ? 'HEAVY BLEED' : 'CUT';
      if (refs.blueCutBadge.textContent !== label) refs.blueCutBadge.textContent = label;
    } else {
      refs.blueCutBadge.style.opacity = '0';
    }
  }

  if (refs.bloodVignetteEl) {
    if (r.headCutSeverity >= 0.42) {
      const intensity = Math.min(0.42, (r.headCutSeverity - 0.38) * 0.68);
      refs.bloodVignetteEl.style.opacity = intensity.toFixed(3);
    } else {
      refs.bloodVignetteEl.style.opacity = '0';
    }
  }
}

interface BroadcastHudProps {
  redName: string;
  blueName: string;
  maxRounds: number;
  currentRound: number;
  simulationMode?: boolean;
  controllerConnected: boolean;
  touchControlsEnabled: boolean;
  keyboardBindings?: Record<KeyboardAction, string>;
  hudRefs: React.MutableRefObject<HudDomRefs>;
  onPause?: () => void;
}

function HeadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
      <path d="M12 2.5c3.3 0 5.5 2.4 5.5 6 0 2.5-.9 4.5-2.1 5.6v1.9l2.4 1.3c.7.4 1.2 1.2 1.2 2v1.7H5v-1.7c0-.8.5-1.6 1.2-2l2.4-1.3v-1.9C7.4 13 6.5 11 6.5 8.5c0-3.6 2.2-6 5.5-6z" />
    </svg>
  );
}

function BodyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
      <path d="M6.5 4h11l1.8 4.2-2.6 1.2-.9-2.2V20H8.2V7.2l-.9 2.2-2.6-1.2L6.5 4z" />
    </svg>
  );
}

function LegIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
      <path d="M8.5 3h5.2l-1.3 8.2 3.4 7.8-2.8 1.2-3.4-7.5-1.1 7.3H5.8L8.5 3z" />
    </svg>
  );
}

function CornerDiamond({ color }: { color: 'red' | 'blue' }) {
  const bg =
    color === 'red'
      ? 'bg-gradient-to-br from-[#dc3522] to-[#7c150c] border-[#ff725e]/60'
      : 'bg-gradient-to-br from-[#2778d9] to-[#10366b] border-[#7cb8ff]/60';
  return (
    <div
      className={`w-10 h-10 rotate-45 border-2 shadow-lg flex items-center justify-center shrink-0 ${bg}`}
      aria-hidden="true"
    >
      <div className="-rotate-45 grid grid-cols-3 gap-0.5 w-4 h-4 opacity-90">
        <span />
        <span className="bg-white rounded-full w-1 h-1 mx-auto" />
        <span />
        <span className="bg-white rounded-full w-1 h-1 my-auto" />
        <span className="bg-white/60 rounded-full w-1 h-1 m-auto" />
        <span className="bg-white rounded-full w-1 h-1 my-auto ml-auto" />
        <span />
        <span className="bg-white rounded-full w-1 h-1 mx-auto" />
        <span />
      </div>
    </div>
  );
}

export const BroadcastHud: React.FC<BroadcastHudProps> = ({
  redName,
  blueName,
  maxRounds,
  currentRound,
  simulationMode = false,
  controllerConnected,
  touchControlsEnabled,
  keyboardBindings = DEFAULT_CONTROL_SETTINGS.keyboard,
  hudRefs,
  onPause,
}) => {
  return (
    <>
      {/* Subtle Crimson Screen-Edge Bleed Vignette */}
      <div
        ref={(el) => {
          hudRefs.current.bloodVignetteEl = el;
        }}
        aria-hidden="true"
        className="fixed inset-0 z-10 pointer-events-none transition-opacity duration-200"
        style={{
          opacity: 0,
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(120, 8, 12, 0) 56%, rgba(135, 10, 14, 0.55) 86%, rgba(92, 4, 8, 0.88) 100%)',
        }}
      />
      {/* Prolonged Orange-to-Crimson Red-Edge Rocked Screen Impact Flash */}
      <div
        ref={(el) => {
          hudRefs.current.rockedFlashEl = el;
        }}
        aria-hidden="true"
        className="fixed inset-0 z-10 pointer-events-none"
        style={{
          opacity: 0,
          background:
            'radial-gradient(ellipse at 50% 48%, rgba(255, 134, 0, 0.22) 20%, rgba(255, 78, 0, 0.52) 56%, rgba(196, 12, 8, 0.9) 100%)',
          boxShadow: 'inset 0 0 140px rgba(212, 14, 8, 0.9)',
        }}
      />
      <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2 sm:p-5 short:p-1.5 safe-area-pad">
      {/* Top Broadcast Bar */}
      <div className="w-full max-w-[1380px] mx-auto flex items-start justify-between gap-1.5 sm:gap-3">
        {/* TOP-LEFT: RED CORNER */}
        <div className="flex items-start gap-2 sm:gap-3 flex-1 max-w-[440px] min-w-0">
          <div className="hidden sm:block short:hidden pt-1 pl-1">
            <CornerDiamond color="red" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Thin Guard / Block Bar */}
            <div className="h-1.5 w-full bg-black/75 border border-white/15 mb-1 overflow-hidden">
              <div
                ref={(el) => {
                  hudRefs.current.redBlockBar = el;
                }}
                className="h-full bg-slate-200 transition-[width] duration-75"
                style={{ width: '100%' }}
              />
            </div>

            {/* 3 Vitality Segments: Head, Body, Leg */}
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5 mb-1">
              {[
                { key: 'head', icon: <HeadIcon />, refName: 'redHeadBar' as const },
                { key: 'body', icon: <BodyIcon />, refName: 'redBodyBar' as const },
                { key: 'leg', icon: <LegIcon />, refName: 'redLegBar' as const },
              ].map((seg) => (
                <div
                  key={seg.key}
                  className="flex items-center bg-black/80 border border-white/20 h-3.5 sm:h-4 overflow-hidden"
                >
                  <div className="w-3.5 sm:w-5 h-full bg-[#15171d] text-slate-200 flex items-center justify-center border-r border-white/15 shrink-0">
                    {seg.icon}
                  </div>
                  <div className="flex-1 h-full bg-[#242730] relative">
                    <div
                      ref={(el) => {
                        hudRefs.current[seg.refName] = el;
                      }}
                      className="h-full bg-[#10c96f] relative z-10 transition-[width] duration-75"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Amber Stamina Bar */}
            <div className="h-2 sm:h-2.5 w-full bg-black/85 border border-white/20 mb-1 overflow-hidden">
              <div
                ref={(el) => {
                  hudRefs.current.redStaminaBar = el;
                }}
                className="h-full bg-gradient-to-r from-[#d49617] to-[#f4c038] transition-[width] duration-75"
                style={{ width: '100%' }}
              />
            </div>

            {/* Crimson Nameplate */}
            <div className="bg-gradient-to-r from-[#9e1a1a] via-[#7f1313] to-[#3b0c0c]/90 px-2 sm:px-2.5 py-0.5 border-l-2 border-[#ff5640] flex items-center justify-between gap-1.5">
              <span className="font-display font-bold tracking-wider text-xs sm:text-base text-white uppercase hud-text-stroke block truncate">
                {redName}
              </span>
              <div
                ref={(el) => {
                  hudRefs.current.redCutBadge = el;
                }}
                className="shrink-0 px-1.5 py-0.5 bg-[#4a0408]/90 border border-[#ff3d4d]/70 text-[#ff8793] font-display font-bold text-[9px] sm:text-[10px] tracking-widest uppercase transition-opacity duration-150 opacity-0"
              >
                CUT
              </div>
            </div>
          </div>
        </div>

        {/* TOP-CENTER: ROUND, CLOCK & MOMENTUM */}
          <div
            onDoubleClick={onPause}
            className="flex flex-col items-center shrink-0 px-1 sm:px-2 pt-0.5 select-none"
          >
            {/* Momentum Tick Meter */}
            <div className="w-16 sm:w-28 h-2 flex items-center justify-center relative mb-1">
              <div className="w-full h-[2px] bg-white/30" />
              <div
                ref={(el) => {
                  hudRefs.current.momentumPipEl = el;
                }}
                className="absolute w-3 h-2 bg-[#4ba3ff] border border-white/80 transition-transform duration-150"
              />
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5">
              <div
                ref={(el) => {
                  hudRefs.current.roundEl = el;
                }}
                className="bg-white text-[#0c0e13] font-display font-extrabold text-[11px] sm:text-xs px-1.5 py-0.5 leading-none tracking-wider"
              >
                R{currentRound}
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1">
                {Array.from({ length: maxRounds }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1 h-2.5 sm:h-3 ${
                      i + 1 <= currentRound ? 'bg-white' : 'bg-white/25'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div
              ref={(el) => {
                hudRefs.current.clockEl = el;
              }}
              className="font-display font-extrabold text-xl sm:text-3xl short:text-lg leading-none text-white tabular-nums hud-text-stroke tracking-tight"
            >
              3:00
            </div>
            {simulationMode && (
              <div className="mt-0.5 text-[8px] sm:text-[9px] font-bold tracking-[0.18em] uppercase text-[#ff8e1c] hud-text-stroke">
                SIM
              </div>
            )}
          </div>

        {/* TOP-RIGHT: BLUE CORNER */}
        <div className="flex items-start gap-2 sm:gap-3 flex-1 max-w-[440px] min-w-0">
          <div className="flex-1 min-w-0">
            {/* Thin Guard / Block Bar */}
            <div className="h-1.5 w-full bg-black/75 border border-white/15 mb-1 overflow-hidden">
              <div
                ref={(el) => {
                  hudRefs.current.blueBlockBar = el;
                }}
                className="h-full bg-slate-200 ml-auto transition-[width] duration-75"
                style={{ width: '100%' }}
              />
            </div>

            {/* 3 Vitality Segments (Mirrored: Leg, Body, Head toward center) */}
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5 mb-1">
              {[
                { key: 'leg', icon: <LegIcon />, refName: 'blueLegBar' as const },
                { key: 'body', icon: <BodyIcon />, refName: 'blueBodyBar' as const },
                { key: 'head', icon: <HeadIcon />, refName: 'blueHeadBar' as const },
              ].map((seg) => (
                <div
                  key={seg.key}
                  className="flex items-center bg-black/80 border border-white/20 h-3.5 sm:h-4 overflow-hidden"
                >
                  <div className="flex-1 h-full bg-[#242730] relative">
                    <div
                      ref={(el) => {
                        hudRefs.current[seg.refName] = el;
                      }}
                      className="h-full bg-[#10c96f] ml-auto transition-[width] duration-75"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="w-3.5 sm:w-5 h-full bg-[#15171d] text-slate-200 flex items-center justify-center border-l border-white/15 shrink-0">
                    {seg.icon}
                  </div>
                </div>
              ))}
            </div>

            {/* Amber Stamina Bar */}
            <div className="h-2 sm:h-2.5 w-full bg-black/85 border border-white/20 mb-1 overflow-hidden">
              <div
                ref={(el) => {
                  hudRefs.current.blueStaminaBar = el;
                }}
                className="h-full bg-gradient-to-l from-[#d49617] to-[#f4c038] ml-auto transition-[width] duration-75"
                style={{ width: '100%' }}
              />
            </div>

            {/* Blue Nameplate */}
            <div className="bg-gradient-to-l from-[#18529c] via-[#133e77] to-[#0a1d38]/90 px-2 sm:px-2.5 py-0.5 border-r-2 border-[#4ea2ff] flex items-center justify-between gap-1.5">
              <div
                ref={(el) => {
                  hudRefs.current.blueCutBadge = el;
                }}
                className="shrink-0 px-1.5 py-0.5 bg-[#4a0408]/90 border border-[#ff3d4d]/70 text-[#ff8793] font-display font-bold text-[9px] sm:text-[10px] tracking-widest uppercase transition-opacity duration-150 opacity-0"
              >
                CUT
              </div>
              <span className="font-display font-bold tracking-wider text-xs sm:text-base text-white uppercase hud-text-stroke block truncate ml-auto">
                {blueName}
              </span>
            </div>
          </div>

          <div className="hidden sm:block short:hidden pt-1 pr-1">
            <CornerDiamond color="blue" />
          </div>
        </div>
      </div>

      {/* Dynamic Callout & Combo Overlay (Non-occluding) */}
      <div className="flex flex-col items-center justify-center pointer-events-none">
        <div
          ref={(el) => {
            hudRefs.current.calloutEl = el;
          }}
          className="font-display font-extrabold italic text-4xl sm:text-5xl tracking-wider uppercase text-white hud-text-stroke transition-opacity duration-150 opacity-0 data-[corner=red]:text-[#ff5d47] data-[corner=blue]:text-[#54a6ff]"
        />
        <div
          ref={(el) => {
            hudRefs.current.comboEl = el;
          }}
          className="mt-1 font-display font-bold text-lg tracking-widest uppercase text-[#f4c038] hud-text-stroke transition-opacity duration-150 opacity-0"
        />
      </div>

      {/* Bottom Keyboard Legend (Desktop only when touch controls off) */}
      <div className="w-full max-w-[1380px] mx-auto flex items-end justify-between gap-3">
        {!touchControlsEnabled ? (
          <div className="hidden md:flex text-[11px] font-medium text-white/90 tracking-wide bg-[#090a0d]/80 px-3 py-1.5 border border-white/15 items-center gap-3">
            <span>
              {formatKeyCode(keyboardBindings.circleUp)}
              {formatKeyCode(keyboardBindings.moveBack)}
              {formatKeyCode(keyboardBindings.circleDown)}
              {formatKeyCode(keyboardBindings.moveForward)} Move ·{' '}
              {formatKeyCode(keyboardBindings.leadPunch)}/{formatKeyCode(keyboardBindings.rearPunch)}/{formatKeyCode(keyboardBindings.leadKick)}/{formatKeyCode(keyboardBindings.rearKick)} Strikes ·{' '}
              {formatKeyCode(keyboardBindings.hookMod)} Hooks ·{' '}
              {formatKeyCode(keyboardBindings.bodyMod)} Body ·{' '}
              {formatKeyCode(keyboardBindings.block)} Block/Feint · Arrows Head Move · V Cam · {formatKeyCode(keyboardBindings.pause)} Pause
            </span>
            {controllerConnected && (
              <span className="inline-flex items-center gap-1 text-[#4ea2ff]">
                <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
                Controller Active
              </span>
            )}
          </div>
        ) : null}
      </div>
      </div>
    </>
  );
};
