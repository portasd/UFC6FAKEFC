import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Play,
  Settings,
  Shuffle,
  SlidersHorizontal,
} from 'lucide-react';
import {
  FighterProfile,
  matchesRosterFilter,
  RosterFilter,
  UFC_ROSTER,
  WEIGHT_CLASS_OPTIONS,
} from '../game/fighters';
import {
  ArenaType,
  DIFFICULTY_LEVELS,
  DifficultyLevel,
  GameplayMode,
} from '../game/combatEngine';
import { getFighterFallbackPortraitUrl, getFighterPortraitUrl } from '../game/portraits';
import {
  CAMERA_PRESET_OPTIONS,
  CameraPreset,
} from '../game/controlSettings';
import { ControllerStatus } from '../game/inputHub';

export type TitleStep = 'menu' | 'setup' | 'select';

interface TitleOverlayProps {
  titleStep: TitleStep;
  redId: string;
  blueId: string;
  difficulty: DifficultyLevel;
  gameplayMode: GameplayMode;
  arena: ArenaType;
  maxRounds: number;
  weightFilter: RosterFilter;
  cameraPreset: CameraPreset;
  controller: ControllerStatus;
  onEnterSetup: () => void;
  onEnterSelect: () => void;
  onBackToMenu: () => void;
  onBackToSetup: () => void;
  onSelectRed: (id: string) => void;
  onSelectBlue: (id: string) => void;
  onSelectDifficulty: (d: DifficultyLevel) => void;
  onSelectGameplayMode: (m: GameplayMode) => void;
  onSelectArena: (a: ArenaType) => void;
  onSelectMaxRounds: (rounds: number) => void;
  onSelectWeightFilter: (filter: RosterFilter) => void;
  onSelectCameraPreset: (camera: CameraPreset) => void;
  onRandomize: () => void;
  onStartFight: () => void;
  onOpenControls: () => void;
}

const DIFFICULTY_ORDER: DifficultyLevel[] = [
  'rookie',
  'pro',
  'champion',
  'hallOfFamer',
  'legend',
];

