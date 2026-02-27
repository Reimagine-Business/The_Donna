'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Don't show if dismissed recently (7 days)
    const dismissed = localStorage.getItem('pwa-dismissed');
    if (
      dismissed &&
      Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000
    )
      return;

    // Detect iOS
    const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iosDevice);

    if (iosDevice) {
      // Show iOS instructions after 30 seconds
      const timer = setTimeout(() => setShowPrompt(true), 30000);
      return () => clearTimeout(timer);
    }

    // Android / Desktop — listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after 30 seconds
      setTimeout(() => setShowPrompt(true), 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '5rem',
        left: '1rem',
        right: '1rem',
        zIndex: 50,
        background: 'rgba(15, 15, 35, 0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '1rem',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div style={{ flex: 1 }}>
        <p
          style={{
            color: '#e2e8f0',
            fontSize: '0.875rem',
            fontWeight: 500,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {isIOS
            ? 'Tap the share button then "Add to Home Screen" to install The Donna'
            : 'Add The Donna to your home screen for quick access'}
        </p>
      </div>
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {!isIOS && (
          <button
            onClick={handleInstall}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              color: '#ffffff',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Install
          </button>
        )}
        <button
          onClick={handleDismiss}
          style={{
            padding: '0.5rem',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '0.8125rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {isIOS ? 'Got it' : 'Later'}
        </button>
      </div>
    </div>
  );
}
