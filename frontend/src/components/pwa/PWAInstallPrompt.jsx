import React, { useEffect, useState } from "react";
import { FiDownload, FiX, FiRefreshCw } from "react-icons/fi";
import { registerSW } from "virtual:pwa-register";

/**
 * Handles two PWA UX pieces in one place:
 * 1. A custom "Install app" banner (Android/desktop Chrome/Edge fire
 *    `beforeinstallprompt`; iOS Safari doesn't support this API at all —
 *    installing there is manual via Share -> Add to Home Screen, so we
 *    show a short instruction banner instead when we detect iOS Safari).
 * 2. A small "Update available" toast driven by the service worker, so
 *    users on an old cached version get nudged to refresh instead of
 *    silently running stale code forever.
 */
const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateSW, setUpdateSW] = useState(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true;
    if (isStandalone) return; // already installed, nothing to do

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isSafari =
      /safari/i.test(window.navigator.userAgent) &&
      !/crios|fxios|chrome/i.test(window.navigator.userAgent);
    if (isIos && isSafari) {
      const dismissed = localStorage.getItem("pwa_ios_hint_dismissed");
      if (!dismissed) setIosHint(true);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    // vite-plugin-pwa's registerSW handles installing the service worker
    // and tells us when a new version has been fetched and is waiting.
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        setUpdateReady(true);
      },
      onOfflineReady() {
        // Could surface a toast here; kept silent so it isn't noisy on
        // every normal load once the app is cached.
      },
    });
    setUpdateSW(() => update);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const dismissIosHint = () => {
    localStorage.setItem("pwa_ios_hint_dismissed", "1");
    setIosHint(false);
  };

  return (
    <>
      {showBanner && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[9999] bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl p-4 flex items-start gap-3">
          <FiDownload className="text-emerald-500 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
              Install Hello Chat
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
              Add it to your home screen for a faster, app-like experience.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Install
              </button>
              <button
                onClick={() => setShowBanner(false)}
                className="text-xs font-medium text-gray-500 dark:text-neutral-400 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            aria-label="Dismiss"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-200"
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      {iosHint && (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl p-4 flex items-start gap-3">
          <FiDownload className="text-emerald-500 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
              Install Hello Chat on iOS
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
              Tap the Share icon, then "Add to Home Screen".
            </p>
          </div>
          <button
            onClick={dismissIosHint}
            aria-label="Dismiss"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-200"
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      {updateReady && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-neutral-900 text-white rounded-full shadow-xl px-4 py-2 flex items-center gap-3 text-sm">
          <FiRefreshCw size={16} />
          <span>New version available</span>
          <button
            onClick={() => updateSW && updateSW(true)}
            className="font-semibold text-emerald-400 hover:text-emerald-300"
          >
            Refresh
          </button>
        </div>
      )}
    </>
  );
};

export default PWAInstallPrompt;
