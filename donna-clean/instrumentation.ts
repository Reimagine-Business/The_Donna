export async function register() {
  // Only run instrumentation in production
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      await import('./sentry.server.config');
    } catch (err) {
      console.error('Sentry server initialization failed:', err);
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    try {
      await import('./sentry.edge.config');
    } catch (err) {
      console.error('Sentry edge initialization failed:', err);
    }
  }
}

export async function onRequestError(
  err: Error,
  request: {
    path: string;
    method: string;
    headers: { get: (name: string) => string | null };
  }
) {
  // Only send to Sentry in production
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  try {
    await import('./sentry.server.config');
    const Sentry = await import('@sentry/nextjs');

    Sentry.captureException(err, {
      tags: {
        path: request.path,
        method: request.method,
      },
      extra: {
        userAgent: request.headers.get('user-agent'),
      },
    });
  } catch (sentryErr) {
    // Sentry failed to capture exception
  }
}
