import React, { useMemo, useRef, useState } from 'react';
import { Grid, RotateCcw, Check, X } from 'lucide-react';
import {
  clampTouchPosition,
  getControlsForPreset,
  getDefaultTouchPositions,
  TOUCH_CONTROL_META,
  TouchControlId,
  TouchControlPosition,
  TouchControlSettings,
} from '../game/controlSettings';

interface TouchLayoutEditorProps {
  settings: TouchControlSettings;
  onSave: (nextTouch: TouchControlSettings) => void;
  onCancel: () => void;
}

function getBaseSizePx(id: TouchControlId): number {
  if (id === 'stick') return 144;
  if (id === 'punch') return 68;
  if (id === 'heavy' || id === 'kick' || id === 'block') return 64;
  if (
    id === 'leadPunch' ||
    id === 'rearPunch' ||
    id === 'leadKick' ||
    id === 'rearKick'
  ) {
    return 56;
  }
  if (id === 'hook' || id === 'bodyHook' || id === 'headKick' || id === 'lowKick') {
    return 48;
  }
  return 44; // body / evade
}

export const TouchLayoutEditor: React.FC<TouchLayoutEditorProps> = ({
  settings,
  onSave,
  onCancel,
}) => {
  const controlIds = useMemo(
    () =>
      getControlsForPreset(
        settings.preset,
        settings.showQuickStrikeButtons !== false,
      ),
    [settings.preset, settings.showQuickStrikeButtons],
  );
  const defaultPositions = useMemo(
    () => getDefaultTouchPositions(settings.preset, settings.handedness),
    [settings.preset, settings.handedness],
  );

  const [positions, setPositions] = useState<
    Record<TouchControlId, TouchControlPosition>
  >(() => {
    const init = { ...defaultPositions };
    if (settings.customPositions) {
      for (const id of Object.keys(settings.customPositions) as TouchControlId[]) {
        const p = settings.customPositions[id];
        if (p) init[id] = clampTouchPosition(p);
      }
    }
    return init;
  });

  const [scales, setScales] = useState<Partial<Record<TouchControlId, number>>>(
    () => ({ ...(settings.customScales ?? {}) }),
  );
  const [selectedId, setSelectedId] = useState<TouchControlId>('punch' === controlIds[1] ? 'punch' : controlIds[1]);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const dragPointerId = useRef<number | null>(null);
  const dragIdRef = useRef<TouchControlId | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    id: TouchControlId,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    dragPointerId.current = e.pointerId;
    dragIdRef.current = id;
    e.currentTarget.setPointerCapture(e.pointerId);

    const vw = Math.max(320, window.innerWidth);
    const vh = Math.max(240, window.innerHeight);
    const cur = positions[id];
    dragOffset.current = {
      dx: cur.x * vw - e.clientX,
      dy: cur.y * vh - e.clientY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      dragPointerId.current !== e.pointerId ||
      dragIdRef.current === null
    ) {
      return;
    }
    e.preventDefault();
    const id = dragIdRef.current;
    const vw = Math.max(320, window.innerWidth);
    const vh = Math.max(240, window.innerHeight);
    let nx = (e.clientX + dragOffset.current.dx) / vw;
    let ny = (e.clientY + dragOffset.current.dy) / vh;
    if (snapToGrid) {
      nx = Math.round(nx * 50) / 50; // 2% snaps
      ny = Math.round(ny * 50) / 50;
    }
    const clamped = clampTouchPosition({ x: nx, y: ny });
    setPositions((prev) => ({ ...prev, [id]: clamped }));
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerId.current !== e.pointerId) return;
    e.preventDefault();
    dragPointerId.current = null;
    dragIdRef.current = null;
  };

  const handleResetAll = () => {
    setPositions({ ...defaultPositions });
    setScales({});
  };

  const handleResetSelected = () => {
    setPositions((prev) => ({
      ...prev,
      [selectedId]: defaultPositions[selectedId],
    }));
    setScales((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
  };

  const handleSave = () => {
    const customPositions: Partial<Record<TouchControlId, TouchControlPosition>> =
      {};
    for (const id of controlIds) {
      customPositions[id] = positions[id];
    }
    onSave({
      ...settings,
      customPositions,
      customScales: scales,
    });
  };

  const selectedScale = scales[selectedId] ?? 1;
  const selectedPos = positions[selectedId];

  return (
    <div
      data-testid="touch-layout-editor"
      className="fixed inset-0 z-50 bg-black/55 select-none overflow-hidden safe-area-pad"
      style={{ touchAction: 'none' }}
    >
      {/* Subtle 5% Alignment Grid Overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)',
          backgroundSize: '5vw 8vh',
        }}
      />

      {/* Safe Boundary Dashed Guide */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none border border-dashed border-white/25"
        style={{
          left: '4%',
          right: '4%',
          top: '15%',
          bottom: '5%',
        }}
      />

      {/* Compact Top Editor Toolbar (respects 15% height, zero-blur over WebGL) */}
      <div className="relative z-20 w-full bg-[#090b10]/95 border-b border-white/20 px-2.5 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 bg-[#ff8e1c] text-[#090a0d] font-display font-extrabold text-xs uppercase tracking-wider shrink-0">
            HUD LAYOUT
          </span>
          <span className="text-[11px] font-semibold text-white/85 truncate hidden sm:inline">
            Drag buttons anywhere on screen · Tap to resize
          </span>
          <span className="text-[11px] font-mono-tabular text-[#ff8e1c] truncate">
            {TOUCH_CONTROL_META[selectedId].label} ({Math.round(selectedPos.x * 100)}%, {Math.round(selectedPos.y * 100)}%)
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 px-2 py-1 bg-[#141720] border border-white/15 text-[11px] text-white">
            <span className="font-bold uppercase text-white/75">Size</span>
            <input
              type="range"
              min={0.75}
              max={1.45}
              step={0.05}
              value={selectedScale}
              aria-label="Selected control size"
              onChange={(e) =>
                setScales((prev) => ({
                  ...prev,
                  [selectedId]: parseFloat(e.target.value),
                }))
              }
              className="w-20 sm:w-24 accent-[#ff8e1c] cursor-pointer"
            />
            <span className="font-mono-tabular text-[#ff8e1c] w-9 text-right">
              {Math.round(selectedScale * 100)}%
            </span>
          </label>

          <button
            type="button"
            onClick={() => setSnapToGrid((s) => !s)}
            aria-pressed={snapToGrid}
            className={`min-h-[36px] px-2.5 border text-[11px] font-bold uppercase flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              snapToGrid
                ? 'bg-white text-[#090a0d] border-white'
                : 'bg-[#141720] text-white/75 border-white/20'
            }`}
          >
            <Grid className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Snap</span>
          </button>

          <button
            type="button"
            onClick={handleResetSelected}
            title="Reset selected button"
            className="min-h-[36px] px-2.5 bg-[#141720] hover:bg-[#1f2432] border border-white/20 text-[11px] font-bold uppercase text-white/85 cursor-pointer whitespace-nowrap"
          >
            Reset 1
          </button>

          <button
            type="button"
            onClick={handleResetAll}
            className="min-h-[36px] px-2.5 bg-[#141720] hover:bg-[#1f2432] border border-white/20 text-[11px] font-bold uppercase text-white/85 flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset All</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="min-h-[36px] px-2.5 bg-[#191c25] hover:bg-[#252a38] border border-white/20 text-[11px] font-bold uppercase text-white/80 flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Cancel</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="min-h-[36px] px-3 bg-[#10b981] hover:bg-[#18cf92] border border-[#34d399] text-[#05120c] text-[11px] font-extrabold uppercase flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Draggable Control Nodes */}
      {controlIds.map((id) => {
        const pos = positions[id];
        const meta = TOUCH_CONTROL_META[id];
        const isSelected = selectedId === id;
        const baseScale =
          id === 'stick' ? settings.joystickScale : settings.scale;
        const customScale = scales[id] ?? 1;
        const sizePx = Math.round(getBaseSizePx(id) * baseScale * customScale);

        return (
          <div
            key={id}
            role="button"
            tabIndex={0}
            aria-label={`Drag ${meta.label}`}
            onPointerDown={(e) => handlePointerDown(e, id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            className={`fixed rounded-full border-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-shadow ${
              isSelected
                ? 'border-[#ff8e1c] bg-[#ff8e1c]/25 shadow-[0_0_0_3px_rgba(255,142,28,0.45)] z-30'
                : 'border-white/75 bg-[#090b10]/70 hover:border-white z-20'
            }`}
            style={{
              left: `${(pos.x * 100).toFixed(2)}%`,
              top: `${(pos.y * 100).toFixed(2)}%`,
              width: `${Math.max(44, sizePx)}px`,
              height: `${Math.max(44, sizePx)}px`,
              transform: 'translate(-50%, -50%)',
              touchAction: 'none',
            }}
          >
            {id === 'stick' && (
              <div className="w-10 h-10 rounded-full border border-white/60 bg-white/25 pointer-events-none mb-0.5" />
            )}
            <span
              className="font-display font-extrabold uppercase tracking-wider text-white pointer-events-none leading-none"
              style={{
                fontSize: id === 'stick' ? '11px' : '10px',
                color: isSelected ? '#ffffff' : meta.accent,
              }}
            >
              {meta.shortLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
};
