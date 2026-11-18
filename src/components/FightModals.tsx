import React from 'react';
import { BoutState } from '../game/combatEngine';

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
      <div className="w-full max-w-md bg-[#111319] border border-white/20 border-t-2 border-t-[#d92626] p-6 shadow-2xl">
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
  const winnerIdx = bout.koWinnerIndex ?? 0;
  const winner = bout.fighters[winnerIdx];
  const red = bout.fighters[0];
  const blue = bout.fighters[1];
  const isPlayerWinner = winnerIdx === 0;

  const acc = (landed: number, thrown: number) =>
    thrown > 0 ? `${Math.round((landed / thrown) * 100)}%` : '0%';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Official Bout Result"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/78 p-4"
    >
      <div
        className={`w-full max-w-xl bg-[#101218] border border-white/20 border-t-4 ${
          winnerIdx === 0 ? 'border-t-[#d92626]' : 'border-t-[#2563eb]'
        } p-6 sm:p-7 shadow-2xl`}
      >
        <div className="flex items-baseline justify-between gap-4 border-b border-white/15 pb-4 mb-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/60">
              {isPlayerWinner ? 'Victory · Official Decision' : 'Defeat · Official Decision'}
            </div>
            <h2 className="font-display font-extrabold text-4xl uppercase text-white tracking-tight mt-0.5">
              {winner.profile.name}
            </h2>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display font-extrabold text-2xl text-[#f4c038]">
              {bout.koMethod ?? 'KO'}
            </div>
            <div className="text-xs font-mono-tabular text-white/65">
              {bout.koFinishTime}
            </div>
          </div>
        </div>

        {/* Stat Comparison Table */}
        <div className="space-y-2.5 text-sm mb-6">
          <div className="grid grid-cols-3 text-xs uppercase tracking-wider text-white/55 pb-1 border-b border-white/10">
            <span className="text-[#ff5d47] font-bold">{red.profile.name}</span>
            <span className="text-center">Fight Stats</span>
            <span className="text-right text-[#54a6ff] font-bold">{blue.profile.name}</span>
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
              className="grid grid-cols-3 items-center py-1 border-b border-white/5"
            >
              <span className="font-mono-tabular font-bold text-white">{row.r}</span>
              <span className="text-center text-xs text-white/60 uppercase tracking-wider">
                {row.label}
              </span>
              <span className="font-mono-tabular font-bold text-white text-right">
                {row.b}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onRematch}
            className="flex-1 py-3 bg-[#d92626] hover:bg-[#ef3333] text-white font-display font-extrabold text-lg uppercase tracking-wider transition-colors cursor-pointer"
          >
            Rematch
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="flex-1 py-3 bg-[#191c25] hover:bg-[#232734] border border-white/15 text-white font-display font-bold text-lg uppercase tracking-wider transition-colors cursor-pointer"
          >
            Fighter Select
          </button>
        </div>
      </div>
    </div>
  );
};

interface ControlsModalProps {
  onClose: () => void;
}

export const ControlsModal: React.FC<ControlsModalProps> = ({ onClose }) => {
  const bindings = [
    ['Move / Directional Lunge', 'W A S D (2x Tap Lunge)', 'Left Stick (Flick Lunge)'],
    ['Lead Jab / Rear Cross', 'J  /  I', 'X / Square  ·  Y / Triangle'],
    ['Lead Leg / Rear Leg Kick', 'K  /  L', 'A / Cross  ·  B / Circle'],
    ['Hooks & Roundhouse Kicks', 'Shift + J / I / K / L', 'LB / L1 + Face Button'],
    ['Body Punches & Body Kicks', 'Ctrl + J / I / K / L', 'LT / L2 + Face Button'],
    ['Uppercuts / Overhand / Spin', 'Shift + Ctrl + J / I / K / L', 'LB + LT (or RB + LB) + Face'],
    ['High Block / Low Block', 'Space  /  Space + Ctrl', 'RB (R1)  /  RB + RT (R1 + R2)'],
    ['Strike Feint / Cancel', 'Tap Space mid-windup', 'Tap RB / R1 mid-windup'],
    ['Head Movement (Slip/Duck/Pull)', 'Arrow Keys (Hold/Tap)', 'Right Stick Flick / Hold'],
    ['Pause Bout', 'Esc / P', 'Start / Options'],
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Striking Controls"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="w-full max-w-2xl bg-[#111319] border border-white/20 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-4">
          <h2 className="font-display font-extrabold text-2xl uppercase text-white tracking-wide">
            EA UFC Striking &amp; Controls
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold uppercase text-white cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-3 text-[11px] font-bold uppercase tracking-wider text-white/55 pb-2 border-b border-white/10">
          <span>Action</span>
          <span>Keyboard Fallback</span>
          <span>Xbox / PlayStation</span>
        </div>

        <div className="divide-y divide-white/5 text-xs sm:text-sm my-2">
          {bindings.map(([action, kb, pad]) => (
            <div key={action} className="grid grid-cols-3 py-2 gap-2 items-center">
              <span className="font-semibold text-white">{action}</span>
              <span className="font-mono-tabular text-white/80">{kb}</span>
              <span className="font-mono-tabular text-[#54a6ff]">{pad}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-white/60 mt-4">
          Pro Tip: Rapidly queue strikes during swings to blend combos (e.g. J → I → Shift+J → L). Slip or duck with Arrow Keys / Right Stick to open a 0.3s Pull-Counter window!
        </p>
      </div>
    </div>
  );
};
