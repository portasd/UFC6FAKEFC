import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArenaType,
  BoutState,
  createBoutState,
  DifficultyLevel,
  GameplayMode,
  generateAiInput,
  stepBout,
} from './game/combatEngine';
import {
  getFighterById,
  matchesRosterFilter,
  RosterFilter,
  UFC_ROSTER,
} from './game/fighters';
import { STRIKES } from './game/strikes';
import { ControllerStatus, InputHub } from './game/inputHub';
import {
  CAMERA_PRESET_OPTIONS,
  CameraPreset,
  cloneDefaultControlSettings,
  ControlSettings,
  loadControlSettings,
  saveControlSettings,
} from './game/controlSettings';
import { ArenaAudioSynth } from './game/audioSynth';
import { OctagonSceneManager } from './game/octagonScene';
import { BroadcastHud, HudDomRefs, syncHudDom } from './components/BroadcastHud';
import { TitleOverlay, TitleStep } from './components/TitleOverlay';
import { MobileControls } from './components/MobileControls';
import { TouchLayoutEditor } from './components/TouchLayoutEditor';
import { OfflineIndicator } from './components/PWAInstall';
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
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('champion');
  const [gameplayMode, setGameplayMode] = useState<GameplayMode>('arcade');
  const [arena, setArena] = useState<ArenaType>('octagon');
  const [maxRounds, setMaxRounds] = useState<number>(3);
  const [weightFilter, setWeightFilter] = useState<RosterFilter>('all');
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showLayoutEditor, setShowLayoutEditor] = useState(false);
  const [touchControlsEnabled, setTouchControlsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0
    );
  });
  const [controlSettings, setControlSettings] = useState<ControlSettings>(() =>
    loadControlSettings(),
  );
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

  const showLayoutEditorRef = useRef<boolean>(showLayoutEditor);
  showLayoutEditorRef.current = showLayoutEditor;

  const cameraPresetRef = useRef<CameraPreset>(controlSettings.cameraPreset);
  cameraPresetRef.current = controlSettings.cameraPreset;

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

  // Sync body state attribute & live control settings
  useEffect(() => {
    document.body.dataset.state = mode;
  }, [mode]);

  useEffect(() => {
    inputRef.current.setSettings(controlSettings);
    sceneRef.current?.setCameraPreset(controlSettings.cameraPreset);
    saveControlSettings(controlSettings);
  }, [controlSettings]);

  const updateControlSettings = useCallback((next: ControlSettings) => {
    setControlSettings(next);
  }, []);

  const handleSelectCameraPreset = useCallback((cameraPreset: CameraPreset) => {
    setControlSettings((prev) => ({ ...prev, cameraPreset }));
  }, []);

  const resetControlSettings = useCallback(() => {
    setControlSettings(cloneDefaultControlSettings());
  }, []);

  // Auto-enable mobile touch overlay if a touch pointer interacts
  useEffect(() => {
    const onFirstTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        setTouchControlsEnabled(true);
      }
    };
    window.addEventListener('pointerdown', onFirstTouch, { passive: true });
    return () => window.removeEventListener('pointerdown', onFirstTouch);
  }, []);

  const rebuildBout = useCallback(
    (
      rId: string,
      bId: string,
      diff: DifficultyLevel,
      simMode: boolean,
      arenaChoice: ArenaType,
      rounds: number,
    ) => {
      const next = createBoutState(
        getFighterById(rId),
        getFighterById(bId),
        diff,
        simMode,
        arenaChoice,
        rounds,
      );
      boutRef.current = next;
      koDelayRef.current = 0;
      setCurrentRound(1);
      setResultBout(null);
      sceneRef.current?.setArena(arenaChoice);
      sceneRef.current?.syncFighters(next);
      syncHudDom(hudRefs.current, next);
    },
    [],
  );

  const handleSelectWeightFilter = useCallback(
    (nextFilter: RosterFilter) => {
      setWeightFilter(nextFilter);
      const matching = UFC_ROSTER.filter((f) => matchesRosterFilter(f, nextFilter));
      if (matching.length >= 2) {
        const redValid = matching.some((f) => f.id === redId);
        const blueValid = matching.some((f) => f.id === blueId);
        let nextRed = redValid ? redId : matching[0].id;
        let nextBlue = blueValid ? blueId : matching[1].id;
        if (nextRed === nextBlue) {
          nextBlue = matching.find((f) => f.id !== nextRed)?.id ?? matching[0].id;
        }
        if (nextRed !== redId) setRedId(nextRed);
        if (nextBlue !== blueId) setBlueId(nextBlue);
      }
    },
    [redId, blueId],
  );

  const startFight = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    audioRef.current.unlock();
    inputRef.current.clear();
    rebuildBout(
      redId,
      blueId,
      difficulty,
      gameplayMode === 'simulation',
      arena,
      maxRounds,
    );
    modeRef.current = 'playing';
    document.body.dataset.state = 'playing';
    setMode('playing');
    setShowControls(false);
    audioRef.current.playRoundBell(1);
  }, [redId, blueId, difficulty, gameplayMode, arena, maxRounds, rebuildBout]);

  const togglePause = useCallback(() => {
    if (showLayoutEditorRef.current) {
      setShowLayoutEditor(false);
      return;
    }
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
    const pool = UFC_ROSTER.filter((f) => matchesRosterFilter(f, weightFilter));
    const list = pool.length >= 2 ? pool : UFC_ROSTER;
    const rIdx = Math.floor(Math.random() * list.length);
    let bIdx = Math.floor(Math.random() * list.length);
    if (bIdx === rIdx) {
      bIdx = (rIdx + 1) % list.length;
    }
    setRedId(list[rIdx].id);
    setBlueId(list[bIdx].id);
  }, [weightFilter]);

  // Sync fighter previews & active 3D arena on Title screen when corners, mode, or arena change
  useEffect(() => {
    if (modeRef.current === 'title') {
      rebuildBout(
        redId,
        blueId,
        difficulty,
        gameplayMode === 'simulation',
        arena,
        maxRounds,
      );
    }
  }, [redId, blueId, difficulty, gameplayMode, arena, maxRounds, rebuildBout]);

  // Global keyboard shortcuts (Title Enter/Space/R/C, Mute M, Camera V)
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !e.repeat) {
        toggleMute();
        return;
      }
      if (
        modeRef.current === 'playing' &&
        e.code === 'KeyV' &&
        !e.repeat &&
        !showControlsRef.current &&
        !showLayoutEditorRef.current
      ) {
        setControlSettings((prev) => {
          const idx = Math.max(
            0,
            CAMERA_PRESET_OPTIONS.findIndex((c) => c.id === prev.cameraPreset),
          );
          const next =
            CAMERA_PRESET_OPTIONS[(idx + 1) % CAMERA_PRESET_OPTIONS.length].id;
          return { ...prev, cameraPreset: next };
        });
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
            titleStepRef.current = 'setup';
            setTitleStep('setup');
          } else if (titleStepRef.current === 'setup') {
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
            titleStepRef.current = 'setup';
            setTitleStep('setup');
          } else if (titleStepRef.current === 'setup') {
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
    scene.setArena(boutRef.current.arena);
    scene.setCameraPreset(cameraPresetRef.current);
    scene.syncFighters(boutRef.current);

    inputRef.current.setPauseCallback(togglePause);
    const unbindInputs = inputRef.current.bindListeners();

    let lastRoundSeen = 1;
    let lastControllerConnected = false;

    scene.startLoop((dt, elapsedSec) => {
      const bout = boutRef.current;
      const isPerspectiveFollowCam =
        cameraPresetRef.current === 'firstPerson' ||
        cameraPresetRef.current === 'thirdPerson';

      // Sync gamepad connection indicator only when changed
      const gpConn = inputRef.current.controllerStatus.connected;
      if (gpConn !== lastControllerConnected) {
        lastControllerConnected = gpConn;
        setController({ ...inputRef.current.controllerStatus });
      } else {
        inputRef.current.pollGamepad(
          bout.fighters[0].facingYaw,
          isPerspectiveFollowCam,
        );
      }

      if (
        modeRef.current === 'playing' &&
        !showControlsRef.current &&
        !showLayoutEditorRef.current
      ) {
        const playerIn = inputRef.current.samplePlayerInput(
          dt,
          bout.fighters[0].facingYaw,
          isPerspectiveFollowCam,
        );
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
          if (koDelayRef.current >= 2.45) {
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
      <OfflineIndicator />

      {/* Isolated 3D WebGL Mount Container */}
      <div
        ref={canvasMountRef}
        data-testid="octagon-canvas"
        className="fixed inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />

      {/* Active Broadcast HUD */}
      {mode !== 'title' && !showLayoutEditor && (
        <BroadcastHud
          redName={redProfile.name}
          blueName={blueProfile.name}
          maxRounds={maxRounds}
          currentRound={currentRound}
          simulationMode={gameplayMode === 'simulation'}
          controllerConnected={controller.connected}
          touchControlsEnabled={touchControlsEnabled}
          keyboardBindings={controlSettings.keyboard}
          hudRefs={hudRefs}
          onPause={togglePause}
        />
      )}

      {/* Mobile Touch Controls */}
      {mode === 'playing' &&
        !showControls &&
        !showLayoutEditor &&
        touchControlsEnabled && (
          <MobileControls
            inputHub={inputRef.current}
            settings={controlSettings.touch}
          />
        )}

      {/* Interactive Touch Button & Stick Layout Editor */}
      {showLayoutEditor && (
        <TouchLayoutEditor
          settings={controlSettings.touch}
          onSave={(nextTouch) => {
            setControlSettings((prev) => ({
              ...prev,
              touch: nextTouch,
            }));
            setTouchControlsEnabled(true);
            setShowLayoutEditor(false);
          }}
          onCancel={() => setShowLayoutEditor(false)}
        />
      )}

      {/* Title Main Menu, Match Setup & Fighter Select Screen */}
      {mode === 'title' && !showLayoutEditor && (
        <TitleOverlay
          titleStep={titleStep}
          redId={redId}
          blueId={blueId}
          difficulty={difficulty}
          gameplayMode={gameplayMode}
          arena={arena}
          maxRounds={maxRounds}
          weightFilter={weightFilter}
          cameraPreset={controlSettings.cameraPreset}
          controller={controller}
          onEnterSetup={() => {
            audioRef.current.unlock();
            titleStepRef.current = 'setup';
            setTitleStep('setup');
          }}
          onEnterSelect={() => {
            audioRef.current.unlock();
            titleStepRef.current = 'select';
            setTitleStep('select');
          }}
          onBackToMenu={() => {
            titleStepRef.current = 'menu';
            setTitleStep('menu');
          }}
          onBackToSetup={() => {
            titleStepRef.current = 'setup';
            setTitleStep('setup');
          }}
          onSelectRed={setRedId}
          onSelectBlue={setBlueId}
          onSelectDifficulty={setDifficulty}
          onSelectGameplayMode={setGameplayMode}
          onSelectArena={setArena}
          onSelectMaxRounds={setMaxRounds}
          onSelectWeightFilter={handleSelectWeightFilter}
          onSelectCameraPreset={handleSelectCameraPreset}
          onRandomize={randomizeMatchup}
          onStartFight={startFight}
          onOpenControls={() => setShowControls(true)}
        />
      )}

      {/* Pause Modal */}
      {mode === 'paused' && !showControls && !showLayoutEditor && (
        <PauseModal
          cameraPreset={controlSettings.cameraPreset}
          muted={muted}
          touchEnabled={touchControlsEnabled}
          onSelectCameraPreset={handleSelectCameraPreset}
          onToggleMute={toggleMute}
          onToggleTouchEnabled={() => setTouchControlsEnabled((prev) => !prev)}
          onResume={togglePause}
          onRestart={startFight}
          onReturnTitle={() => {
            rebuildBout(
              redId,
              blueId,
              difficulty,
              gameplayMode === 'simulation',
              arena,
              maxRounds,
            );
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
            rebuildBout(
              redId,
              blueId,
              difficulty,
              gameplayMode === 'simulation',
              arena,
              maxRounds,
            );
            titleStepRef.current = 'select';
            setTitleStep('select');
            modeRef.current = 'title';
            setMode('title');
          }}
        />
      )}

      {/* Controls Customization Modal */}
      {showControls && !showLayoutEditor && (
        <ControlsModal
          settings={controlSettings}
          touchEnabled={touchControlsEnabled}
          onUpdateSettings={updateControlSettings}
          onToggleTouchEnabled={() => setTouchControlsEnabled((prev) => !prev)}
          onOpenLayoutEditor={() => {
            setTouchControlsEnabled(true);
            setShowControls(false);
            setShowLayoutEditor(true);
          }}
          onResetDefaults={resetControlSettings}
          onClose={() => setShowControls(false)}
        />
      )}
    </div>
  );
}
