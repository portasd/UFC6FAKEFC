import React, { useMemo } from 'react';
import { ArrowLeft, Gamepad2, Play, Shuffle, SlidersHorizontal } from 'lucide-react';
import { FighterProfile, UFC_ROSTER } from '../game/fighters';
import { ControllerStatus } from '../game/inputHub';

export type TitleStep = 'menu' | 'select';

interface TitleOverlayProps {
  titleStep: TitleStep;
  redId: string;
  blueId: string;
  difficulty: 'pro' | 'champion' | 'legend';
  controller: ControllerStatus;
  onEnterSelect: () => void;
  onBackToMenu: () => void;
  onSelectRed: (id: string) => void;
  onSelectBlue: (id: string) => void;
  onSelectDifficulty: (d: 'pro' | 'champion' | 'legend') => void;
  onRandomize: () => void;
  onStartFight: () => void;
  onOpenControls: () => void;
}

const portraitCache = new Map<string, string>();

function getFighterPortraitUrl(profile: FighterProfile): string {
  const cached = portraitCache.get(profile.id);
  if (cached) return cached;
  if (typeof document === 'undefined') return '';

  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 104;
  const ctx = c.getContext('2d');
  if (!ctx) return '';

  // Dramatic dark studio backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, 104);
  bg.addColorStop(0, '#2a303e');
  bg.addColorStop(1, '#0d0f15');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 104);

  const rim = ctx.createRadialGradient(84, 42, 6, 80, 48, 60);
  rim.addColorStop(0, 'rgba(255, 224, 196, 0.22)');
  rim.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, 160, 104);

  ctx.save();
  ctx.translate(80, 4);
  ctx.scale(0.76, 0.76);

  const skin = profile.appearance.skinHex;
  const hair = profile.appearance.hairHex;

  // Muscular Shoulders & Traps scaled subtly by buildScale
  const sw = 58 * profile.buildScale;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-sw, 134);
  ctx.quadraticCurveTo(-44 * profile.buildScale, 92, -16, 86);
  ctx.lineTo(16, 86);
  ctx.quadraticCurveTo(44 * profile.buildScale, 92, sw, 134);
  ctx.closePath();
  ctx.fill();

  // Neck shadow + Traps
  ctx.fillStyle = 'rgba(20, 9, 5, 0.28)';
  ctx.fillRect(-15, 72, 30, 26);
  ctx.fillStyle = skin;
  ctx.fillRect(-13, 68, 26, 26);

  // Chest tattoo hints tailored per fighter
  const ts = profile.appearance.tattooStyle;
  if (ts === 'hollowayFull' || ts === 'poirierFull' || ts === 'fullSleeveChest') {
    ctx.fillStyle = 'rgba(18, 25, 32, 0.56)';
    ctx.fillRect(-38, 100, 32, 22);
    ctx.fillRect(6, 100, 32, 22);
  } else if (ts === 'mcgregorChest') {
    ctx.fillStyle = 'rgba(18, 25, 32, 0.58)';
    ctx.beginPath();
    ctx.arc(0, 114, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c88c38';
    ctx.fillRect(-8, 95, 16, 5);
  } else if (ts === 'omalleyChest') {
    ctx.fillStyle = 'rgba(30, 68, 72, 0.55)';
    ctx.beginPath();
    ctx.moveTo(-36, 104);
    ctx.lineTo(0, 126);
    ctx.lineTo(36, 104);
    ctx.closePath();
    ctx.fill();
  } else if (ts === 'chestBand' || ts === 'oliveiraChest') {
    ctx.strokeStyle = 'rgba(20, 28, 36, 0.62)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-34, 112);
    ctx.quadraticCurveTo(0, 100, 34, 112);
    ctx.stroke();
  }

  // Ears
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(-25, 47, 4.8, 8.8, 0, 0, Math.PI * 2);
  ctx.ellipse(25, 47, 4.8, 8.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sculpted Athletic Face + Square Jawline
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-23.5, 33);
  ctx.quadraticCurveTo(-24, 14, 0, 13);
  ctx.quadraticCurveTo(24, 14, 23.5, 33);
  ctx.lineTo(21, 59);
  ctx.quadraticCurveTo(15, 76, 0, 77);
  ctx.quadraticCurveTo(-15, 76, -21, 59);
  ctx.closePath();
  ctx.fill();

  // Dramatic right-to-left studio shading on face
  const sideShade = ctx.createLinearGradient(-24, 20, 24, 72);
  sideShade.addColorStop(0, 'rgba(12, 5, 3, 0.34)');
  sideShade.addColorStop(0.5, 'rgba(0,0,0,0)');
  sideShade.addColorStop(1, 'rgba(255, 224, 198, 0.14)');
  ctx.fillStyle = sideShade;
  ctx.fill();

  // Hair style
  if (profile.appearance.hairStyle !== 'shaved') {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(0, 19, 23.5, 11.5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    if (profile.appearance.hairStyle === 'textured') {
      ctx.beginPath();
      ctx.ellipse(0, 14, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (profile.appearance.hairStyle === 'fade') {
      ctx.fillRect(-22, 18, 44, 6);
    } else {
      ctx.fillRect(-21, 19, 42, 4.5);
    }
  }

  // Intense Eyebrows & Orbital Shading
  ctx.strokeStyle = hair;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-17, 37);
  ctx.quadraticCurveTo(-10, 34, -4, 37);
  ctx.moveTo(4, 37);
  ctx.quadraticCurveTo(10, 34, 17, 37);
  ctx.stroke();

  for (const ex of [-10.5, 10.5]) {
    ctx.fillStyle = 'rgba(20, 8, 5, 0.25)';
    ctx.beginPath();
    ctx.arc(ex, 43, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ddd6cd';
    ctx.beginPath();
    ctx.ellipse(ex, 43, 4.1, 2.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#18100c';
    ctx.beginPath();
    ctx.arc(ex, 43, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nose & Mouth
  ctx.fillStyle = 'rgba(22, 9, 5, 0.28)';
  ctx.beginPath();
  ctx.moveTo(0, 41);
  ctx.lineTo(-4.2, 55);
  ctx.lineTo(4.2, 55);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(38, 14, 12, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 63);
  ctx.lineTo(8, 63);
  ctx.stroke();

  // Facial hair
  const fh = profile.appearance.facialHair;
  if (fh === 'fullBeard') {
    ctx.fillStyle = hair;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(-21, 49);
    ctx.quadraticCurveTo(-18, 78, 0, 80);
    ctx.quadraticCurveTo(18, 78, 21, 49);
    ctx.lineTo(15, 59);
    ctx.quadraticCurveTo(0, 67, -15, 59);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 58.5, 9, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (fh === 'goatee') {
    ctx.fillStyle = hair;
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.ellipse(0, 70, 8.2, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 58.5, 8, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (fh === 'stubble') {
    ctx.fillStyle = 'rgba(18, 14, 14, 0.26)';
    ctx.beginPath();
    ctx.moveTo(-20, 52);
    ctx.quadraticCurveTo(0, 79, 20, 52);
    ctx.lineTo(14, 68);
    ctx.quadraticCurveTo(0, 75, -14, 68);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  const dataUrl = c.toDataURL('image/png');
  portraitCache.set(profile.id, dataUrl);
  return dataUrl;
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
      aria-label="UFC World Champion"
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
        UFC
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
  controller,
  onEnterSelect,
  onBackToMenu,
  onSelectRed,
  onSelectBlue,
  onSelectDifficulty,
  onRandomize,
  onStartFight,
  onOpenControls,
}) => {
  const redFighter: FighterProfile =
    UFC_ROSTER.find((f) => f.id === redId) ?? UFC_ROSTER[0];
  const blueFighter: FighterProfile =
    UFC_ROSTER.find((f) => f.id === blueId) ?? UFC_ROSTER[1];

  const portraits = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of UFC_ROSTER) {
      map[f.id] = getFighterPortraitUrl(f);
    }
    return map;
  }, []);

  if (titleStep === 'menu') {
    return (
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between">
        {/* Cinematic Left Dark Scrim (leaving fiery orange/red hero Max Holloway unobstructed on right!) */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[62%] bg-gradient-to-r from-[#070504]/95 via-[#090503]/62 to-transparent"
        />

        {/* TOP BAR (matching image_c94e6796.png top-left header) */}
        <div className="relative z-10 w-full px-8 sm:px-12 pt-7 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white text-[#0b0d12] flex items-center justify-center font-display font-extrabold italic text-sm leading-none">
                UFC
              </div>
              <span className="font-display font-extrabold italic text-2xl sm:text-3xl tracking-tight text-white uppercase leading-none">
                STAND &amp; BANG
              </span>
            </div>

            <div className="h-5 w-px bg-white/25" />

            <div className="border-b-2 border-[#ff8e1c] pb-0.5 text-xs font-bold tracking-[0.2em] uppercase text-white">
              PLAY
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenControls}
              className="px-3 py-1.5 bg-black/55 hover:bg-black/80 border border-white/20 text-xs font-semibold text-white/90 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              Controls
            </button>
          </div>
        </div>

        {/* LEFT MAIN MENU COLUMN: ONLY "FIGHT NOW" BUTTON (matching image_c94e6796.png) */}
        <div className="relative z-10 px-8 sm:px-12 my-auto pointer-events-auto max-w-[520px]">
          <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-white/55 mb-3">
            PLAY MODES
          </div>

          <button
            type="button"
            data-start="true"
            onClick={onEnterSelect}
            className="group w-full text-left cursor-pointer transition-transform active:scale-[0.99]"
          >
            <div className="relative overflow-hidden bg-white text-[#0b0d12] px-5 py-3.5 flex items-center justify-between shadow-[0_14px_40px_rgba(0,0,0,0.65)]">
              <span className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight uppercase leading-none">
                FIGHT NOW
              </span>
              <div
                aria-hidden="true"
                className="w-24 h-12 bg-gradient-to-r from-[#ff7a18] via-[#d92626] to-[#1a0c08] opacity-90 flex items-center justify-center skew-x-[-14deg] mr-[-10px]"
              >
                <Play className="w-6 h-6 text-white fill-current skew-x-[14deg]" />
              </div>
            </div>

            <div className="bg-[#0e0a07]/90 border-t-2 border-[#ff8e1c] px-4 py-2 text-xs text-white/85 flex items-center gap-2">
              <span className="text-[#ff8e1c] font-bold">▸</span>
              <span>
                Step inside the Octagon — Select UFC Fighters, Difficulty &amp; Brawl
              </span>
            </div>
          </button>
        </div>

        {/* BOTTOM PROMPT STRIP (matching image_c94e6796.png bottom bar) */}
        <div className="relative z-10 px-8 sm:px-12 pb-6 flex items-center justify-between text-xs text-white/80">
          <div className="flex items-center gap-2 font-semibold tracking-wider uppercase">
            <span className="w-5 h-5 rounded-full bg-white text-[#0b0d12] text-[11px] font-extrabold flex items-center justify-center">
              A
            </span>
            <span>Enter · Select Fight Now</span>
          </div>

          <div className="flex items-center gap-2 text-white/75 bg-black/50 px-3 py-1 border border-white/15">
            <Gamepad2 className="w-3.5 h-3.5 text-[#ff8e1c]" aria-hidden="true" />
            <span>
              {controller.connected ? controller.name : 'Controller + Keyboard Ready'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // FIGHTER SELECTION SCREEN (Split Crimson Red vs Royal Blue Stage)
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-t from-[#05060a] via-[#05060a]/85 to-transparent"
      />

      {/* TOP BAR */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-5 pt-4 sm:pt-5 flex items-start justify-between">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToMenu}
            className="px-3 py-1.5 bg-black/65 hover:bg-black/85 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Menu
          </button>
        </div>

        <div className="mx-auto flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-white text-[#0b0d12] flex flex-col items-center justify-center shadow-lg shrink-0 border-2 border-white/80">
            <span className="font-display font-extrabold italic text-sm leading-none tracking-tight">
              UFC
            </span>
            <span className="text-[6px] font-bold tracking-widest uppercase leading-none mt-0.5">
              SB
            </span>
          </div>
          <h1 className="font-display font-extrabold italic text-3xl sm:text-4xl tracking-tight text-white uppercase leading-none hud-text-stroke">
            FIGHTER SELECT
          </h1>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenControls}
            className="px-3 py-1.5 bg-black/65 hover:bg-black/85 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            Controls
          </button>
        </div>
      </div>

      {/* LOWER SECTION */}
      <div className="relative z-10 w-full max-w-[1380px] mx-auto px-4 sm:px-6 pb-3 flex flex-col gap-2">
        {/* Corner Nameplates */}
        <div className="flex items-end justify-between gap-4">
          <div className="max-w-[360px]">
            <div className="flex items-center gap-2 mb-0.5">
              {redFighter.isChampion && (
                <span className="text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 bg-[#d4a64a] text-[#110d04]">
                  Champion
                </span>
              )}
              <span className="font-display font-bold text-lg sm:text-xl tracking-wider uppercase text-white/95 leading-none hud-text-stroke">
                {redFighter.firstName}
              </span>
            </div>
            <h2 className="font-display font-extrabold italic text-4xl sm:text-5xl text-white uppercase leading-[0.88] tracking-tight hud-text-stroke">
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
                <span className="font-display font-bold text-lg sm:text-xl tracking-wider uppercase text-white/95 leading-none hud-text-stroke">
                  {blueFighter.firstName}
                </span>
              </div>
              <h2 className="font-display font-extrabold italic text-4xl sm:text-5xl text-white uppercase leading-[0.88] tracking-tight hud-text-stroke">
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
              <div className="hidden sm:block mb-1">
                <ChampSealBadge />
              </div>
            )}
          </div>
        </div>

        {/* 2x6 ROSTER GRIDS + CENTER VS / DIFFICULTY / ENTER FIGHT */}
        <div className="pointer-events-auto grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-end">
          {/* LEFT 2x6 PORTRAIT GRID */}
          <div className="lg:col-span-5">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-widest uppercase text-white/75 mb-1 px-0.5">
              <span className="text-[#ff5d47]">Red Corner · You</span>
              <span className="text-white/55 font-mono-tabular">
                PWR {redFighter.stats.power} · SPD {redFighter.stats.speed} · CHN {redFighter.stats.chin}
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
              {UFC_ROSTER.map((f) => {
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
                        ? 'border-2 border-[#ff4838] ring-1 ring-white/80 scale-[1.04] z-10'
                        : 'border-white/20 hover:border-white/60 opacity-85 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={portraits[f.id]}
                      alt={f.name}
                      className="w-full h-12 sm:h-14 object-cover object-center block"
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

          {/* CENTER VS + ENTER FIGHT */}
          <div className="lg:col-span-2 flex flex-col items-center justify-end gap-2 text-center pb-0.5">
            <div className="text-[10px] font-bold tracking-widest uppercase text-white/75 leading-tight">
              {redFighter.weightClass.split('·')[0].trim()}
              <div className="text-[9px] text-white/45 font-medium">
                MAIN EVENT · OCTAGON
              </div>
            </div>

            <div className="font-display font-extrabold italic text-3xl leading-none tracking-tighter bg-gradient-to-b from-white via-slate-300 to-slate-500 bg-clip-text text-transparent select-none">
              VS
            </div>

            <div className="w-full grid grid-cols-3 bg-[#0e1017] border border-white/20 p-0.5">
              {(['pro', 'champion', 'legend'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onSelectDifficulty(lvl)}
                  className={`py-1 text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                    difficulty === lvl
                      ? 'bg-white text-[#0b0d12]'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
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

          {/* RIGHT 2x6 PORTRAIT GRID */}
          <div className="lg:col-span-5">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-widest uppercase text-white/75 mb-1 px-0.5">
              <span className="text-white/55 font-mono-tabular">
                PWR {blueFighter.stats.power} · SPD {blueFighter.stats.speed} · CHN {blueFighter.stats.chin}
              </span>
              <span className="text-[#4ea2ff]">Blue Corner · Opponent</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
              {UFC_ROSTER.map((f) => {
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
                        ? 'border-2 border-[#3b8eff] ring-1 ring-white/80 scale-[1.04] z-10'
                        : 'border-white/20 hover:border-white/60 opacity-85 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={portraits[f.id]}
                      alt={f.name}
                      className="w-full h-12 sm:h-14 object-cover object-center block"
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

        {/* BOTTOM PROMPT BAR */}
        <div className="flex items-center justify-between text-[11px] text-white/60 pt-1 border-t border-white/10">
          <div className="px-2 py-0.5 bg-[#9e1a1a]/35 border-l-2 border-[#e02424] text-white/85 font-semibold uppercase tracking-wider">
            You · {redFighter.name}
          </div>
          <div className="hidden sm:block tracking-wide text-white/65">
            Enter Fight · R Randomize · Esc Back · C Controls · WASD + J/I/K/L + Shift/Ctrl + Gamepad
          </div>
          <div className="px-2 py-0.5 bg-[#184f96]/35 border-r-2 border-[#3b8eff] text-white/85 font-semibold uppercase tracking-wider">
            CPU · {blueFighter.name}
          </div>
        </div>
      </div>
    </div>
  );
};
