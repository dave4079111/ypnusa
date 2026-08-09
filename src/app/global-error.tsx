"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#020617",
          color: "#f8fafc",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <title>YPN USA App error</title>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "48px 24px",
          }}
        >
          <section
            style={{
              width: "min(100%, 640px)",
              border: "1px solid rgba(103, 232, 249, 0.28)",
              borderRadius: 28,
              background: "rgba(15, 23, 42, 0.96)",
              boxShadow: "0 24px 80px rgba(8, 145, 178, 0.18)",
              padding: 32,
            }}
          >
            <p
              style={{
                margin: "0 0 18px",
                color: "#67e8f9",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
              }}
            >
              YPN USA
            </p>
            <h1 style={{ margin: "0 0 12px", fontSize: 32, lineHeight: 1.1 }}>
              The app needs a quick refresh.
            </h1>
            <p style={{ margin: "0 0 24px", color: "#cbd5e1", lineHeight: 1.7 }}>
              We caught the failure before it broke the whole experience. Try again to reload the app shell.
            </p>
            {error.digest ? (
              <p style={{ margin: "0 0 24px", color: "#64748b", fontSize: 12 }}>
                Reference: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                border: 0,
                borderRadius: 999,
                background: "#67e8f9",
                color: "#020617",
                cursor: "pointer",
                fontWeight: 700,
                padding: "12px 20px",
              }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
