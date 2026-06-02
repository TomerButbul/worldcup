"use client";

// Catches errors in the root layout itself. Must render its own <html>/<body>.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#0e1545",
          color: "#eaf3ee",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <div style={{ fontSize: "3rem" }}>🟥</div>
        <h1 style={{ margin: 0 }}>Something broke</h1>
        <p style={{ color: "#8fa89d", margin: 0 }}>The app hit an unexpected error.</p>
        <button
          onClick={reset}
          style={{
            border: "none",
            borderRadius: "0.75rem",
            background: "#19c37d",
            color: "#04140e",
            fontWeight: 600,
            padding: "0.65rem 1.25rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
