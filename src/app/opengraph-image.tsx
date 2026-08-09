import { ImageResponse } from "next/og";

export const alt = "YPN USA — Exclusive mortgage ZIP territories";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px",
          background: "linear-gradient(135deg, #09081b 0%, #1a1540 45%, #0d3b2e 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#c4b5fd",
            marginBottom: 24,
          }}
        >
          YPN USA · app.ypnus.com
        </div>
        <div
          style={{
            fontSize: 58,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 920,
            marginBottom: 20,
          }}
        >
          Own your ZIP. Capture every borrower.
        </div>
        <div style={{ fontSize: 24, color: "rgba(255,255,255,0.78)", maxWidth: 820 }}>
          Exclusive territories · AI intake · Free → $29.99 → $99.99 → $299.99
        </div>
      </div>
    ),
    { ...size },
  );
}
