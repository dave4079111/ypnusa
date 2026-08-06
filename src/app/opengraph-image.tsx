import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LoanPilot AI — Mortgage Borrower Intake Automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #031525 0%, #042f3a 45%, #012f3c 100%)",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Badge */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "999px",
            padding: "8px 20px",
            color: "#a5f3fc",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: "28px",
          }}
        >
          LoanPilot AI · Mortgage Intake Automation
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "58px",
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.1,
            maxWidth: "900px",
            marginBottom: "24px",
          }}
        >
          Qualify mortgage borrowers instantly. Close more loans on autopilot.
        </div>

        {/* Sub */}
        <div
          style={{
            fontSize: "22px",
            color: "rgba(255,255,255,0.75)",
            textAlign: "center",
            maxWidth: "780px",
            marginBottom: "40px",
          }}
        >
          AI-powered intake for FHA · VA · DSCR · HELOC · Refinance · Jumbo
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
          {["Instant qualification", "Auto CRM sync", "LO routing", "Nurture automations"].map((f) => (
            <div
              key={f}
              style={{
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: "999px",
                padding: "10px 22px",
                color: "rgba(255,255,255,0.9)",
                fontSize: "16px",
                fontWeight: 600,
                background: "rgba(255,255,255,0.08)",
              }}
            >
              {f}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            color: "rgba(255,255,255,0.4)",
            fontSize: "18px",
            letterSpacing: "0.1em",
          }}
        >
          ypnusa.com
        </div>
      </div>
    ),
    { ...size }
  );
}
