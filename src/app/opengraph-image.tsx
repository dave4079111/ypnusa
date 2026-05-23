import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #031525 0%, #064e5b 52%, #0f766e 100%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Arial, sans-serif",
          height: "100%",
          justifyContent: "center",
          padding: 72,
          width: "100%",
        }}
      >
        <div
          style={{
            border: "2px solid rgba(255,255,255,.25)",
            borderRadius: 52,
            display: "flex",
            flexDirection: "column",
            gap: 36,
            padding: 56,
            width: "100%",
          }}
        >
          <div style={{ color: "#a5f3fc", fontSize: 34, fontWeight: 700, letterSpacing: 8 }}>
            LOANPILOT AI
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 900, lineHeight: 1.02 }}>
            <span>Mortgage borrower</span>
            <span>intake that converts.</span>
          </div>
          <div style={{ color: "#d1faf7", display: "flex", fontSize: 30, gap: 28 }}>
            <span>Score</span>
            <span>Sync</span>
            <span>Route</span>
            <span>Nurture</span>
            <span>Book</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