function cycleIndex(curr: number, delta: number, len: number): number {
  return (curr + delta + len) % len;
}

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
  arena,
  maxRounds,
  weightFilter,
  cameraPreset,
  controller,
  onEnterSetup,
  onEnterSelect,
  onBackToMenu,
  onBackToSetup,
  onSelectRed,
  onSelectBlue,
  onSelectDifficulty,
  onSelectGameplayMode,
  onSelectArena,
  onSelectMaxRounds,
  onSelectWeightFilter,
  onSelectCameraPreset,
  onRandomize,
  onStartFight,
  onOpenControls,
}) => {
  const [mobileCorner, setMobileCorner] = useState<'red' | 'blue'>('red');

  const redFighter: FighterProfile =
    UFC_ROSTER.find((f) => f.id === redId) ?? UFC_ROSTER[0];
  const blueFighter: FighterProfile =
    UFC_ROSTER.find((f) => f.id === blueId) ?? UFC_ROSTER[1];

  const filteredRoster = useMemo(
    () => UFC_ROSTER.filter((f) => matchesRosterFilter(f, weightFilter)),
    [weightFilter],
  );

  const currentWeightIdx = Math.max(
    0,
    WEIGHT_CLASS_OPTIONS.findIndex((w) => w.id === weightFilter),
  );
  const currentWeight =
    WEIGHT_CLASS_OPTIONS[currentWeightIdx] ?? WEIGHT_CLASS_OPTIONS[0];

  const portraits = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of UFC_ROSTER) {
      map[f.id] = getFighterPortraitUrl(f);
    }
    return map;
  }, []);

  // =========================================================================
  // 1. MAIN MENU SCREEN
  // =========================================================================
  if (titleStep === 'menu') {
    return (
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between safe-area-pad">
        {/* Cinematic Left Dark Scrim (leaving fiery orange/red hero unobstructed on right) */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[78%] sm:w-[62%] bg-gradient-to-r from-[#070504]/95 via-[#090503]/68 to-transparent"
        />

        {/* TOP BAR (OFC 6 Top-Left Brand + Utility Controls) */}
        <div className="relative z-10 w-full px-4 sm:px-12 pt-4 sm:pt-7 short:pt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <span className="font-display font-extrabold italic text-3xl sm:text-4xl short:text-2xl tracking-tight text-white uppercase leading-none">
                OFC
              </span>
              <span className="px-2 py-0.5 bg-[#ff8e1c] text-[#090a0d] font-display font-extrabold italic text-xl sm:text-2xl short:text-lg leading-none">
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
              className="px-3.5 py-2.5 short:py-1.5 bg-black/65 hover:bg-black/85 border border-white/20 text-xs font-semibold text-white/95 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px] short:min-h-[40px]"
            >
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              <span>Controls</span>
            </button>
          </div>
        </div>

        {/* LEFT MAIN MENU COLUMN */}
        <div className="relative z-10 px-4 sm:px-12 my-auto pointer-events-auto max-w-[520px] short:max-w-[400px]">
          <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-white/60 mb-2.5 sm:mb-3 short:mb-1.5">
            PLAY MODES
          </div>

          <button
            type="button"
            data-start="true"
            onClick={onEnterSetup}
            className="group w-full text-left cursor-pointer transition-transform active:scale-[0.99]"
          >
            <div className="relative overflow-hidden bg-white text-[#0b0d12] px-4 sm:px-5 py-3.5 sm:py-4 short:py-2.5 flex items-center justify-between shadow-[0_14px_40px_rgba(0,0,0,0.65)] min-h-[64px] short:min-h-[52px]">
              <span className="font-display font-extrabold text-3xl sm:text-5xl short:text-3xl tracking-tight uppercase leading-none">
                FIGHT NOW
              </span>
              <div
                aria-hidden="true"
                className="w-20 sm:w-24 h-12 short:h-10 bg-gradient-to-r from-[#ff7a18] via-[#d92626] to-[#1a0c08] opacity-95 flex items-center justify-center skew-x-[-14deg] mr-[-10px]"
              >
                <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-current skew-x-[14deg]" />
              </div>
            </div>
          </button>
        </div>

        {/* BOTTOM PROMPT STRIP */}
        <div className="relative z-10 px-4 sm:px-12 pb-4 sm:pb-6 short:pb-2.5 flex items-center justify-between gap-2 text-xs text-white/80">
          <div className="flex items-center gap-2 font-semibold tracking-wider uppercase">
            <span className="w-5 h-5 rounded-full bg-white text-[#0b0d12] text-[11px] font-extrabold flex items-center justify-center shrink-0">
              A
            </span>
            <span className="hidden sm:inline">Enter · Select Fight Now</span>
            <span className="sm:hidden">Tap Fight Now</span>
          </div>

          <div className="flex items-center gap-2 text-white/75 bg-black/55 px-3 py-1.5 border border-white/15 truncate">
            <Gamepad2 className="w-3.5 h-3.5 text-[#ff8e1c] shrink-0" aria-hidden="true" />
            <span className="truncate">
              {controller.connected ? controller.name : 'Touch · Controller · Keyboard'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. UFC-STYLE MATCH SETUP SCREEN (After pressing FIGHT NOW)
  // =========================================================================
  if (titleStep === 'setup') {
    const isChampBout = maxRounds >= 5;
    const currentDiffIdx = Math.max(0, DIFFICULTY_ORDER.indexOf(difficulty));

    const cycleBoutFormat = () => {
      onSelectMaxRounds(isChampBout ? 3 : 5);
    };

    const cyclePreset = () => {
      onSelectGameplayMode(gameplayMode === 'arcade' ? 'simulation' : 'arcade');
    };

    const stepWeight = (delta: number) => {
      const next =
        WEIGHT_CLASS_OPTIONS[
          cycleIndex(currentWeightIdx, delta, WEIGHT_CLASS_OPTIONS.length)
        ];
      onSelectWeightFilter(next.id);
    };

    const stepDifficulty = (delta: number) => {
      const next =
        DIFFICULTY_ORDER[
          cycleIndex(currentDiffIdx, delta, DIFFICULTY_ORDER.length)
        ];
      onSelectDifficulty(next);
    };

    const arenaOrder: ArenaType[] = ['octagon', 'boxingRing', 'backyard'];
    const stepVenue = (delta: number) => {
      const idx = Math.max(0, arenaOrder.indexOf(arena));
      onSelectArena(arenaOrder[cycleIndex(idx, delta, arenaOrder.length)]);
    };

    const currentCamIdx = Math.max(
      0,
      CAMERA_PRESET_OPTIONS.findIndex((c) => c.id === cameraPreset),
    );
    const currentCam =
      CAMERA_PRESET_OPTIONS[currentCamIdx] ?? CAMERA_PRESET_OPTIONS[0];
    const stepCamera = (delta: number) => {
      const next =
        CAMERA_PRESET_OPTIONS[
          cycleIndex(currentCamIdx, delta, CAMERA_PRESET_OPTIONS.length)
        ];
      onSelectCameraPreset(next.id);
    };

    const venueLabel =
      arena === 'boxingRing'
        ? 'BOXING RING'
        : arena === 'backyard'
          ? 'BACKYARD'
          : 'UFC OCTAGON';
    const venueSub =
      arena === 'boxingRing'
        ? 'SQUARE CANVAS · 4-ROPE TURNBUCKLES'
        : arena === 'backyard'
          ? 'DIRT PIT · WOOD FENCE · FLOODLIGHTS'
          : '8-SIDED CAGE · CHAMPIONSHIP CANVAS';
    const venueColor =
      arena === 'boxingRing'
        ? 'text-[#54a6ff]'
        : arena === 'backyard'
          ? 'text-[#f4c038]'
          : 'text-[#ff5d47]';

    return (
      <div
        data-testid="match-setup-screen"
        className="fixed inset-0 z-20 flex flex-col justify-between safe-area-pad overflow-y-auto"
      >
        {/* Atmospheric Radial Scrim matching UFC Championship setup screen */}
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_42%,rgba(8,10,16,0.58)_0%,rgba(6,7,11,0.88)_100%)]"
        />

        {/* Top Spacer + Gold Square Badge + Full-Width Spotlight Mode Banner */}
        <div className="relative z-10 w-full pt-4 sm:pt-7 short:pt-1.5 shrink-0">
          {/* Top Centered Gold Square Emblem */}
          <div className="flex justify-center">
            <div className="w-16 h-12 sm:w-20 sm:h-14 short:w-12 short:h-8 bg-gradient-to-b from-[#f6d365] via-[#e2b33b] to-[#b9871c] shadow-[0_6px_22px_rgba(0,0,0,0.65)] flex items-center justify-center border border-[#fff2b2]/45">
              <span className="font-display font-extrabold italic text-2xl sm:text-3xl short:text-xl tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]">
                OFC
              </span>
            </div>
          </div>

          {/* Full-Width Horizontal Mode Strip with Gold Center Flare */}
          <div className="relative w-full border-y border-white/15 bg-[#090b10]/85 overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[92%] sm:w-[460px] bg-[radial-gradient(ellipse_at_center,rgba(244,192,56,0.92)_0%,rgba(220,152,20,0.48)_48%,transparent_78%)]"
            />

            <div className="relative z-10 max-w-2xl mx-auto px-2 sm:px-6 py-1.5 sm:py-2 short:py-0.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={cycleBoutFormat}
                aria-label="Previous Bout Format"
                className="w-11 h-11 short:w-9 short:h-9 flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-6 h-6" aria-hidden="true" />
              </button>

              <h1 className="font-display font-extrabold uppercase text-3xl sm:text-5xl short:text-2xl tracking-tight text-white leading-none text-center hud-text-stroke truncate">
                {isChampBout ? 'CHAMPIONSHIP' : 'STAND & BANG'}
              </h1>

              <button
                type="button"
                onClick={cycleBoutFormat}
                aria-label="Next Bout Format"
                className="w-11 h-11 short:w-9 short:h-9 flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <ChevronRight className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] sm:text-xs font-bold tracking-[0.22em] uppercase text-white/85 mt-2 short:mt-0.5 short:text-[10px] px-4 hud-text-stroke">
            {isChampBout
              ? 'DEFEND OR CHALLENGE FOR THE BELT · 5 ROUNDS'
              : 'CUSTOMIZE WEIGHT CLASS, DIFFICULTY & ARENA · 3 ROUNDS'}
          </p>
        </div>

        {/* Center Selector Stack (1-col tall mobile/desktop, 2x2 grid on short landscape phones) */}
        <div className="relative z-10 w-full max-w-[360px] sm:max-w-[400px] short:max-w-[720px] mx-auto px-4 my-auto py-3 short:py-1 space-y-2.5 sm:space-y-3 short:space-y-0 short:grid short:grid-cols-2 short:gap-x-3 short:gap-y-1.5">
          {/* 1. COMBAT PRESET */}
          <div>
            <div className="text-center text-[10px] short:text-[9px] font-bold tracking-[0.22em] uppercase text-white/75 mb-1 short:mb-0.5">
              COMBAT PRESET
            </div>
            <div className="flex items-center justify-between bg-[#0c0e14]/90 border border-white/25 min-h-[44px] short:min-h-[38px]">
              <button
                type="button"
                onClick={cyclePreset}
                aria-label="Previous Combat Preset"
                className="w-11 h-11 short:w-9 short:h-9 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={cyclePreset}
                data-testid="setup-preset-value"
                className="flex-1 py-2 short:py-1 font-display font-extrabold text-lg sm:text-xl short:text-base tracking-wider uppercase text-white text-center cursor-pointer"
              >
                {gameplayMode === 'arcade' ? 'ARCADE' : 'SIMULATION'}
              </button>
              <button
                type="button"
                onClick={cyclePreset}
                aria-label="Next Combat Preset"
                className="w-11 h-11 short:w-9 short:h-9 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* 2. WEIGHT CLASS */}
          <div>
            <div className="text-center text-[10px] short:text-[9px] font-bold tracking-[0.22em] uppercase text-white/75 mb-1 short:mb-0.5">
              WEIGHT CLASS
            </div>
            <div className="flex items-center justify-between bg-[#0c0e14]/90 border border-white/25 min-h-[44px] short:min-h-[38px]">
              <button
                type="button"
                onClick={() => stepWeight(-1)}
                aria-label="Previous Weight Class"
                className="w-11 h-11 short:w-9 short:h-9 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => stepWeight(1)}
                data-testid="setup-weight-value"
                className="flex-1 py-2 short:py-1 px-1 font-display font-extrabold text-lg sm:text-xl short:text-base tracking-wider uppercase text-white text-center truncate cursor-pointer"
              >
                {currentWeight.label}
              </button>
              <button
                type="button"
                onClick={() => stepWeight(1)}
                aria-label="Next Weight Class"
                className="w-11 h-11 short:w-9 short:h-9 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* 3. DIFFICULTY */}
          <div>
            <div className="text-center text-[10px] short:text-[9px] font-bold tracking-[0.22em] uppercase text-white/75 mb-1 short:mb-0.5">
              DIFFICULTY
            </div>
            <div className="flex items-center justify-between bg-[#0c0e14]/90 border border-white/25 min-h-[44px] short:min-h-[38px]">
              <button
                type="button"
                onClick={() => stepDifficulty(-1)}
                aria-label="Lower Difficulty"
                className="w-11 h-11 short:w-9 short:h-9 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => stepDifficulty(1)}
                data-testid="setup-difficulty-value"
                className="flex-1 py-2 short:py-1 font-display font-extrabold text-lg sm:text-xl short:text-base tracking-wider uppercase text-[#f4c038] text-center cursor-pointer"
              >
                {DIFFICULTY_LEVELS[difficulty].label}
              </button>
              <button
                type="button"
                onClick={() => stepDifficulty(1)}
                aria-label="Higher Difficulty"
                className="w-11 h-11 short:w-9 short:h-9 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* 4. VENUE / ARENA */}
          <div>
            <div className="text-center text-[10px] short:text-[9px] font-bold tracking-[0.22em] uppercase text-white/75 mb-1 short:mb-0.5">
              VENUE
            </div>
            <div className="flex items-center justify-between bg-[#0c0e14]/90 border border-white/25 min-h-[54px] short:min-h-[38px]">
              <button
                type="button"
                onClick={() => stepVenue(-1)}
                aria-label="Previous Venue"
                className="w-11 h-13 short:w-9 short:h-9 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => stepVenue(1)}
                data-testid="setup-venue-value"
                className="flex-1 py-2 short:py-0.5 px-2 flex flex-col items-center justify-center cursor-pointer"
              >
                <span
                  className={`font-display font-extrabold italic text-xl sm:text-2xl short:text-base tracking-wider uppercase leading-none ${venueColor}`}
                >
                  {venueLabel}
                </span>
                <span className="text-[9px] short:hidden font-bold tracking-[0.18em] uppercase text-white/65 mt-0.5">
                  {venueSub}
                </span>
              </button>
              <button
                type="button"
                onClick={() => stepVenue(1)}
                aria-label="Next Venue"
                className="w-11 h-13 short:w-9 short:h-9 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* 5. CAMERA ANGLE */}
          <div className="short:col-span-2">
            <div className="text-center text-[10px] short:text-[9px] font-bold tracking-[0.22em] uppercase text-white/75 mb-1 short:mb-0.5">
              CAMERA ANGLE
            </div>
            <div className="flex items-center justify-between bg-[#0c0e14]/90 border border-white/25 min-h-[44px] short:min-h-[38px]">
              <button
                type="button"
                onClick={() => stepCamera(-1)}
                aria-label="Previous Camera Angle"
                className="w-11 h-11 short:w-9 short:h-9 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => stepCamera(1)}
                data-testid="setup-camera-value"
                className="flex-1 py-2 short:py-1 font-display font-extrabold text-lg sm:text-xl short:text-base tracking-wider uppercase text-[#ff8e1c] text-center cursor-pointer"
              >
                {currentCam.label}
              </button>
              <button
                type="button"
                onClick={() => stepCamera(1)}
                aria-label="Next Camera Angle"
                className="w-11 h-11 short:w-9 short:h-9 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Primary Action Prompts right below selectors */}
          <div className="pt-2 short:pt-0.5 short:col-span-2 flex items-center justify-center gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={onEnterSelect}
              className="flex-1 min-h-[46px] short:min-h-[40px] px-4 py-2.5 short:py-1.5 bg-white hover:bg-slate-100 text-[#0b0d12] font-display font-extrabold text-lg short:text-base tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-transform active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              <span>START</span>
            </button>
            <button
              type="button"
              onClick={onOpenControls}
              className="min-h-[46px] short:min-h-[40px] px-3.5 py-2.5 short:py-1.5 bg-[#12151e]/90 hover:bg-[#1c212e] border border-white/25 text-white font-display font-bold text-base tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Settings className="w-4 h-4 text-[#ff8e1c]" aria-hidden="true" />
              <span>SETTINGS</span>
            </button>
          </div>
        </div>

        {/* Bottom Corner Controls & Info Card */}
        <div className="relative z-10 w-full px-4 sm:px-10 pb-3 sm:pb-6 short:pb-2 flex items-end justify-between gap-4 shrink-0">
          <button
            type="button"
            onClick={onBackToMenu}
            className="min-h-[44px] short:min-h-[38px] px-4 py-2 short:py-1.5 bg-[#0c0e14]/85 hover:bg-[#171b26] border border-white/20 text-xs font-bold tracking-wider uppercase text-white flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>BACK</span>
          </button>

          <div className="hidden sm:block short:hidden max-w-[290px] bg-[#0a0c12]/85 border border-white/20 p-3 text-left">
            <div className="font-display font-extrabold text-sm tracking-wider uppercase text-white leading-none mb-1">
              BOUT RULES
            </div>
            <p className="text-[11px] text-white/70 leading-snug">
              {maxRounds} Rounds ({gameplayMode === 'simulation' ? 'Tactical Simulation' : 'Fast Arcade'}) in{' '}
              <span className="text-white font-semibold">
                {arena === 'boxingRing'
                  ? 'Boxing Ring'
                  : arena === 'backyard'
                    ? 'Backyard Pit'
                    : 'UFC Octagon'}
              </span>{' '}
              at <span className="text-[#f4c038] font-semibold">{DIFFICULTY_LEVELS[difficulty].label}</span> difficulty.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. FIGHTER SELECTION SCREEN (Adaptive Mobile Corner-Switcher vs Desktop Split Stage)
  // =========================================================================
  const selectArenaLabel =
    arena === 'boxingRing'
      ? 'Boxing Ring'
      : arena === 'backyard'
        ? 'Backyard'
        : 'UFC Octagon';

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between overflow-hidden safe-area-pad">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[62%] lg:h-[48%] bg-gradient-to-t from-[#05060a] via-[#05060a]/92 to-transparent"
      />

      {/* TOP BAR */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-3 sm:px-5 pt-2.5 sm:pt-4 short:pt-1 flex items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onBackToSetup}
            className="px-3 py-2 short:py-1 bg-black/70 hover:bg-black/90 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap min-h-[44px] short:min-h-[34px]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Setup</span>
          </button>
        </div>

        <div className="mx-auto flex items-center gap-2 sm:gap-3.5 min-w-0">
          <div className="hidden sm:flex short:hidden px-2.5 py-1 bg-white text-[#0b0d12] items-center justify-center shadow-lg shrink-0 gap-1">
            <span className="font-display font-extrabold italic text-xs lg:text-sm leading-none tracking-tight">
              OFC
            </span>
            <span className="font-display font-extrabold italic text-xs lg:text-sm text-[#d92626] leading-none">
              6
            </span>
          </div>
          <div className="flex flex-col items-center min-w-0">
            <h1 className="font-display font-extrabold italic text-xl sm:text-3xl lg:text-4xl short:text-lg tracking-tight text-white uppercase leading-none hud-text-stroke truncate">
              FIGHTER SELECT
            </h1>
            <div className="text-[9px] sm:text-[10px] short:text-[9px] font-bold uppercase tracking-[0.18em] text-white/75 truncate">
              {currentWeight.label} · {selectArenaLabel} · {maxRounds}R · {DIFFICULTY_LEVELS[difficulty].label}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenControls}
            className="px-3 py-2 short:py-1 bg-black/70 hover:bg-black/90 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap min-h-[44px] short:min-h-[34px]"
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Controls</span>
          </button>
        </div>
      </div>

      {/* MOBILE / TABLET DEDICATED FIGHTER SELECT TRAY (< lg) */}
      <div className="relative z-10 flex lg:hidden flex-col gap-2 short:gap-1 w-full max-w-[920px] mx-auto px-3 sm:px-4 pb-3 short:pb-1.5 pointer-events-auto">
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
            className={`text-left px-3 py-2 short:py-0.5 min-h-[54px] short:min-h-[34px] border transition-colors cursor-pointer ${
              mobileCorner === 'red'
                ? 'bg-[#2a0e10]/95 border-[#ff4838] ring-1 ring-[#ff4838]/60'
                : 'bg-[#0c0e14]/85 border-white/15 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between gap-1 text-[9px] font-bold uppercase tracking-wider">
              <span className="text-[#ff5d47]">Red · You</span>
              <span className="font-mono-tabular text-white/65">
                {redFighter.stats.power}/{redFighter.stats.speed}/{redFighter.stats.chin}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1.5 mt-0.5">
              <span className="font-display font-extrabold italic text-base sm:text-lg short:text-sm uppercase text-white leading-none truncate">
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
            className={`text-right px-3 py-2 short:py-0.5 min-h-[54px] short:min-h-[34px] border transition-colors cursor-pointer ${
              mobileCorner === 'blue'
                ? 'bg-[#0e1b30]/95 border-[#3b8eff] ring-1 ring-[#3b8eff]/60'
                : 'bg-[#0c0e14]/85 border-white/15 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between gap-1 text-[9px] font-bold uppercase tracking-wider">
              <span className="font-mono-tabular text-white/65">
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
              <span className="font-display font-extrabold italic text-base sm:text-lg short:text-sm uppercase text-white leading-none truncate">
                {blueFighter.name}
              </span>
            </div>
          </button>
        </div>

        {/* Arena Quick Toggle */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/65 truncate">
            {filteredRoster.length} Fighters Available
          </span>

          <div className="flex items-center bg-[#0e1017] border border-white/20 p-0.5 gap-0.5 shrink-0">
            {(
              [
                { id: 'octagon' as const, label: 'Octagon', active: 'bg-white text-[#0b0d12]' },
                { id: 'boxingRing' as const, label: 'Ring', active: 'bg-[#2563eb] text-white' },
                { id: 'backyard' as const, label: 'Yard', active: 'bg-[#f4c038] text-[#090a0d]' },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={arena === v.id}
                onClick={() => onSelectArena(v.id)}
                className={`px-2.5 min-h-[30px] short:min-h-[24px] text-[10px] font-extrabold uppercase cursor-pointer ${
                  arena === v.id ? v.active : 'text-white/70'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Clean Mobile Roster Grid (4-col portrait / 9-col landscape square tiles) */}
        <div
          className="h-[208px] sm:h-[168px] short:h-[132px] overflow-y-auto pr-0.5"
          role="tabpanel"
          aria-label={
            mobileCorner === 'red'
              ? 'Select Fighter for Red Corner'
              : 'Select Fighter for Blue Corner'
          }
        >
          <div className="grid grid-cols-4 sm:grid-cols-7 short:grid-cols-9 gap-1.5 short:gap-1">
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
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = '1';
                        img.src = getFighterFallbackPortraitUrl(f);
                      }
                    }}
                    className="w-full aspect-square object-cover object-center pixelated block"
                  />
                  <div className="bg-[#090a0e]/95 px-1 py-0.5 flex items-center justify-between gap-0.5">
                    <span className="font-display font-bold text-[10px] short:text-[9px] tracking-wide uppercase text-white truncate">
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
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={onRandomize}
            aria-label="Randomize Matchup"
            className="min-w-[46px] min-h-[46px] short:min-w-[38px] short:min-h-[38px] bg-[#151822] hover:bg-[#222736] text-white border border-white/20 cursor-pointer shrink-0 flex items-center justify-center"
          >
            <Shuffle className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-start="true"
            onClick={onStartFight}
            className="flex-1 min-h-[46px] short:min-h-[38px] px-4 bg-[#d92626] hover:bg-[#ef3333] text-white font-display font-extrabold text-lg short:text-base tracking-wider uppercase cursor-pointer flex items-center justify-center gap-2 shadow-lg border border-[#ff705c]/45 whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>Enter Fight</span>
          </button>
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

        {/* SCROLLABLE ROSTER GRIDS + CENTER VS / MODE / DIFFICULTY / ENTER FIGHT */}
        <div className="pointer-events-auto grid grid-cols-12 gap-4 items-end">
          {/* LEFT SCROLLABLE PORTRAIT GRID */}
          <div className="col-span-5">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-widest uppercase text-white/75 mb-1 px-0.5">
              <span className="text-[#ff5d47]">Red Corner · You</span>
              <span className="text-white/55 font-mono-tabular">
                PWR {redFighter.stats.power} · SPD {redFighter.stats.speed} · CHN {redFighter.stats.chin}
              </span>
            </div>
            <div className="max-h-[192px] overflow-y-auto pr-0.5">
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
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = '1';
                            img.src = getFighterFallbackPortraitUrl(f);
                          }
                        }}
                        className="w-full aspect-square object-cover object-center pixelated block"
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

            {/* Arena & Pace Quick Pills */}
            <div className="w-full grid grid-cols-3 bg-[#0e1017] border border-white/20 p-0.5 gap-0.5">
              <button
                type="button"
                aria-pressed={arena === 'octagon'}
                onClick={() => onSelectArena('octagon')}
                className={`py-1 text-[10px] font-extrabold uppercase transition-colors cursor-pointer ${
                  arena === 'octagon'
                    ? 'bg-white text-[#0b0d12]'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Octagon
              </button>
              <button
                type="button"
                aria-pressed={arena === 'boxingRing'}
                onClick={() => onSelectArena('boxingRing')}
                className={`py-1 text-[10px] font-extrabold uppercase transition-colors cursor-pointer ${
                  arena === 'boxingRing'
                    ? 'bg-[#2563eb] text-white'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Ring
              </button>
              <button
                type="button"
                aria-pressed={arena === 'backyard'}
                onClick={() => onSelectArena('backyard')}
                className={`py-1 text-[10px] font-extrabold uppercase transition-colors cursor-pointer ${
                  arena === 'backyard'
                    ? 'bg-[#f4c038] text-[#090a0d]'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Backyard
              </button>
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
                {DIFFICULTY_ORDER.map((lvl) => (
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
            <div className="max-h-[192px] overflow-y-auto pr-0.5">
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
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = '1';
                            img.src = getFighterFallbackPortraitUrl(f);
                          }
                        }}
                        className="w-full aspect-square object-cover object-center pixelated block"
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
            Enter Fight · R Randomize · Esc Back · C Controls · {UFC_ROSTER.length} Fighters
          </div>
          <div className="px-2 py-0.5 bg-[#184f96]/35 border-r-2 border-[#3b8eff] text-white/85 font-semibold uppercase tracking-wider">
            CPU · {blueFighter.name}
          </div>
        </div>
      </div>
    </div>
  );
};
