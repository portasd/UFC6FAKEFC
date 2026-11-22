import React, { useRef, useState } from 'react';
import { TouchControlSettings } from '../game/controlSettings';
import { InputHub } from '../game/inputHub';

interface MobileControlsProps {
  inputHub: InputHub;
  settings: TouchControlSettings;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  inputHub,
  settings,
}) => {
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [floatingOffset, setFloatingOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [stickActive, setStickActive] = useState(false);
  const [bodyMod, setBodyMod] = useState(false);
  const [hookMod, setHookMod] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [activeBtn, setActiveBtn] = useState<string | null>(null);

  const stickZoneRef = useRef<HTMLDivElement | null>(null);
  const stickRingRef = useRef<HTMLDivElement | null>(null);
  const stickPointerId = useRef<number | null>(null);
  const stickCenter = useRef<{ x: number; y: number; r: number }>({
    x: 0,
    y: 0,
    r: 68,
  });
  const prevFlickState = useRef<{
    normMag: number;
    time: number;
    lastOuterTime: number;
    lastOuterAngle: number;
  }>({
    normMag: 0,
    time: 0,
    lastOuterTime: 0,
    lastOuterAngle: 0,
  });
  const lungeCooldownRef = useRef<number>(0);
  const punchToggle = useRef<number>(0);
  const kickToggle = useRef<number>(0);
  const powerToggle = useRef<number>(0);

  const evadePointerId = useRef<number | null>(null);
  const evadeOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const evadeTriggered = useRef<boolean>(false);

  const isMirrored = settings.handedness === 'leftHanded';
  const marginPx = Math.max(4, Math.min(36, settings.edgeMargin));
  const liftPx = Math.max(0, Math.min(48, settings.verticalOffset ?? 10));
  const stickScale = Math.max(
    0.75,
    Math.min(1.35, settings.joystickScale ?? settings.scale ?? 1),
  );
  const btnScale = Math.max(0.75, Math.min(1.35, settings.scale ?? 1));
  const spacing = Math.max(0.85, Math.min(1.25, settings.buttonSpacing ?? 1));
  const opacity = Math.max(0.35, Math.min(1, settings.opacity ?? 0.92));
  const deadzone = Math.max(
    0.05,
    Math.min(0.28, settings.joystickDeadzone ?? 0.14),
  );
  const lungeMode =
    settings.lungeMode ?? (settings.stickLunge === false ? 'off' : 'flick');

  const updateStickFromClient = (clientX: number, clientY: number) => {
    const { x: cx, y: cy, r } = stickCenter.current;
    // Scale compensation: client coords are viewport px, while inner puck lives inside CSS scale(stickScale)
    const rawDx = (clientX - cx) / stickScale;
    const rawDy = (clientY - cy) / stickScale;
    const dist = Math.hypot(rawDx, rawDy);
    const maxR = Math.max(28, r * 0.72);
    const clampedDist = Math.min(dist, maxR);
    const angle = Math.atan2(rawDy, rawDx);
    const ox = Math.cos(angle) * clampedDist;
    const oy = Math.sin(angle) * clampedDist;
    setKnobOffset({ x: ox, y: oy });

    const normMag = clamp01(clampedDist / maxR);
    if (normMag <= deadzone) {
      inputHub.setTouchStick(0, 0);
      prevFlickState.current.normMag = normMag;
      prevFlickState.current.time = performance.now();
      return;
    }

    const rescaled = (normMag - deadzone) / (1 - deadzone);
    // Slight ease curve for micro-adjustments inside the pocket vs crisp full-walk at outer edge
    const curved = 0.25 * rescaled + 0.75 * (rescaled * rescaled);
    const normZ = Math.cos(angle) * curved; // screen left/right -> moveZ toward/away
    const normX = Math.sin(angle) * curved; // screen up/down -> moveX lateral cage circle
    inputHub.setTouchStick(normX, normZ);

    const now = performance.now();
    const prev = prevFlickState.current;
    const dtMs = Math.max(1, now - prev.time);

    if (lungeMode === 'flick' && now > lungeCooldownRef.current) {
      // Only lunge on a fast intentional radial swipe from inner ring to outer rim within ~135ms
      const radialSpeed = (normMag - prev.normMag) / (dtMs / 1000);
      if (normMag > 0.8 && (prev.normMag < 0.44 || radialSpeed > 3.8)) {
        lungeCooldownRef.current = now + 360;
        inputHub.triggerTouchLunge(Math.sin(angle), Math.cos(angle));
      }
    } else if (lungeMode === 'doubleTap' && now > lungeCooldownRef.current) {
      if (normMag > 0.78 && prev.normMag <= 0.78) {
        const angleDelta = Math.abs(Math.atan2(Math.sin(angle - prev.lastOuterAngle), Math.cos(angle - prev.lastOuterAngle)));
        if (now - prev.lastOuterTime < 300 && angleDelta < 0.7) {
          lungeCooldownRef.current = now + 380;
          inputHub.triggerTouchLunge(Math.sin(angle), Math.cos(angle));
          prev.lastOuterTime = 0;
        } else {
          prev.lastOuterTime = now;
          prev.lastOuterAngle = angle;
        }
      }
    }

    prev.normMag = normMag;
    prev.time = now;
  };

  const handleZonePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== null) return;
    e.preventDefault();
    e.stopPropagation();

    const zoneEl = stickZoneRef.current;
    const ringEl = stickRingRef.current;
    if (!zoneEl || !ringEl) return;

    zoneEl.setPointerCapture(e.pointerId);
    stickPointerId.current = e.pointerId;
    prevFlickState.current = {
      normMag: 0,
      time: performance.now(),
      lastOuterTime: prevFlickState.current.lastOuterTime,
      lastOuterAngle: prevFlickState.current.lastOuterAngle,
    };

    const ringUnscaledRadius = ringEl.offsetWidth / 2 || 68;
    if (settings.joystickMode === 'floating') {
      const zRect = zoneEl.getBoundingClientRect();
      const pad = ringUnscaledRadius * stickScale * 0.65;
      const cx = clamp(e.clientX, zRect.left + pad, zRect.right - pad);
      const cy = clamp(e.clientY, zRect.top + pad, zRect.bottom - pad);
      setFloatingOffset({ x: cx - zRect.left, y: cy - zRect.top });
      stickCenter.current = { x: cx, y: cy, r: ringUnscaledRadius };
    } else {
      const rRect = ringEl.getBoundingClientRect();
      stickCenter.current = {
        x: rRect.left + rRect.width / 2,
        y: rRect.top + rRect.height / 2,
        r: ringUnscaledRadius,
      };
    }

    setStickActive(true);
    updateStickFromClient(e.clientX, e.clientY);
  };

  const handleZonePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    e.preventDefault();
    updateStickFromClient(e.clientX, e.clientY);
  };

  const handleZonePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    e.preventDefault();
    stickPointerId.current = null;
    setStickActive(false);
    setKnobOffset({ x: 0, y: 0 });
    setFloatingOffset(null);
    inputHub.setTouchStick(0, 0);
  };

  const handlePunch = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveBtn('punch');
    const next = punchToggle.current % 3;
    punchToggle.current += 1;
    if (bodyMod) {
      inputHub.triggerTouchStrike(
        next === 0 ? 'leadPunch' : 'rearPunch',
        false,
        true,
        false,
      );
    } else if (next === 0) {
      inputHub.triggerTouchStrike('leadPunch', false, false, false);
    } else if (next === 1) {
      inputHub.triggerTouchStrike('rearPunch', false, false, false);
    } else {
      inputHub.triggerTouchStrike('leadPunch', true, false, false);
    }
  };

  const handleKick = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveBtn('kick');
    const next = kickToggle.current % 2;
    kickToggle.current += 1;
    inputHub.triggerTouchStrike(
      next === 0 ? 'leadKick' : 'rearKick',
      false,
      bodyMod,
      false,
    );
  };

  const handleHeavy = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveBtn('heavy');
    const next = powerToggle.current % 3;
    powerToggle.current += 1;
    if (bodyMod) {
      inputHub.triggerTouchStrike(
        next === 0 ? 'leadPunch' : next === 1 ? 'rearKick' : 'rearPunch',
        true,
        true,
        true,
      );
    } else if (next === 0) {
      inputHub.triggerTouchStrike('rearPunch', true, false, false);
    } else if (next === 1) {
      inputHub.triggerTouchStrike('rearPunch', true, true, true);
    } else {
      inputHub.triggerTouchStrike('rearKick', true, false, false);
    }
  };

  const handleLimb = (
    e: React.PointerEvent<HTMLButtonElement>,
    limb: 'leadPunch' | 'rearPunch' | 'leadKick' | 'rearKick',
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveBtn(limb);
    inputHub.triggerTouchStrike(limb, hookMod, bodyMod, hookMod && bodyMod);
  };

  const handleBlockDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setBlocking(true);
    setActiveBtn('block');
    inputHub.triggerTouchFeint();
    inputHub.setTouchGuard(bodyMod ? 'low' : 'high');
  };

  const handleBlockUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setBlocking(false);
    setActiveBtn(null);
    inputHub.setTouchGuard('none');
  };

  const handleEvadeDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    evadePointerId.current = e.pointerId;
    evadeOrigin.current = { x: e.clientX, y: e.clientY };
    evadeTriggered.current = false;
    setActiveBtn('evade');
  };

  const handleEvadeMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (evadePointerId.current !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - evadeOrigin.current.x;
    const dy = e.clientY - evadeOrigin.current.y;
    if (Math.hypot(dx, dy) > 15 && !evadeTriggered.current) {
      evadeTriggered.current = true;
      if (Math.abs(dx) >= Math.abs(dy)) {
        inputHub.triggerTouchEvade(dx < 0 ? 'pullBack' : 'slipRight', true);
      } else {
        inputHub.triggerTouchEvade(dy < 0 ? 'slipLeft' : 'duck', true);
      }
    }
  };

  const handleEvadeEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (evadePointerId.current !== e.pointerId) return;
    e.preventDefault();
    if (!evadeTriggered.current) {
      inputHub.triggerTouchEvade('slipLeft', false);
    }
    evadePointerId.current = null;
    evadeTriggered.current = false;
    inputHub.setTouchHeldEvade(null);
    setActiveBtn(null);
  };

  const onModDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (settings.modifierBehavior === 'hold') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setter(true);
    } else {
      setter((prev) => !prev);
    }
  };

  const onModUp = (
    e: React.PointerEvent<HTMLButtonElement>,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    if (settings.modifierBehavior !== 'hold') return;
    e.preventDefault();
    e.stopPropagation();
    setter(false);
  };

  const bottomOffset = marginPx + liftPx;

  const stickZoneStyle: React.CSSProperties = isMirrored
    ? { right: `${marginPx}px`, bottom: `${bottomOffset}px`, touchAction: 'none' }
    : { left: `${marginPx}px`, bottom: `${bottomOffset}px`, touchAction: 'none' };

  const stickRingInline: React.CSSProperties =
    settings.joystickMode === 'floating' && floatingOffset
      ? {
          left: `${floatingOffset.x}px`,
          top: `${floatingOffset.y}px`,
          transform: `translate(-50%, -50%) scale(${stickScale})`,
          transformOrigin: 'center center',
        }
      : {
          transform: `scale(${stickScale})`,
          transformOrigin: isMirrored ? 'bottom right' : 'bottom left',
        };

  const clusterPosStyle: React.CSSProperties = isMirrored
    ? {
        left: `${marginPx}px`,
        bottom: `${bottomOffset}px`,
        transform: `scale(${btnScale})`,
        transformOrigin: 'bottom left',
        touchAction: 'none',
      }
    : {
        right: `${marginPx}px`,
        bottom: `${bottomOffset}px`,
        transform: `scale(${btnScale})`,
        transformOrigin: 'bottom right',
        touchAction: 'none',
      };

  const clusterW = Math.round((settings.preset === 'fourLimb' ? 248 : 218) * spacing);
  const clusterH = Math.round(210 * spacing);
  const sp = (px: number) => `${Math.round(px * spacing)}px`;

  return (
    <div
      data-testid="mobile-touch-controls"
      className="fixed inset-0 z-20 pointer-events-none select-none safe-area-pad"
      style={{ touchAction: 'none', opacity }}
    >
      {/* VIRTUAL JOYSTICK ZONE (Generous capture area + Fixed or Floating Ring) */}
      <div
        ref={stickZoneRef}
        onPointerDown={handleZonePointerDown}
        onPointerMove={handleZonePointerMove}
        onPointerUp={handleZonePointerEnd}
        onPointerCancel={handleZonePointerEnd}
        aria-label="Movement Analog Stick Zone"
        className={`pointer-events-auto absolute flex ${
          isMirrored ? 'items-end justify-end' : 'items-end justify-start'
        } ${
          settings.joystickMode === 'floating'
            ? 'w-[42vw] max-w-[230px] h-[44vh] max-h-[220px]'
            : 'w-40 h-40'
        }`}
        style={stickZoneStyle}
      >
        <div
          ref={stickRingRef}
          aria-label="Movement Analog Stick"
          className={`${
            settings.joystickMode === 'floating' && floatingOffset
              ? 'absolute'
              : 'relative'
          } w-36 h-36 rounded-full border-2 transition-colors flex items-center justify-center pointer-events-none ${
            stickActive
              ? 'border-white/85 bg-white/[0.14]'
              : settings.joystickMode === 'floating'
                ? 'border-white/30 bg-black/20'
                : 'border-white/50 bg-black/28'
          } backdrop-blur-[2px] shadow-[0_0_24px_rgba(0,0,0,0.45)]`}
          style={stickRingInline}
        >
          <svg
            viewBox="0 0 120 120"
            className="absolute inset-0 w-full h-full pointer-events-none opacity-65"
            aria-hidden="true"
          >
            <path d="M53 15 L60 8 L67 15 Z" fill="rgba(255,255,255,0.75)" />
            <path d="M53 105 L60 112 L67 105 Z" fill="rgba(255,255,255,0.75)" />
            <path d="M15 53 L8 60 L15 67 Z" fill="rgba(255,255,255,0.75)" />
            <path d="M105 53 L112 60 L105 67 Z" fill="rgba(255,255,255,0.75)" />
            <circle
              cx="60"
              cy="60"
              r="38"
              fill="none"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="1"
            />
          </svg>

          <div
            data-testid="joystick-puck"
            className={`w-14 h-14 rounded-full border-2 shadow-lg pointer-events-none transition-colors ${
              stickActive
                ? 'bg-white/60 border-white'
                : 'bg-white/38 border-white/85'
            }`}
            style={{
              transform: `translate(${knobOffset.x.toFixed(1)}px, ${knobOffset.y.toFixed(1)}px)`,
            }}
          />
        </div>
      </div>

      {/* ACTION CLUSTER */}
      {settings.preset === 'fourLimb' ? (
        <div
          className="pointer-events-auto absolute"
          style={{ ...clusterPosStyle, width: `${clusterW}px`, height: `${clusterH}px` }}
        >
          <button
            type="button"
            onPointerDown={(e) => handleLimb(e, 'leadPunch')}
            onPointerUp={() => setActiveBtn(null)}
            onPointerCancel={() => setActiveBtn(null)}
            aria-label="Lead Jab"
            className={`absolute w-14 h-14 rounded-full border-2 text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center backdrop-blur-[2px] cursor-pointer ${
              activeBtn === 'leadPunch'
                ? 'scale-95 border-[#ff5d47] bg-[#d92626]/45 text-white'
                : 'border-white/65 bg-black/35 text-white'
            }`}
            style={{ top: sp(4), right: sp(74), touchAction: 'none' }}
          >
            JAB
          </button>

          <button
            type="button"
            onPointerDown={(e) => handleLimb(e, 'rearPunch')}
            onPointerUp={() => setActiveBtn(null)}
            onPointerCancel={() => setActiveBtn(null)}
            aria-label="Rear Cross"
            className={`absolute w-14 h-14 rounded-full border-2 text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center backdrop-blur-[2px] cursor-pointer ${
              activeBtn === 'rearPunch'
                ? 'scale-95 border-[#ff8e1c] bg-[#ff8e1c]/45 text-white'
                : 'border-white/65 bg-black/35 text-white'
            }`}
            style={{ top: sp(22), right: sp(6), touchAction: 'none' }}
          >
            CROSS
          </button>

          <button
            type="button"
            onPointerDown={(e) => handleLimb(e, 'leadKick')}
            onPointerUp={() => setActiveBtn(null)}
            onPointerCancel={() => setActiveBtn(null)}
            aria-label="Lead Kick"
            className={`absolute w-14 h-14 rounded-full border-2 text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center backdrop-blur-[2px] cursor-pointer ${
              activeBtn === 'leadKick'
                ? 'scale-95 border-[#54a6ff] bg-[#2563eb]/45 text-white'
                : 'border-white/65 bg-black/35 text-white'
            }`}
            style={{ bottom: sp(10), right: sp(76), touchAction: 'none' }}
          >
            L.KICK
          </button>

          <button
            type="button"
            onPointerDown={(e) => handleLimb(e, 'rearKick')}
            onPointerUp={() => setActiveBtn(null)}
            onPointerCancel={() => setActiveBtn(null)}
            aria-label="Rear Kick"
            className={`absolute w-14 h-14 rounded-full border-2 text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center backdrop-blur-[2px] cursor-pointer ${
              activeBtn === 'rearKick'
                ? 'scale-95 border-[#54a6ff] bg-[#2563eb]/45 text-white'
                : 'border-white/65 bg-black/35 text-white'
            }`}
            style={{ bottom: sp(34), right: sp(8), touchAction: 'none' }}
          >
            R.KICK
          </button>

          <button
            type="button"
            onPointerDown={handleBlockDown}
            onPointerUp={handleBlockUp}
            onPointerCancel={handleBlockUp}
            aria-label="Hold Block / Tap Feint"
            className={`absolute w-14 h-14 rounded-full border-2 text-[10px] font-extrabold uppercase flex items-center justify-center backdrop-blur-[2px] cursor-pointer ${
              blocking
                ? 'scale-95 border-[#4ba3ff] bg-[#2563eb]/45 text-white'
                : 'border-white/60 bg-black/35 text-white'
            }`}
            style={{ top: sp(68), left: sp(20), touchAction: 'none' }}
          >
            BLK
          </button>

          <button
            type="button"
            onPointerDown={(e) => onModDown(e, setHookMod)}
            onPointerUp={(e) => onModUp(e, setHookMod)}
            onPointerCancel={(e) => onModUp(e, setHookMod)}
            aria-label="Hook and Head Kick Modifier"
            aria-pressed={hookMod}
            className={`absolute w-12 h-12 rounded-full border-2 text-[9px] font-extrabold uppercase tracking-wider flex items-center justify-center backdrop-blur-[2px] cursor-pointer ${
              hookMod
                ? 'border-[#ff5d47] bg-[#ff5d47] text-[#0b0d12]'
                : 'border-white/45 bg-black/35 text-white/90'
            }`}
            style={{ top: sp(8), left: sp(26), touchAction: 'none' }}
          >
            HOOK
          </button>

          <button
            type="button"
            onPointerDown={(e) => onModDown(e, setBodyMod)}
            onPointerUp={(e) => onModUp(e, setBodyMod)}
            onPointerCancel={(e) => onModUp(e, setBodyMod)}
            aria-label="Body Strikes and Low Block Modifier"
            aria-pressed={bodyMod}
            className={`absolute w-12 h-12 rounded-full border-2 text-[9px] font-extrabold uppercase tracking-wider flex items-center justify-center backdrop-blur-[2px] cursor-pointer ${
              bodyMod
                ? 'border-[#ff8e1c] bg-[#ff8e1c] text-[#0b0d12]'
                : 'border-white/45 bg-black/35 text-white/90'
            }`}
            style={{ bottom: sp(8), left: sp(20), touchAction: 'none' }}
          >
            BODY
          </button>

          <button
            type="button"
            onPointerDown={handleEvadeDown}
            onPointerMove={handleEvadeMove}
            onPointerUp={handleEvadeEnd}
            onPointerCancel={handleEvadeEnd}
            aria-label="Head Movement Slip / Duck"
            className={`absolute w-11 h-11 rounded-full border-2 text-[9px] font-extrabold uppercase tracking-wider flex items-center justify-center backdrop-blur-[2px] cursor-pointer ${
              activeBtn === 'evade'
                ? 'scale-95 border-[#f4c038] bg-[#f4c038]/40 text-white'
                : 'border-white/45 bg-black/35 text-white/90'
            }`}
            style={{ bottom: sp(68), left: sp(86), touchAction: 'none' }}
          >
            SLIP
          </button>
        </div>
      ) : (
        /* SHADOW ARC CLUSTER */
        <div
          className="pointer-events-auto absolute"
          style={{ ...clusterPosStyle, width: `${clusterW}px`, height: `${clusterH}px` }}
        >
          {/* HEAVY HOOK / OVERHAND / HEAD KICK */}
          <button
            type="button"
            onPointerDown={handleHeavy}
            onPointerUp={() => setActiveBtn(null)}
            onPointerCancel={() => setActiveBtn(null)}
            aria-label="Heavy Strike / Head Kick"
            className={`absolute w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center transition-transform cursor-pointer backdrop-blur-[2px] ${
              activeBtn === 'heavy'
                ? 'scale-95 border-[#ff8e1c] bg-[#ff8e1c]/35'
                : 'border-white/60 bg-black/30 active:scale-95'
            }`}
            style={{
              top: 0,
              ...(isMirrored ? { left: sp(4) } : { right: sp(4) }),
              touchAction: 'none',
            }}
          >
            <svg viewBox="0 0 36 36" className="w-7 h-7 fill-white/95" aria-hidden="true">
              <path d="M27 7 L19 21 L23 23 L13 30 L17 19 L13 17 Z" />
              <circle cx="10.5" cy="11.5" r="2.2" fill="rgba(255,165,60,0.95)" />
            </svg>
            {settings.showLabels && (
              <span className="text-[8px] font-extrabold uppercase tracking-wider text-white/85 leading-none">
                HEAVY
              </span>
            )}
          </button>

          {/* PUNCH COMBO */}
          <button
            type="button"
            onPointerDown={handlePunch}
            onPointerUp={() => setActiveBtn(null)}
            onPointerCancel={() => setActiveBtn(null)}
            aria-label="Punch"
            className={`absolute w-[68px] h-[68px] rounded-full border-2 flex flex-col items-center justify-center transition-transform cursor-pointer backdrop-blur-[2px] ${
              activeBtn === 'punch'
                ? 'scale-95 border-[#ff5d47] bg-[#d92626]/40'
                : 'border-white/70 bg-black/32 active:scale-95'
            }`}
            style={{
              top: sp(74),
              ...(isMirrored ? { left: 0 } : { right: 0 }),
              touchAction: 'none',
            }}
          >
            <svg viewBox="0 0 36 36" className="w-8 h-8 fill-white/95" aria-hidden="true">
              <path d="M11 14c0-1.6 1.2-2.8 2.6-2.8.8 0 1.4.3 1.8.8.4-.9 1.2-1.4 2.2-1.4 1 0 1.8.5 2.2 1.3.4-.6 1.1-1 1.9-1 1.4 0 2.5 1.1 2.5 2.6v3.8c1 .4 1.8 1.4 1.8 2.7 0 2.2-1.4 4.2-3.4 5.1V28h-9.2v-2.4c-1.8-.9-3-2.7-3-4.9v-5.3c0-.5.2-1 .6-1.4z" />
            </svg>
            {settings.showLabels && (
              <span className="text-[8px] font-extrabold uppercase tracking-wider text-white/90 leading-none">
                PUNCH
              </span>
            )}
          </button>

          {/* KICK */}
          <button
            type="button"
            onPointerDown={handleKick}
            onPointerUp={() => setActiveBtn(null)}
            onPointerCancel={() => setActiveBtn(null)}
            aria-label="Kick"
            className={`absolute w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center transition-transform cursor-pointer backdrop-blur-[2px] ${
              activeBtn === 'kick'
                ? 'scale-95 border-[#54a6ff] bg-[#2563eb]/35'
                : 'border-white/60 bg-black/30 active:scale-95'
            }`}
            style={{
              bottom: 0,
              ...(isMirrored ? { left: sp(68) } : { right: sp(68) }),
              touchAction: 'none',
            }}
          >
            <svg viewBox="0 0 36 36" className="w-7 h-7 fill-white/95" aria-hidden="true">
              <path d="M23 6l4 2-6 12c2.5 1.8 5.2 2.4 7 2.8 1.2.3 1.8 1.4 1.4 2.6-.4 1.2-1.7 1.8-3 1.5-3.4-.8-7.4-2.2-10.8-4.7-1.2-.9-1.5-2.5-.8-3.8L23 6z" />
            </svg>
            {settings.showLabels && (
              <span className="text-[8px] font-extrabold uppercase tracking-wider text-white/85 leading-none">
                KICK
              </span>
            )}
          </button>

          {/* GUARD / FEINT */}
          <button
            type="button"
            onPointerDown={handleBlockDown}
            onPointerUp={handleBlockUp}
            onPointerCancel={handleBlockUp}
            aria-label="Hold Block / Tap Feint"
            className={`absolute w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center transition-transform cursor-pointer backdrop-blur-[2px] ${
              blocking
                ? 'scale-95 border-[#4ba3ff] bg-[#2563eb]/45'
                : 'border-white/55 bg-black/30'
            }`}
            style={{
              top: sp(52),
              ...(isMirrored ? { right: sp(22) } : { left: sp(22) }),
              touchAction: 'none',
            }}
          >
            <svg viewBox="0 0 36 36" className="w-7 h-7 fill-white/95" aria-hidden="true">
              <path d="M18 5 L28 9.2 V17.4 C28 24 23.6 29.2 18 31.2 C12.4 29.2 8 24 8 17.4 V9.2 L18 5 Z" fillOpacity="0.9" />
              <path d="M18 9.5 L12.5 11.8 V17.2 C12.5 21.6 14.9 25.1 18 26.6 V9.5 Z" fill="rgba(16,22,34,0.65)" />
            </svg>
            {settings.showLabels && (
              <span className="text-[8px] font-extrabold uppercase tracking-wider text-white/85 leading-none">
                BLOCK
              </span>
            )}
          </button>

          {/* BODY MODIFIER */}
          <button
            type="button"
            onPointerDown={(e) => onModDown(e, setBodyMod)}
            onPointerUp={(e) => onModUp(e, setBodyMod)}
            onPointerCancel={(e) => onModUp(e, setBodyMod)}
            aria-label="Body Strikes and Low Block Modifier"
            aria-pressed={bodyMod}
            className={`absolute w-11 h-11 rounded-full border-2 text-[9px] font-extrabold uppercase tracking-wider flex items-center justify-center transition-colors cursor-pointer backdrop-blur-[2px] ${
              bodyMod
                ? 'border-[#ff8e1c] bg-[#ff8e1c] text-[#0b0d12]'
                : 'border-white/45 bg-black/35 text-white/90'
            }`}
            style={{
              bottom: sp(8),
              ...(isMirrored ? { right: sp(16) } : { left: sp(16) }),
              touchAction: 'none',
            }}
          >
            BODY
          </button>

          {/* SLIP HEAD MOVEMENT */}
          <button
            type="button"
            onPointerDown={handleEvadeDown}
            onPointerMove={handleEvadeMove}
            onPointerUp={handleEvadeEnd}
            onPointerCancel={handleEvadeEnd}
            aria-label="Head Movement Slip / Duck"
            className={`absolute w-11 h-11 rounded-full border-2 text-[9px] font-extrabold uppercase tracking-wider flex items-center justify-center transition-transform cursor-pointer backdrop-blur-[2px] ${
              activeBtn === 'evade'
                ? 'scale-95 border-[#f4c038] bg-[#f4c038]/40 text-white'
                : 'border-white/45 bg-black/35 text-white/90'
            }`}
            style={{
              top: sp(4),
              ...(isMirrored ? { right: sp(54) } : { left: sp(54) }),
              touchAction: 'none',
            }}
          >
            SLIP
          </button>
        </div>
      )}
    </div>
  );
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
