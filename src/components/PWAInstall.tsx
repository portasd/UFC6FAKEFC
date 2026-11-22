import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
    return outcome === 'accepted';
  };

  return {
    canInstall: Boolean(installPrompt) && !isInstalled,
    isInstalled,
    isIOS,
    promptInstall,
  };
}

export const PWAInstallButton: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (canInstall) {
            await promptInstall();
          } else {
            setShowGuide(true);
          }
        }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#161923]/90 hover:bg-[#232838] border border-white/25 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap ${className}`}
      >
        {canInstall ? (
          <Download className="w-3.5 h-3.5 text-[#ff8e1c]" aria-hidden="true" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 text-[#ff8e1c]" aria-hidden="true" />
        )}
        <span>{canInstall ? 'Install Android App' : 'Android App'}</span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install Android App Guide"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 pointer-events-auto"
        >
          <div className="w-full max-w-md bg-[#111319] border border-white/20 border-t-2 border-t-[#ff8e1c] p-5 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#ff8e1c]" />
                <h3 className="font-display font-extrabold text-xl uppercase text-white tracking-wide">
                  Android App &amp; APK Setup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close Android Setup Guide"
                className="p-1 text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-white/80 leading-relaxed">
              <div className="bg-white/5 border border-white/10 p-3">
                <div className="font-bold text-white uppercase tracking-wider mb-1">
                  1. Instant Install on Android Chrome
                </div>
                {isIOS ? (
                  <p>
                    Tap <strong>Share</strong> in Safari and choose{' '}
                    <strong>Add to Home Screen</strong> for fullscreen offline play.
                  </p>
                ) : (
                  <p>
                    Open this app URL in Chrome on Android and tap{' '}
                    <strong>Menu (⋮) → Install app</strong> (or{' '}
                    <strong>Add to Home screen</strong>) to launch fullscreen in landscape with offline caching and touch controls.
                  </p>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 p-3">
                <div className="font-bold text-white uppercase tracking-wider mb-1">
                  2. Build .APK File (Pre-Scaffolded Android Project)
                </div>
                <p>
                  The native <code className="text-[#ff9d3b]">android/</code> Gradle project (landscape-locked) and{' '}
                  <code className="text-[#ff9d3b]">.github/workflows/build-apk.yml</code> are included. Run{' '}
                  <code className="text-[#ff9d3b]">cd android &amp;&amp; ./gradlew assembleDebug</code>{' '}
                  with JDK 21 + Android SDK, or package the live URL directly via PWABuilder.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full py-2.5 bg-[#d92626] hover:bg-[#ef3333] text-white font-display font-bold text-sm uppercase tracking-wider cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-amber-500/95 text-[#090a0d] px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-lg pointer-events-none">
      <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Offline Mode · Ready to Fight</span>
    </div>
  );
};
