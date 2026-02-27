'use client';

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f0f23',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#e2e8f0',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          marginBottom: '1.5rem',
        }}
      >
        D
      </div>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          marginBottom: '1rem',
          color: '#f1f5f9',
        }}
      >
        You&apos;re Offline
      </h1>
      <p
        style={{
          fontSize: '1rem',
          lineHeight: 1.6,
          maxWidth: '400px',
          color: '#94a3b8',
          marginBottom: '2rem',
        }}
      >
        Looks like we&apos;re offline right now. Don&apos;t worry — we&apos;ll
        be back as soon as your connection returns.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '0.75rem 2rem',
          borderRadius: '0.5rem',
          border: 'none',
          background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
          color: '#ffffff',
          fontSize: '1rem',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  );
}
