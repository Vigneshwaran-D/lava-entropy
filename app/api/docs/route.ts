import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/docs
 * Serves an inline Swagger UI page that loads /openapi.yaml.
 * No external CDN required — swagger-ui-dist is bundled locally.
 */
export async function GET(): Promise<NextResponse> {
    const html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LavaEntropy — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
      background: #0a0008;
    }
    #swagger-ui .topbar { background: #1a0010; }
    #swagger-ui .topbar .download-url-wrapper .select-label select { background: #2a0020; color: #ffd090; }
    .swagger-ui .info .title { color: #ff5500; }
    .swagger-ui .info { background: #12000e; padding: 16px 20px; border-radius: 8px; }
    .swagger-ui .info p, .swagger-ui .info li { color: #f5e6d0; }
    #header {
      background: linear-gradient(135deg, #1a0008 0%, #2d0010 100%);
      padding: 18px 32px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid rgba(255,85,0,0.3);
    }
    #header h1 { color: #ff5500; font-size: 1.4rem; font-weight: 900; margin: 0; }
    #header p { color: rgba(255,220,180,0.75); font-size: 0.85rem; margin: 0; }
  </style>
</head>
<body>
  <div id="header">
    <div>
      <h1>🌋 LavaEntropy API</h1>
      <p>Visual Chaos + System Entropy + Continuous Mixing → Reliable Randomness API</p>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/openapi.yaml",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      displayRequestDuration: true,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`;

    return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}
