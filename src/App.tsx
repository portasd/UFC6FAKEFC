import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BoutState,
  createBoutState,
  generateAiInput,
  stepBout,
} from './game/combatEngine';
import { getFighterById, UFC_ROSTER } from './game/fighters';
import { STRIKES } from './game/strikes';
import { ControllerStatus, InputHub } from './game/inputHub';
import { ArenaAudioSynth } from './game/audioSynth';
import { OctagonSceneManager } from './game/octagonScene';
import { BroadcastHud, HudDomRefs, syncHudDom } from './components/BroadcastHud';
import { TitleOverlay, TitleStep } from './components/TitleOverlay';
import {
  ControlsModal,
  PauseModal,
  ResultModal,
} from './components/FightModals';

type GameMode = 'title' | 'playing' | 'paused' | 'gameover';

export default function App() {
  const initialAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [mode, setMode] = useState<GameMode>(
    initialAutostart ? 'playing' : 'title',
  );
  const [titleStep, setTitleStep] = useState<TitleStep>('menu');
  const [redId, setRedId] = useState('holloway');
  const [blueId, setBlueId] = useState('mcgregor');
  const [difficulty, setDifficulty] = useState<'pro' | 'champion' | 'legend'>(
    'champion',
  );
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [controller, setController] = useState<ControllerStatus>({
    connected: false,
    name: '',
  });
  const [resultBout, setResultBout] = useState<BoutState | null>(null);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<OctagonSceneManager | null>(null);
  const audioRef = useRef<ArenaAudioSynth>(new ArenaAudioSynth());
  const inputRef = useRef<InputHub>(new InputHub());
  const boutRef = useRef<BoutState>(
    createBoutState(getFighterById('holloway'), getFighterById('mcgregor'), 'champion'),
  );

  const modeRef = useRef<GameMode>(mode);
  modeRef.current = mode;

  const titleStepRef = useRef<TitleStep>(titleStep);
  titleStepRef.current = titleStep;

  const showControlsRef = useRef<boolean>(showControls);
  showControlsRef.current = showControls;

  const koDelayRef = useRef<number>(0);

  const hudRefs = useRef<HudDomRefs>({
    clockEl: null,
    roundEl: null,
    momentumPipEl: null,
    redHeadBar: null,
    redBodyBar: null,
    redLegBar: null,
    redStaminaBar: null,
    redBlockBar: null,
    blueHeadBar: null,
    blueBodyBar: null,
    blueLegBar: null,
    blueStaminaBar: null,
    blueBlockBar: null,
    calloutEl: null,
    comboEl: null,
    rockedFlashEl: null,
  });

  // Sync body state attribute
  useEffect(() => {
    document.body.dataset.state = mode;
  }, [mode]);

  const rebuildBout = useCallback(
    (rId: string, bId: string, diff: 'pro' | 'champion' | 'legend') => {
      const next = createBoutState(getFighterById(rId), getFighterById(bId), diff);
      boutRef.current = next;
      koDelayRef.current = 0;
      setCurrentRound(1);
      setResultBout(null);
      sceneRef.current?.syncFighters(next);
      syncHudDom(hudRefs.current, next);
    },
    [],
  );

  const startFight = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    audioRef.current.unlock();
    inputRef.current.clear();
    rebuildBout(redId, blueId, difficulty);
    modeRef.current = 'playing';
    document.body.dataset.state = 'playing';
    setMode('playing');
    setShowControls(false);
    audioRef.current.playRoundBell(1);
  }, [redId, blueId, difficulty, rebuildBout]);

  const togglePause = useCallback(() => {
    if (showControlsRef.current) {
      setShowControls(false);
      return;
    }
    if (modeRef.current === 'playing') {
      inputRef.current.clear();
      modeRef.current = 'paused';
      setMode('paused');
    } else if (modeRef.current === 'paused') {
      inputRef.current.clear();
      modeRef.current = 'playing';
      setMode('playing');
    }
  }, []);

  const toggleMute = useCallback(() => {
    const next = !audioRef.current.muted;
    audioRef.current.muted = next;
    setMuted(next);
  }, []);

  const randomizeMatchup = useCallback(() => {
    const rIdx = Math.floor(Math.random() * UFC_ROSTER.length);
    let bIdx = Math.floor(Math.random() * UFC_ROSTER.length);
    if (bIdx === rIdx) {
      bIdx = (rIdx + 1) % UFC_ROSTER.length;
    }
    setRedId(UFC_ROSTER[rIdx].id);
    setBlueId(UFC_ROSTER[bIdx].id);
  }, []);

  // Sync fighter previews on Title screen when corners change
  useEffect(() => {
    if (modeRef.current === 'title') {
      rebuildBout(redId, blueId, difficulty);
    }
  }, [redId, blueId, difficulty, rebuildBout]);

  // Global keyboard shortcuts (Title Enter/Space/R/C, Mute M)
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !e.repeat) {
        toggleMute();
        return;
      }
      if (modeRef.current === 'title') {
        if (e.code === 'KeyC' && !e.repeat) {
          setShowControls((prev) => !prev);
          return;
        }
        if (e.code === 'Escape' && !e.repeat) {
          if (showControlsRef.current) {
            setShowControls(false);
          } else if (titleStepRef.current === 'select') {
            titleStepRef.current = 'menu';
            setTitleStep('menu');
          }
          return;
        }
        if (
          titleStepRef.current === 'select' &&
          e.code === 'KeyR' &&
          !e.repeat &&
          !showControlsRef.current
        ) {
          randomizeMatchup();
          return;
        }
        if (
          !showControlsRef.current &&
          (e.code === 'Enter' || e.code === 'Space')
        ) {
          e.preventDefault();
          if (titleStepRef.current === 'menu') {
            audioRef.current.unlock();
            titleStepRef.current = 'select';
            setTitleStep('select');
          } else {
            startFight();
          }
        }
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [randomizeMatchup, startFight, toggleMute]);

  // Mount Three.js WebGL scene & 60fps simulation loop ONCE
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const scene = new OctagonSceneManager(mount);
    sceneRef.current = scene;
    scene.syncFighters(boutRef.current);

    inputRef.current.setPauseCallback(togglePause);
    const unbindInputs = inputRef.current.bindListeners();

    let lastRoundSeen = 1;
    let lastControllerConnected = false;

    scene.startLoop((dt, elapsedSec) => {
      const bout = boutRef.current;

      // Sync gamepad connection indicator only when changed
      const gpConn = inputRef.current.controllerStatus.connected;
      if (gpConn !== lastControllerConnected) {
        lastControllerConnected = gpConn;
        setController({ ...inputRef.current.controllerStatus });
      } else {
        inputRef.current.pollGamepad();
      }

      if (modeRef.current === 'playing' && !showControlsRef.current) {
        const playerIn = inputRef.current.samplePlayerInput(dt);
        const aiIn = generateAiInput(
          bout.fighters[1],
          bout.fighters[0],
          bout,
          dt,
        );

        const events = stepBout(bout, [playerIn, aiIn], dt);

        for (const ev of events) {
          const strikeSpec = ev.strikeId ? STRIKES[ev.strikeId] : null;
          const isKick = Boolean(strikeSpec?.isKick);

          if (ev.type === 'strikeStart') {
            audioRef.current.playWhoosh(
              isKick,
              Boolean(strikeSpec && strikeSpec.baseDamage >= 13),
            );
          } else if (ev.type === 'feint') {
            audioRef.current.playFeint();
          } else if (ev.type === 'lunge') {
            audioRef.current.playLunge();
          } else if (ev.type === 'blocked') {
            audioRef.current.playImpact(0.35, true, false, isKick);
          } else if (ev.type === 'hit' || ev.type === 'knockdown') {
            const dmg = ev.damage ?? 10;
            const weight = Math.min(1.5, dmg / 14);
            audioRef.current.playImpact(weight, false, Boolean(ev.isCounter), isKick);
            if (ev.isHeavy) {
              scene.addCameraTrauma(
                ev.type === 'knockdown' ? 0.75 : ev.isCounter ? 0.54 : 0.44,
              );
            } else {
              scene.addCameraTrauma(0.2);
            }
            if (ev.hitPosition) {
              const atk = bout.fighters[ev.attackerIndex];
              const def = bout.fighters[ev.defenderIndex];
              const dx = def.x - atk.x;
              const dz = def.z - atk.z;
              const len = Math.hypot(dx, dz) || 1;
              scene.sweatPool.spawnBurst(
                ev.hitPosition,
                dx / len,
                dz / len,
                ev.isHeavy ? 26 : 12,
              );
            }
            if (ev.type === 'knockdown') {
              audioRef.current.playCrowdRoar(0.95);
            }
          } else if (ev.type === 'stunned') {
            audioRef.current.playRocked();
            audioRef.current.playCrowdRoar(0.8);
            scene.triggerRockedFlash(ev.hitPosition);
            scene.addCameraTrauma(0.58);
          } else if (ev.type === 'ko') {
            scene.addCameraTrauma(0.9);
            audioRef.current.playRoundBell(3);
            audioRef.current.playCrowdRoar(1.25);
          } else if (ev.type === 'roundEnd') {
            audioRef.current.playRoundBell(2);
          }
        }

        if (bout.round !== lastRoundSeen) {
          lastRoundSeen = bout.round;
          setCurrentRound(bout.round);
        }

        syncHudDom(hudRefs.current, bout);

        if (bout.koWinnerIndex !== null) {
          koDelayRef.current += dt;
          if (koDelayRef.current >= 1.85) {
            modeRef.current = 'gameover';
            document.body.dataset.state = 'gameover';
            setResultBout({ ...bout });
            setMode('gameover');
          }
        }
      }

      const visualMode =
        modeRef.current === 'title' ? titleStepRef.current : modeRef.current;
      scene.updateVisuals(bout, visualMode, elapsedSec, dt);
    });

    return () => {
      unbindInputs();
      scene.dispose();
    };
  }, [togglePause]);

  const redProfile = getFighterById(redId);
  const blueProfile = getFighterById(blueId);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090a0d]">
      {/* Isolated 3D WebGL Mount Container */}
      <div
        ref={canvasMountRef}
        data-testid="octagon-canvas"
        className="fixed inset-0 w-full h-full"
      />

      {/* Active Broadcast HUD */}
      {mode !== 'title' && (
        <BroadcastHud
          redName={redProfile.name}
          blueName={blueProfile.name}
          maxRounds={3}
          currentRound={currentRound}
          muted={muted}
          controllerConnected={controller.connected}
          hudRefs={hudRefs}
          onToggleMute={toggleMute}
          onPause={togglePause}
          onOpenControls={() => setShowControls(true)}
        />
      )}

      {/* Title Main Menu & Fighter Select Screen */}
      {mode === 'title' && (
        <TitleOverlay
          titleStep={titleStep}
          redId={redId}
          blueId={blueId}
          difficulty={difficulty}
          controller={controller}
          onEnterSelect={() => {
            audioRef.current.unlock();
            titleStepRef.current = 'select';
            setTitleStep('select');
          }}
          onBackToMenu={() => {
            titleStepRef.current = 'menu';
            setTitleStep('menu');
          }}
          onSelectRed={setRedId}
          onSelectBlue={setBlueId}
          onSelectDifficulty={setDifficulty}
          onRandomize={randomizeMatchup}
          onStartFight={startFight}
          onOpenControls={() => setShowControls(true)}
        />
      )}

      {/* Pause Modal */}
      {mode === 'paused' && !showControls && (
        <PauseModal
          onResume={togglePause}
          onRestart={startFight}
          onReturnTitle={() => {
            rebuildBout(redId, blueId, difficulty);
            titleStepRef.current = 'select';
            setTitleStep('select');
            modeRef.current = 'title';
            setMode('title');
          }}
          onOpenControls={() => setShowControls(true)}
        />
      )}

      {/* Post-Fight Official Result Modal */}
      {mode === 'gameover' && resultBout && (
        <ResultModal
          bout={resultBout}
          onRematch={startFight}
          onReturnTitle={() => {
            rebuildBout(redId, blueId, difficulty);
            titleStepRef.current = 'select';
            setTitleStep('select');
            modeRef.current = 'title';
            setMode('title');
          }}
        />
      )}

      {/* Controls & Controller Guide Modal */}
      {showControls && (
        <ControlsModal onClose={() => setShowControls(false)} />
      )}
    </div>
  );
}
