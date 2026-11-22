import React, { useMemo, useState } from 'react';
import { ArrowLeft, Gamepad2, Play, Shuffle, SlidersHorizontal } from 'lucide-react';
import {
  FighterProfile,
  matchesRosterFilter,
  RosterFilter,
  UFC_ROSTER,
} from '../game/fighters';
import {
  DIFFICULTY_LEVELS,
  DifficultyLevel,
  GameplayMode,
} from '../game/combatEngine';
import { getFighterPortraitUrl } from '../game/portraits';
import { ControllerStatus } from '../game/inputHub';

export type TitleStep = 'menu' | 'select';

interface TitleOverlayProps {
  titleStep: TitleStep;
  redId: string;
  blueId: string;
  difficulty: DifficultyLevel;
  gameplayMode: GameplayMode;
  controller: ControllerStatus;
  onEnterSelect: () => void;
  onBackToMenu: () => void;
  onSelectRed: (id: string) => void;
  onSelectBlue: (id: string) => void;
  onSelectDifficulty: (d: DifficultyLevel) => void;
  onSelectGameplayMode: (m: GameplayMode) => void;
  onRandomize: () => void;
  onStartFight: () => void;
  onOpenControls: () => void;
}

const FILTER_OPTIONS: Array<{ id: RosterFilter; label: string }> = [
  { id: 'all', label: `All (${UFC_ROSTER.length})` },
  { id: 'light', label: 'Light · 135-155' },
  { id: 'mid', label: 'Mid · 170-185' },
  { id: 'heavy', label: 'Heavy · 205+' },
];

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.4;
  return (
    <div
      className="inline-flex items-center gap-0.5 text-white"
      aria-label={`${rating} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = i < full;
        const isHalf = !filled && i === full && half;
        return (
          <svg key={i} viewBox="0 0 20 20" className="w-3.5 h-3.5" aria-hidden="true">
            <path
              d="M10 1.8l2.5 5.1 5.6.8-4.1 4 1 5.6L10 14.6l-5 2.7 1-5.6-4.1-4 5.6-.8z"
              fill={filled ? '#ffffff' : isHalf ? '#b8bec9' : 'rgba(255,255,255,0.22)'}
            />
          </svg>
        );
      })}
    </div>
  );
}

function ChampSealBadge() {
  return (
    <svg
      viewBox="0 0 96 96"
      className="w-20 h-20 -rotate-12 drop-shadow-[0_6px_14px_rgba(0,0,0,0.65)] shrink-0"
      aria-label="OFC World Champion"
    >
      <polygon
        points="28,6 68,6 90,28 90,68 68,90 28,90 6,68 6,28"
        fill="url(#champGold)"
        stroke="#fff3c4"
        strokeWidth="2.5"
      />
      <polygon
        points="31,12 65,12 84,31 84,65 65,84 31,84 12,65 12,31"
        fill="none"
        stroke="#3c2a08"
        strokeWidth="2"
      />
      <defs>
        <linearGradient id="champGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5d57a" />
          <stop offset="50%" stopColor="#c59732" />
          <stop offset="100%" stopColor="#8f6618" />
        </linearGradient>
      </defs>
      <text
        x="48"
        y="34"
        textAnchor="middle"
        fill="#161106"
        fontSize="14"
        fontWeight="900"
        fontFamily="Barlow Condensed, sans-serif"
      >
        OFC
      </text>
      <text
        x="48"
        y="52"
        textAnchor="middle"
        fill="#161106"
        fontSize="11"
        fontWeight="800"
        fontFamily="Barlow Condensed, sans-serif"
      >
        WORLD
      </text>
      <text
        x="48"
        y="67"
        textAnchor="middle"
        fill="#161106"
        fontSize="10"
        fontWeight="800"
        fontFamily="Barlow Condensed, sans-serif"
      >
        CHAMPION
      </text>
    </svg>
  );
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  titleStep,
  redId,
  blueId,
  difficulty,
  gameplayMode,
  controller,
  onEnterSelect,
  onBackToMenu,
  onSelectRed,
  onSelectBlue,
  onSelectDifficulty,
  onSelectGameplayMode,
  onRandomize,
  onStartFight,
  onOpenControls,
}) => {
  const [mobileCorner, setMobileCorner] = useState<'red' | 'blue'>('red');
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('all');

  const redFighter: FighterProfile =
    UFC_ROSTER.find((f) => f.id === redId) ?? UFC_ROSTER[0];
  const blueFighter: FighterProfile =
    UFC_ROSTER.find((f) => f.id === blueId) ?? UFC_ROSTER[1];

  const filteredRoster = useMemo(
    () => UFC_ROSTER.filter((f) => matchesRosterFilter(f, rosterFilter)),
    [rosterFilter],
  );

  const portraits = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of UFC_ROSTER) {
      map[f.id] = getFighterPortraitUrl(f);
    }
    return map;
  }, []);

  if (titleStep === 'menu') {
    return (
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between safe-area-pad">
        {/* Cinematic Left Dark Scrim (leaving fiery orange/red hero unobstructed on right) */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[68%] sm:w-[62%] bg-gradient-to-r from-[#070504]/95 via-[#090503]/62 to-transparent"
        />

        {/* TOP BAR (OFC 6 Top-Left Brand + Utility Controls) */}
        <div className="relative z-10 w-full px-5 sm:px-12 pt-4 sm:pt-7 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <span className="font-display font-extrabold italic text-3xl sm:text-4xl tracking-tight text-white uppercase leading-none">
                OFC
              </span>
              <span className="px-2 py-0.5 bg-[#ff8e1c] text-[#090a0d] font-display font-extrabold italic text-xl sm:text-2xl leading-none">
                6
              </span>
            </div>

            <div className="hidden sm:block h-5 w-px bg-white/25" />

            <div className="hidden sm:block border-b-2 border-[#ff8e1c] pb-0.5 text-xs font-bold tracking-[0.2em] uppercase text-white">
              PLAY
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenControls}
              className="px-2.5 sm:px-3 py-1.5 bg-black/55 hover:bg-black/80 border border-white/20 text-xs font-semibold text-white/90 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[36px]"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Controls</span>
            </button>
          </div>
        </div>

        {/* LEFT MAIN MENU COLUMN */}
        <div className="relative z-10 px-5 sm:px-12 my-auto pointer-events-auto max-w-[520px]">
          <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-white/55 mb-2.5 sm:mb-3">
            PLAY MODES
          </div>

          <button
            type="button"
            data-start="true"
            onClick={onEnterSelect}
            className="group w-full text-left cursor-pointer transition-transform active:scale-[0.99]"
          >
            <div className="relative overflow-hidden bg-white text-[#0b0d12] px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between shadow-[0_14px_40px_rgba(0,0,0,0.65)]">
              <span className="font-display font-extrabold text-3xl sm:text-5xl tracking-tight uppercase leading-none">
                FIGHT NOW
              </span>
              <div
                aria-hidden="true"
                className="w-20 sm:w-24 h-11 sm:h-12 bg-gradient-to-r from-[#ff7a18] via-[#d92626] to-[#1a0c08] opacity-90 flex items-center justify-center skew-x-[-14deg] mr-[-10px]"
              >
                <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-current skew-x-[14deg]" />
              </div>
            </div>
          </button>
        </div>

        {/* BOTTOM PROMPT STRIP */}
        <div className="relative z-10 px-5 sm:px-12 pb-4 sm:pb-6 flex items-center justify-between gap-2 text-xs text-white/80">
          <div className="flex items-center gap-2 font-semibold tracking-wider uppercase">
            <span className="w-5 h-5 rounded-full bg-white text-[#0b0d12] text-[11px] font-extrabold flex items-center justify-center shrink-0">
              A
            </span>
            <span className="hidden sm:inline">Enter · Select Fight Now</span>
            <span className="sm:hidden">Tap Fight Now</span>
          </div>

          <div className="flex items-center gap-2 text-white/75 bg-black/50 px-2.5 sm:px-3 py-1 border border-white/15 truncate">
            <Gamepad2 className="w-3.5 h-3.5 text-[#ff8e1c] shrink-0" aria-hidden="true" />
            <span className="truncate">
              {controller.connected ? controller.name : 'Touch · Controller · Keyboard'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // FIGHTER SELECTION SCREEN (Adaptive Mobile Corner-Switcher vs Desktop Split Stage)
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between overflow-hidden safe-area-pad">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[58%] lg:h-[47%] bg-gradient-to-t from-[#05060a] via-[#05060a]/90 to-transparent"
      />

      {/* TOP BAR */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-3 sm:px-5 pt-2 sm:pt-4 flex items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onBackToMenu}
            className="px-2.5 sm:px-3 py-1.5 bg-black/65 hover:bg-black/85 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap min-h-[36px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Menu</span>
          </button>
        </div>

        <div className="mx-auto flex items-center gap-2 sm:gap-3.5 min-w-0">
          <div className="hidden sm:flex px-2.5 py-1 bg-white text-[#0b0d12] items-center justify-center shadow-lg shrink-0 gap-1">
            <span className="font-display font-extrabold italic text-xs lg:text-sm leading-none tracking-tight">
              OFC
            </span>
            <span className="font-display font-extrabold italic text-xs lg:text-sm text-[#d92626] leading-none">
              6
            </span>
          </div>
          <h1 className="font-display font-extrabold italic text-xl sm:text-3xl lg:text-4xl tracking-tight text-white uppercase leading-none hud-text-stroke truncate">
            FIGHTER SELECT
          </h1>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenControls}
            className="px-2.5 sm:px-3 py-1.5 bg-black/65 hover:bg-black/85 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap min-h-[36px]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Controls</span>
          </button>
        </div>
      </div>

      {/* MOBILE / TABLET DEDICATED FIGHTER SELECT TRAY (< lg) */}
      <div className="relative z-10 flex lg:hidden flex-col gap-1.5 w-full max-w-[920px] mx-auto px-2.5 sm:px-4 pb-2.5 pointer-events-auto">
        {/* Corner Picker Tabs */}
        <div
          className="grid grid-cols-2 gap-1.5"
          role="tablist"
          aria-label="Corner Selection Tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobileCorner === 'red'}
            onClick={() => setMobileCorner('red')}
            className={`text-left px-2.5 py-1.5 border transition-colors cursor-pointer ${
              mobileCorner === 'red'
                ? 'bg-[#2a0e10]/95 border-[#ff4838] ring-1 ring-[#ff4838]/60'
                : 'bg-[#0c0e14]/85 border-white/15 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between gap-1 text-[9px] font-bold uppercase tracking-wider">
              <span className="text-[#ff5d47]">Red · You</span>
              <span className="font-mono-tabular text-white/60">
                {redFighter.stats.power}/{redFighter.stats.speed}/{redFighter.stats.chin}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1.5 mt-0.5">
              <span className="font-display font-extrabold italic text-base sm:text-lg uppercase text-white leading-none truncate">
                {redFighter.name}
              </span>
              {mobileCorner === 'red' && (
                <span className="text-[9px] font-extrabold uppercase text-[#ff8e1c] shrink-0">
                  Picking
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mobileCorner === 'blue'}
            onClick={() => setMobileCorner('blue')}
            className={`text-right px-2.5 py-1.5 border transition-colors cursor-pointer ${
              mobileCorner === 'blue'
                ? 'bg-[#0e1b30]/95 border-[#3b8eff] ring-1 ring-[#3b8eff]/60'
                : 'bg-[#0c0e14]/85 border-white/15 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between gap-1 text-[9px] font-bold uppercase tracking-wider">
              <span className="font-mono-tabular text-white/60">
                {blueFighter.stats.power}/{blueFighter.stats.speed}/{blueFighter.stats.chin}
              </span>
              <span className="text-[#54a6ff]">Blue · CPU</span>
            </div>
            <div className="flex items-center justify-between gap-1.5 mt-0.5">
              {mobileCorner === 'blue' ? (
                <span className="text-[9px] font-extrabold uppercase text-[#54a6ff] shrink-0">
                  Picking
                </span>
              ) : (
                <span />
              )}
              <span className="font-display font-extrabold italic text-base sm:text-lg uppercase text-white leading-none truncate">
                {blueFighter.name}
              </span>
            </div>
          </button>
        </div>

        {/* Weight Filter + Arcade/Simulation Mode Row */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 overflow-x-auto" role="group" aria-label="Weight Division Filter">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={rosterFilter === opt.id}
                onClick={() => setRosterFilter(opt.id)}
                className={`px-2 py-1 text-[9px] font-bold uppercase whitespace-nowrap border cursor-pointer ${
                  rosterFilter === opt.id
                    ? 'bg-white text-[#0b0d12] border-white'
                    : 'bg-[#0e1017]/90 text-white/70 border-white/15'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div
            className="grid grid-cols-2 bg-[#0e1017] border border-white/20 p-0.5 gap-0.5 shrink-0"
            role="group"
            aria-label="Mobile Gameplay Mode"
          >
            {(
              [
                { id: 'arcade' as const, label: 'Arcade' },
                { id: 'simulation' as const, label: 'Sim' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={gameplayMode === m.id}
                onClick={() => onSelectGameplayMode(m.id)}
                className={`px-2.5 py-1 text-[9px] font-extrabold uppercase cursor-pointer ${
                  gameplayMode === m.id
                    ? 'bg-[#ff8e1c] text-[#090a0d]'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Clean Mobile Roster Grid (4-col portrait / 7-col landscape) */}
        <div
          className="h-[172px] sm:h-[116px] overflow-y-auto pr-0.5"
          role="tabpanel"
          aria-label={
            mobileCorner === 'red'
              ? 'Select Fighter for Red Corner'
              : 'Select Fighter for Blue Corner'
          }
        >
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {filteredRoster.map((f) => {
              const isRed = f.id === redId;
              const isBlue = f.id === blueId;
              const isActiveSelection =
                (mobileCorner === 'red' && isRed) ||
                (mobileCorner === 'blue' && isBlue);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-label={`Select ${f.name} for ${mobileCorner === 'red' ? 'Red' : 'Blue'} Corner`}
                  aria-pressed={isActiveSelection}
                  onClick={() =>
                    mobileCorner === 'red' ? onSelectRed(f.id) : onSelectBlue(f.id)
                  }
                  className={`relative overflow-hidden bg-[#141720] border cursor-pointer text-left transition-transform active:scale-[0.97] ${
                    isActiveSelection
                      ? mobileCorner === 'red'
                        ? 'border-2 border-[#ff4838] ring-1 ring-white/80 z-10'
                        : 'border-2 border-[#3b8eff] ring-1 ring-white/80 z-10'
                      : isRed || isBlue
                        ? 'border-white/55'
                        : 'border-white/20 opacity-85'
                  }`}
                >
                  <img
                    src={portraits[f.id]}
                    alt={f.name}
                    className="w-full h-11 sm:h-10 object-cover object-top block"
                  />
                  <div className="bg-[#090a0e]/95 px-1 py-0.5 flex items-center justify-between gap-0.5">
                    <span className="font-display font-bold text-[10px] tracking-wide uppercase text-white truncate">
                      {f.lastName}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {isRed && (
                        <span className="w-3 h-3 rounded-full bg-[#e02424] text-white text-[7px] font-extrabold flex items-center justify-center">
                          R
                        </span>
                      )}
                      {isBlue && (
                        <span className="w-3 h-3 rounded-full bg-[#2563eb] text-white text-[7px] font-extrabold flex items-center justify-center">
                          B
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sticky Mobile Action Footer */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 pt-0.5">
          <div className="flex-1 min-w-[200px]">
            <div
              className="grid grid-cols-5 bg-[#0e1017] border border-white/20 p-0.5 gap-0.5"
              role="group"
              aria-label="Mobile AI Difficulty"
            >
              {(
                ['rookie', 'pro', 'champion', 'hallOfFamer', 'legend'] as const
              ).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  aria-label={`${DIFFICULTY_LEVELS[lvl].label} difficulty`}
                  aria-pressed={difficulty === lvl}
                  onClick={() => onSelectDifficulty(lvl)}
                  className={`py-2 text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                    difficulty === lvl
                      ? 'bg-[#f4c038] text-[#0b0d12]'
                      : 'text-white/65 hover:text-white'
                  }`}
                >
                  {DIFFICULTY_LEVELS[lvl].shortLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onRandomize}
              aria-label="Randomize Matchup"
              className="py-2.5 px-3 bg-[#151822] hover:bg-[#222736] text-white border border-white/20 cursor-pointer shrink-0 flex items-center justify-center"
            >
              <Shuffle className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-start="true"
              onClick={onStartFight}
              className="flex-1 sm:flex-none sm:min-w-[165px] py-2.5 px-4 bg-[#d92626] hover:bg-[#ef3333] text-white font-display font-extrabold text-base tracking-wider uppercase cursor-pointer flex items-center justify-center gap-1.5 shadow-lg border border-[#ff705c]/45 whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              <span>Enter Fight</span>
            </button>
          </div>
        </div>
      </div>

      {/* DESKTOP LOWER SECTION (lg+) */}
      <div className="relative z-10 hidden lg:flex w-full max-w-[1380px] mx-auto px-6 pb-3 flex-col gap-2">
        {/* Corner Nameplates */}
        <div className="flex items-end justify-between gap-4">
          <div className="max-w-[360px]">
            <div className="flex items-center gap-2 mb-0.5">
              {redFighter.isChampion && (
                <span className="text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 bg-[#d4a64a] text-[#110d04]">
                  Champion
                </span>
              )}
              <span className="font-display font-bold text-xl tracking-wider uppercase text-white/95 leading-none hud-text-stroke">
                {redFighter.firstName}
              </span>
            </div>
            <h2 className="font-display font-extrabold italic text-5xl text-white uppercase leading-[0.88] tracking-tight hud-text-stroke">
              {redFighter.lastName}
            </h2>
            <div className="h-[4px] w-full bg-gradient-to-r from-[#e02424] via-[#dc2626] to-transparent mt-1 mb-1" />
            <div className="flex items-center gap-2.5 text-xs">
              <StarRating rating={redFighter.starRating} />
              <span className="font-display font-bold tracking-widest uppercase text-white/85">
                {redFighter.nickname}
              </span>
              <span className="text-white/55 font-mono-tabular">
                {redFighter.record} · {redFighter.stance}
              </span>
            </div>
          </div>

          <div className="flex items-end gap-3 text-right max-w-[420px]">
            <div>
              <div className="flex items-center justify-end gap-2 mb-0.5">
                <span className="font-display font-bold text-xl tracking-wider uppercase text-white/95 leading-none hud-text-stroke">
                  {blueFighter.firstName}
                </span>
              </div>
              <h2 className="font-display font-extrabold italic text-5xl text-white uppercase leading-[0.88] tracking-tight hud-text-stroke">
                {blueFighter.lastName}
              </h2>
              <div className="h-[4px] w-full bg-gradient-to-l from-[#2563eb] via-[#2563eb] to-transparent mt-1 mb-1" />
              <div className="flex items-center justify-end gap-2.5 text-xs">
                <span className="text-white/55 font-mono-tabular">
                  {blueFighter.record} · {blueFighter.stance}
                </span>
                <span className="font-display font-bold tracking-widest uppercase text-white/85">
                  {blueFighter.styleTag}
                </span>
                <StarRating rating={blueFighter.starRating} />
              </div>
            </div>
            {blueFighter.isChampion && (
              <div className="mb-1">
                <ChampSealBadge />
              </div>
            )}
          </div>
        </div>

        {/* DESKTOP WEIGHT DIVISION FILTER STRIP */}
        <div className="pointer-events-auto flex items-center justify-center gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={rosterFilter === opt.id}
              onClick={() => setRosterFilter(opt.id)}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                rosterFilter === opt.id
                  ? 'bg-white text-[#0b0d12] border-white'
                  : 'bg-[#0e1017]/90 text-white/65 border-white/15 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* SCROLLABLE 28-FIGHTER ROSTER GRIDS + CENTER VS / MODE / DIFFICULTY / ENTER FIGHT */}
        <div className="pointer-events-auto grid grid-cols-12 gap-4 items-end">
          {/* LEFT SCROLLABLE PORTRAIT GRID */}
          <div className="col-span-5">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-widest uppercase text-white/75 mb-1 px-0.5">
              <span className="text-[#ff5d47]">Red Corner · You</span>
              <span className="text-white/55 font-mono-tabular">
                PWR {redFighter.stats.power} · SPD {redFighter.stats.speed} · CHN {redFighter.stats.chin}
              </span>
            </div>
            <div className="max-h-[156px] overflow-y-auto pr-0.5">
              <div className="grid grid-cols-7 gap-1">
                {filteredRoster.map((f) => {
                  const selected = f.id === redId;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-label={`Select ${f.name} for Red Corner`}
                      aria-pressed={selected}
                      onClick={() => onSelectRed(f.id)}
                      className={`group relative overflow-hidden bg-[#141720] border transition-transform cursor-pointer text-left ${
                        selected
                          ? 'border-2 border-[#ff4838] ring-1 ring-white/80 z-10'
                          : 'border-white/20 hover:border-white/60 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={portraits[f.id]}
                        alt={f.name}
                        className="w-full h-12 object-cover object-center block"
                      />
                      <div className="bg-[#090a0e]/92 px-1 py-0.5 flex items-center justify-between">
                        <span className="font-display font-bold text-[9px] tracking-wide uppercase text-white truncate">
                          {f.lastName}
                        </span>
                        {selected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[#e02424] text-white text-[7px] font-bold flex items-center justify-center shrink-0">
                            R
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CENTER VS + GAMEPLAY MODE + DIFFICULTY + ENTER FIGHT */}
          <div className="col-span-2 flex flex-col items-center justify-end gap-1.5 text-center pb-0.5">
            <div className="font-display font-extrabold italic text-2xl leading-none tracking-tighter bg-gradient-to-b from-white via-slate-300 to-slate-500 bg-clip-text text-transparent select-none">
              VS
            </div>

            {/* Gameplay Pace Mode: Arcade vs Simulation */}
            <div className="w-full">
              <div
                className="w-full grid grid-cols-2 bg-[#0e1017] border border-white/20 p-0.5 gap-0.5"
                role="group"
                aria-label="Gameplay Mode"
              >
                {(
                  [
                    { id: 'arcade' as const, label: 'Arcade' },
                    { id: 'simulation' as const, label: 'Simulation' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={gameplayMode === m.id}
                    onClick={() => onSelectGameplayMode(m.id)}
                    className={`py-1 text-[10px] font-extrabold uppercase transition-colors cursor-pointer ${
                      gameplayMode === m.id
                        ? 'bg-[#ff8e1c] text-[#0b0d12]'
                        : 'text-white/65 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {gameplayMode === 'simulation' && (
                <div className="text-[9px] text-[#ff8e1c]/90 font-medium mt-0.5 leading-tight">
                  Tactical pace · Slower footwork &amp; stamina regen
                </div>
              )}
            </div>

            <div className="w-full">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#f4c038] mb-0.5">
                {DIFFICULTY_LEVELS[difficulty].label} AI
              </div>
              <div
                className="w-full grid grid-cols-5 bg-[#0e1017] border border-white/20 p-0.5 gap-0.5"
                role="group"
                aria-label="AI Difficulty"
              >
                {(
                  ['rookie', 'pro', 'champion', 'hallOfFamer', 'legend'] as const
                ).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    aria-label={`${DIFFICULTY_LEVELS[lvl].label} difficulty`}
                    aria-pressed={difficulty === lvl}
                    onClick={() => onSelectDifficulty(lvl)}
                    className={`py-1 text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                      difficulty === lvl
                        ? 'bg-white text-[#0b0d12]'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {DIFFICULTY_LEVELS[lvl].shortLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full flex items-center gap-1.5">
              <button
                type="button"
                data-start="true"
                onClick={onStartFight}
                className="flex-1 py-2.5 px-3 bg-[#d92626] hover:bg-[#ef3333] text-white font-display font-extrabold text-base tracking-wider uppercase transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-lg border border-[#ff705c]/45 whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                Enter Fight
              </button>
              <button
                type="button"
                onClick={onRandomize}
                title="Randomize Matchup (R)"
                aria-label="Randomize Matchup"
                className="py-2.5 px-2.5 bg-[#151822] hover:bg-[#222736] text-white border border-white/20 transition-colors cursor-pointer shrink-0"
              >
                <Shuffle className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* RIGHT SCROLLABLE PORTRAIT GRID */}
          <div className="col-span-5">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-widest uppercase text-white/75 mb-1 px-0.5">
              <span className="text-white/55 font-mono-tabular">
                PWR {blueFighter.stats.power} · SPD {blueFighter.stats.speed} · CHN {blueFighter.stats.chin}
              </span>
              <span className="text-[#4ea2ff]">Blue Corner · Opponent</span>
            </div>
            <div className="max-h-[156px] overflow-y-auto pr-0.5">
              <div className="grid grid-cols-7 gap-1">
                {filteredRoster.map((f) => {
                  const selected = f.id === blueId;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-label={`Select ${f.name} for Blue Corner`}
                      aria-pressed={selected}
                      onClick={() => onSelectBlue(f.id)}
                      className={`group relative overflow-hidden bg-[#141720] border transition-transform cursor-pointer text-left ${
                        selected
                          ? 'border-2 border-[#3b8eff] ring-1 ring-white/80 z-10'
                          : 'border-white/20 hover:border-white/60 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={portraits[f.id]}
                        alt={f.name}
                        className="w-full h-12 object-cover object-center block"
                      />
                      <div className="bg-[#090a0e]/92 px-1 py-0.5 flex items-center justify-between">
                        <span className="font-display font-bold text-[9px] tracking-wide uppercase text-white truncate">
                          {f.lastName}
                        </span>
                        {selected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] text-white text-[7px] font-bold flex items-center justify-center shrink-0">
                            B
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM PROMPT BAR */}
        <div className="flex items-center justify-between text-[11px] text-white/60 pt-1 border-t border-white/10">
          <div className="px-2 py-0.5 bg-[#9e1a1a]/35 border-l-2 border-[#e02424] text-white/85 font-semibold uppercase tracking-wider">
            You · {redFighter.name}
          </div>
          <div className="tracking-wide text-white/65">
            Enter Fight · R Randomize · Esc Back · C Controls · {UFC_ROSTER.length} UFC Fighters
          </div>
          <div className="px-2 py-0.5 bg-[#184f96]/35 border-r-2 border-[#3b8eff] text-white/85 font-semibold uppercase tracking-wider">
            CPU · {blueFighter.name}
          </div>
        </div>
      </div>
    </div>
  );
};
