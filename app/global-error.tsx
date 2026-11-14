"use client";

/**
 * The last resort, for when even the page frame breaks. It replaces the whole document, so it carries its own simple
 * styling (the app's stylesheet is not available here) and follows the phone's light or dark setting.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "2rem 1.5rem",
          fontFamily: "system-ui, sans-serif",
          lineHeight: 1.5,
          textAlign: "center",
          colorScheme: "light dark",
        }}
      >
        <main style={{ maxWidth: "26rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 .5rem" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 1.25rem", opacity: 0.8 }}>Nothing you saved was lost. Please try again.</p>
          <button
            onClick={() => retry()}
            style={{ font: "inherit", fontWeight: 600, padding: "0.9rem 1.5rem", borderRadius: ".75rem", border: 0, background: "#15803d", color: "#fff", minHeight: 48 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
