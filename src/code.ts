import { FLAM_OVERLAY_B64 } from "./flamAsset";

// FLAM mockup dimensions (FLAM-overlay.png)
const MOCKUP_W = 853;
const MOCKUP_H = 852;

// Screen placeholder position within the mockup (from Figma metadata)
const SCREEN_X = 288.52;
const SCREEN_Y = 195.81;
const SCREEN_W = 295.31;
const SCREEN_H = 218.61;

// Target screen size in the output (1:1 with the original screen_frame)
const TARGET_SCREEN_W = 320;
const TARGET_SCREEN_H = 240;

// Scale factors to map the mockup so the screen area = 320×240
const SCALE_X = TARGET_SCREEN_W / SCREEN_W; // ≈ 1.084
const SCALE_Y = TARGET_SCREEN_H / SCREEN_H; // ≈ 1.098

const VALID_TYPES = ["FRAME", "COMPONENT", "INSTANCE"];

figma.showUI(__html__, { width: 300, height: 220, title: "FLAM Mockup" });

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === "generate") {
    await generateMockups();
  }
  if (msg.type === "close") {
    figma.closePlugin();
  }
};

async function generateMockups() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({ type: "error", message: "Sélectionne au moins une frame." });
    return;
  }

  const nodes = selection.filter(n => VALID_TYPES.includes(n.type));

  if (nodes.length === 0) {
    figma.ui.postMessage({ type: "error", message: "Aucune frame valide dans la sélection." });
    return;
  }

  figma.ui.postMessage({ type: "loading", total: nodes.length });

  // Decode the FLAM image once, reuse the hash for all mockups
  const flamBytes = base64ToUint8Array(FLAM_OVERLAY_B64);
  const flamImage = figma.createImage(flamBytes);

  const outW = Math.round(MOCKUP_W * SCALE_X);
  const outH = Math.round(MOCKUP_H * SCALE_Y);

  const generated: FrameNode[] = [];

  try {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      figma.ui.postMessage({ type: "progress", current: i + 1, total: nodes.length, name: node.name });

      const screenBytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 1 } });
      const screenImage = figma.createImage(screenBytes);

      const mockupFrame = figma.createFrame();
      mockupFrame.name = `FLAM — ${node.name}`;
      mockupFrame.resize(outW, outH);
      mockupFrame.clipsContent = true;
      mockupFrame.fills = [];

      // Background: FLAM packshot
      const flamRect = figma.createRectangle();
      flamRect.name = "FLAM Device";
      flamRect.x = 0;
      flamRect.y = 0;
      flamRect.resize(outW, outH);
      flamRect.fills = [{ type: "IMAGE", imageHash: flamImage.hash, scaleMode: "FILL" }];
      mockupFrame.appendChild(flamRect);

      // Foreground: screen content at 320×240
      const screenRect = figma.createRectangle();
      screenRect.name = "Screen Content";
      screenRect.x = Math.round(SCREEN_X * SCALE_X);
      screenRect.y = Math.round(SCREEN_Y * SCALE_Y);
      screenRect.resize(TARGET_SCREEN_W, TARGET_SCREEN_H);
      screenRect.fills = [{ type: "IMAGE", imageHash: screenImage.hash, scaleMode: "FILL" }];
      mockupFrame.appendChild(screenRect);

      // Place to the right of the source frame
      const sourceX = node.absoluteTransform[0][2];
      const sourceY = node.absoluteTransform[1][2];
      mockupFrame.x = sourceX + node.width + 80;
      mockupFrame.y = sourceY;

      figma.currentPage.appendChild(mockupFrame);
      generated.push(mockupFrame);
    }

    figma.currentPage.selection = generated;
    figma.viewport.scrollAndZoomIntoView(generated);

    figma.ui.postMessage({ type: "success", count: generated.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    figma.ui.postMessage({ type: "error", message });
  }
}

function base64ToUint8Array(b64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const clean = b64.replace(/=+$/, "");
  const len = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(len);
  let i = 0, j = 0;

  while (i < clean.length) {
    const a = lookup[clean.charCodeAt(i++)];
    const b = lookup[clean.charCodeAt(i++)];
    const c = lookup[clean.charCodeAt(i++)];
    const d = lookup[clean.charCodeAt(i++)];
    bytes[j++] = (a << 2) | (b >> 4);
    if (j < len) bytes[j++] = ((b & 0xf) << 4) | (c >> 2);
    if (j < len) bytes[j++] = ((c & 0x3) << 6) | d;
  }
  return bytes;
}
