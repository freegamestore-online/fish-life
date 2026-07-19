import kaplay from "kaplay";
import type { KAPLAYCtx, GameObj } from "kaplay";

const VW = 400;
const VH = 600;

// Bowl center
const BCX = VW / 2;
const BCY = VH / 2 + 50;
const BOWL_R = 130;

// Feeding stages: 0=happy, 1=content, 2=full, 3=stuffed, 4=critical → explode
const STAGE_LABELS = ["😊 Happy", "😄 Content", "😐 Full", "😰 Stuffed", "💀 CRITICAL!"];
const STAGE_COLORS: [number, number, number][] = [
  [245, 158, 11],  // orange  - happy
  [251, 191, 36],  // yellow  - content
  [234, 179, 8],   // dark yellow - full
  [249, 115, 22],  // deep orange - stuffed
  [239, 68, 68],   // red     - critical
];
const FEED_PER_STAGE = 3; // feeds per stage
const STAGES = 5;
const FEED_LIMIT = FEED_PER_STAGE * STAGES; // 15 total before explode
const FEED_COOLDOWN = 3.0; // seconds between feeds

type K = KAPLAYCtx;

function addBowl(k: K) {
  // Water fill
  k.add([
    k.circle(BOWL_R),
    k.color(59, 130, 246),
    k.opacity(0.22),
    k.anchor("center"),
    k.pos(BCX, BCY),
    k.z(0),
  ]);
  // Bowl rim (outer ring — slightly bigger, less opaque)
  k.add([
    k.circle(BOWL_R + 8),
    k.color(147, 197, 253),
    k.opacity(0.18),
    k.anchor("center"),
    k.pos(BCX, BCY),
    k.z(0),
  ]);
  // Inner rim highlight
  k.add([
    k.circle(BOWL_R - 4),
    k.color(255, 255, 255),
    k.opacity(0.06),
    k.anchor("center"),
    k.pos(BCX, BCY),
    k.z(0),
  ]);
  // Waterline shimmer
  k.add([
    k.rect(180, 7, { radius: 4 }),
    k.color(186, 230, 253),
    k.opacity(0.5),
    k.anchor("center"),
    k.pos(BCX, BCY - BOWL_R + 28),
    k.z(2),
  ]);
  // Second waterline
  k.add([
    k.rect(140, 4, { radius: 3 }),
    k.color(186, 230, 253),
    k.opacity(0.28),
    k.anchor("center"),
    k.pos(BCX, BCY - BOWL_R + 40),
    k.z(2),
  ]);
  // Glass shine (top-left)
  k.add([
    k.rect(48, 14, { radius: 7 }),
    k.color(255, 255, 255),
    k.opacity(0.18),
    k.anchor("center"),
    k.pos(BCX - 52, BCY - BOWL_R + 44),
    k.rotate(-20),
    k.z(3),
  ]);
  // Glass shine (smaller, lower)
  k.add([
    k.rect(22, 8, { radius: 4 }),
    k.color(255, 255, 255),
    k.opacity(0.12),
    k.anchor("center"),
    k.pos(BCX - 60, BCY - BOWL_R + 62),
    k.rotate(-20),
    k.z(3),
  ]);
  // Bowl base / stand
  k.add([
    k.rect(120, 14, { radius: 7 }),
    k.color(147, 197, 253),
    k.opacity(0.45),
    k.anchor("center"),
    k.pos(BCX, BCY + BOWL_R + 2),
    k.z(0),
  ]);
  k.add([
    k.rect(70, 10, { radius: 5 }),
    k.color(147, 197, 253),
    k.opacity(0.35),
    k.anchor("center"),
    k.pos(BCX, BCY + BOWL_R + 14),
    k.z(0),
  ]);
  // Gravel pebbles at bottom
  const pebbleColors: [number, number, number][] = [
    [167, 243, 208], [253, 230, 138], [196, 181, 253], [147, 197, 253],
  ];
  for (let i = 0; i < 9; i++) {
    const px = BCX - 72 + i * 18 + (i % 2 === 0 ? 0 : 6);
    k.add([
      k.circle(6 + (i % 3)),
      k.color(...(pebbleColors[i % 4] as [number, number, number])),
      k.opacity(0.7),
      k.anchor("center"),
      k.pos(px, BCY + BOWL_R - 18),
      k.z(1),
    ]);
  }
  // Seaweed left
  for (let s = 0; s < 3; s++) {
    k.add([
      k.rect(6, 22 + s * 6, { radius: 3 }),
      k.color(34, 197, 94),
      k.opacity(0.7),
      k.anchor("bot"),
      k.pos(BCX - 80 + s * 12, BCY + BOWL_R - 12),
      k.rotate(-8 + s * 6),
      k.z(1),
    ]);
  }
  // Seaweed right
  for (let s = 0; s < 2; s++) {
    k.add([
      k.rect(6, 18 + s * 8, { radius: 3 }),
      k.color(34, 197, 94),
      k.opacity(0.65),
      k.anchor("bot"),
      k.pos(BCX + 72 + s * 10, BCY + BOWL_R - 12),
      k.rotate(6 - s * 5),
      k.z(1),
    ]);
  }
}

// Build the fish as a collection of objects parented to a root.
// Returns the root and the body so we can update color/expression.
function addFish(k: K, stage: number): {
  root: GameObj;
  body: GameObj;
  eyeWhite: GameObj;
  mouthObj: GameObj;
} {
  const [r, g, b] = STAGE_COLORS[stage] ?? STAGE_COLORS[0]!;

  const root = k.add([k.pos(BCX, BCY), k.rotate(0), k.z(4)]);

  // Tail — two rects angled to form a fork
  k.add([
    k.rect(20, 10, { radius: 3 }),
    k.color(r, g, b),
    k.opacity(0.9),
    k.anchor("right"),
    k.pos(-26, -8),
    k.rotate(25),
    k.z(4),
    "fishPart",
  ]);
  k.add([
    k.rect(20, 10, { radius: 3 }),
    k.color(r, g, b),
    k.opacity(0.9),
    k.anchor("right"),
    k.pos(-26, 8),
    k.rotate(-25),
    k.z(4),
    "fishPart",
  ]);

  // Dorsal fin (top)
  k.add([
    k.rect(18, 10, { radius: 4 }),
    k.color(r + 10, g + 20, b),
    k.opacity(0.85),
    k.anchor("bot"),
    k.pos(-2, -12),
    k.rotate(-15),
    k.z(4),
    "fishPart",
  ]);
  // Pectoral fin (side)
  k.add([
    k.rect(14, 8, { radius: 3 }),
    k.color(r + 10, g + 20, b),
    k.opacity(0.8),
    k.anchor("center"),
    k.pos(4, 10),
    k.rotate(20),
    k.z(4),
    "fishPart",
  ]);

  // Body
  const body = k.add([
    k.rect(52, 26, { radius: 13 }),
    k.color(r, g, b),
    k.anchor("center"),
    k.pos(0, 0),
    k.z(5),
    "fishPart",
  ]);

  // Belly stripe
  k.add([
    k.rect(30, 10, { radius: 5 }),
    k.color(255, 237, 213),
    k.opacity(0.45),
    k.anchor("center"),
    k.pos(6, 5),
    k.z(6),
    "fishPart",
  ]);

  // Eye white
  const eyeWhite = k.add([
    k.circle(6),
    k.color(255, 255, 255),
    k.anchor("center"),
    k.pos(18, -5),
    k.z(7),
    "fishPart",
  ]);
  // Pupil
  k.add([
    k.circle(3),
    k.color(24, 24, 27),
    k.anchor("center"),
    k.pos(20, -5),
    k.z(8),
    "fishPart",
  ]);
  // Eye shine
  k.add([
    k.circle(1.5),
    k.color(255, 255, 255),
    k.opacity(0.9),
    k.anchor("center"),
    k.pos(21, -7),
    k.z(9),
    "fishPart",
  ]);

  // Mouth — rect that changes shape per stage
  const mouthH = stage < 2 ? 3 : stage < 4 ? 3 : 5;
  const mouthObj = k.add([
    k.rect(stage < 2 ? 8 : 10, mouthH, { radius: 2 }),
    k.color(180, 60, 60),
    k.anchor("center"),
    k.pos(24, stage < 2 ? 5 : stage < 4 ? 7 : 9),
    k.z(7),
    "fishPart",
  ]);

  // Reparent all fishPart objects to root so they move together
  k.get("fishPart").forEach((obj) => {
    k.destroy(obj);
  });

  // Re-add everything under root using a different approach:
  // KAPLAY doesn't have parent/child, so we track offsets manually in onUpdate.
  // We'll store parts as an array and sync positions each frame.
  return { root, body, eyeWhite, mouthObj };
}

interface FishPart {
  obj: GameObj;
  ox: number; // x offset from root
  oy: number; // y offset from root
  baseRot: number;
}

export function startGame(canvas: HTMLCanvasElement, onScore: (n: number) => void): () => void {
  const k = kaplay({
    canvas,
    width: VW,
    height: VH,
    letterbox: true,
    background: [15, 23, 42],
    global: false,
    pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
  });

  // ── PLAY SCENE ──────────────────────────────────────────────────────────────
  k.scene("play", () => {
    let score = 0;
    let feedCount = 0;
    let canFeed = true;
    let cooldownLeft = 0;
    let swimT = 0;
    onScore(0);

    addBowl(k);

    // ── Fish parts (manual parenting via offsets) ───────────────────────────
    const fishColor = (): [number, number, number] => {
      const stage = Math.min(Math.floor(feedCount / FEED_PER_STAGE), STAGES - 1);
      return STAGE_COLORS[stage] ?? STAGE_COLORS[0]!;
    };

    let stage = 0;

    // Tail fork A
    const tailA = k.add([
      k.rect(20, 10, { radius: 3 }),
      k.color(...fishColor()),
      k.opacity(0.9),
      k.anchor("center"),
      k.z(4),
      k.pos(BCX, BCY),
    ]);
    // Tail fork B
    const tailB = k.add([
      k.rect(20, 10, { radius: 3 }),
      k.color(...fishColor()),
      k.opacity(0.9),
      k.anchor("center"),
      k.z(4),
      k.pos(BCX, BCY),
    ]);
    // Dorsal fin
    const dorsalFin = k.add([
      k.rect(18, 10, { radius: 4 }),
      k.color(...fishColor()),
      k.opacity(0.85),
      k.anchor("center"),
      k.z(4),
      k.pos(BCX, BCY),
    ]);
    // Pectoral fin
    const pectoralFin = k.add([
      k.rect(14, 8, { radius: 3 }),
      k.color(...fishColor()),
      k.opacity(0.8),
      k.anchor("center"),
      k.z(4),
      k.pos(BCX, BCY),
    ]);
    // Body
    const fishBody = k.add([
      k.rect(52, 26, { radius: 13 }),
      k.color(...fishColor()),
      k.anchor("center"),
      k.z(5),
      k.pos(BCX, BCY),
    ]);
    // Belly
    const belly = k.add([
      k.rect(30, 10, { radius: 5 }),
      k.color(255, 237, 213),
      k.opacity(0.45),
      k.anchor("center"),
      k.z(6),
      k.pos(BCX, BCY),
    ]);
    // Eye white
    const eyeWhite = k.add([
      k.circle(6),
      k.color(255, 255, 255),
      k.anchor("center"),
      k.z(7),
      k.pos(BCX, BCY),
    ]);
    // Pupil
    const pupil = k.add([
      k.circle(3),
      k.color(24, 24, 27),
      k.anchor("center"),
      k.z(8),
      k.pos(BCX, BCY),
    ]);
    // Eye shine
    const eyeShine = k.add([
      k.circle(1.5),
      k.color(255, 255, 255),
      k.anchor("center"),
      k.z(9),
      k.pos(BCX, BCY),
    ]);
    // Mouth
    const mouthObj = k.add([
      k.rect(8, 3, { radius: 2 }),
      k.color(180, 60, 60),
      k.anchor("center"),
      k.z(7),
      k.pos(BCX, BCY),
    ]);

    // Fish parts with local offsets (relative to fish facing RIGHT)
    const parts: FishPart[] = [
      { obj: tailA,       ox: -34, oy: -7,  baseRot: 25  },
      { obj: tailB,       ox: -34, oy:  7,  baseRot: -25 },
      { obj: dorsalFin,   ox:  -2, oy: -17, baseRot: -15 },
      { obj: pectoralFin, ox:   4, oy:  10, baseRot:  20 },
      { obj: fishBody,    ox:   0, oy:   0, baseRot:   0 },
      { obj: belly,       ox:   6, oy:   5, baseRot:   0 },
      { obj: eyeWhite,    ox:  18, oy:  -5, baseRot:   0 },
      { obj: pupil,       ox:  20, oy:  -5, baseRot:   0 },
      { obj: eyeShine,    ox:  21, oy:  -7, baseRot:   0 },
      { obj: mouthObj,    ox:  24, oy:   5, baseRot:   0 },
    ];

    function updateFishAppearance() {
      stage = Math.min(Math.floor(feedCount / FEED_PER_STAGE), STAGES - 1);
      const [r, g, b] = STAGE_COLORS[stage] ?? STAGE_COLORS[0]!;
      tailA.color = k.rgb(r, g, b);
      tailB.color = k.rgb(r, g, b);
      dorsalFin.color = k.rgb(r, g, b);
      pectoralFin.color = k.rgb(r, g, b);
      fishBody.color = k.rgb(r, g, b);
      // Mouth shape per stage
      if (stage === 0) {
        // Happy: small smile
        mouthObj.width = 8; mouthObj.height = 3;
        const mIdx = parts.findIndex(p => p.obj === mouthObj);
        if (mIdx >= 0) { parts[mIdx]!.oy = 5; }
      } else if (stage === 1) {
        // Content: wider smile
        mouthObj.width = 10; mouthObj.height = 3;
        const mIdx = parts.findIndex(p => p.obj === mouthObj);
        if (mIdx >= 0) { parts[mIdx]!.oy = 6; }
      } else if (stage === 2) {
        // Full: flat line
        mouthObj.width = 10; mouthObj.height = 3;
        const mIdx = parts.findIndex(p => p.obj === mouthObj);
        if (mIdx >= 0) { parts[mIdx]!.oy = 7; }
      } else if (stage === 3) {
        // Stuffed: bigger open mouth
        mouthObj.width = 12; mouthObj.height = 6;
        const mIdx = parts.findIndex(p => p.obj === mouthObj);
        if (mIdx >= 0) { parts[mIdx]!.oy = 8; }
      } else {
        // Critical: wide open
        mouthObj.width = 14; mouthObj.height = 8;
        const mIdx = parts.findIndex(p => p.obj === mouthObj);
        if (mIdx >= 0) { parts[mIdx]!.oy = 9; }
      }
      // Eye expression: critical = X eyes (red)
      if (stage >= 4) {
        eyeWhite.color = k.rgb(239, 68, 68);
        pupil.color = k.rgb(239, 68, 68);
      } else if (stage >= 3) {
        eyeWhite.color = k.rgb(255, 255, 255);
        pupil.color = k.rgb(24, 24, 27);
      } else {
        eyeWhite.color = k.rgb(255, 255, 255);
        pupil.color = k.rgb(24, 24, 27);
      }
    }

    // ── Stage label ─────────────────────────────────────────────────────────
    const stageLabel = k.add([
      k.text(STAGE_LABELS[0]!, { size: 18, font: "sans-serif" }),
      k.anchor("center"),
      k.pos(BCX, BCY + BOWL_R + 34),
      k.color(255, 255, 255),
      k.z(10),
    ]);

    // ── Feed button ─────────────────────────────────────────────────────────
    const feedBtnBg = k.add([
      k.rect(64, 64, { radius: 18 }),
      k.color(16, 185, 129),
      k.area(),
      k.anchor("center"),
      k.pos(VW / 2, 52),
      k.z(10),
      "feedBtn",
    ]);
    // Food pellet icon
    k.add([
      k.circle(10),
      k.color(250, 204, 21),
      k.anchor("center"),
      k.pos(VW / 2, 48),
      k.z(11),
    ]);
    k.add([
      k.circle(5),
      k.color(251, 191, 36),
      k.anchor("center"),
      k.pos(VW / 2 + 12, 54),
      k.z(11),
    ]);
    k.add([
      k.circle(7),
      k.color(253, 224, 71),
      k.anchor("center"),
      k.pos(VW / 2 - 10, 56),
      k.z(11),
    ]);
    // "FEED" label
    k.add([
      k.text("FEED", { size: 11, font: "sans-serif" }),
      k.anchor("center"),
      k.pos(VW / 2, 72),
      k.color(255, 255, 255),
      k.z(12),
    ]);

    // Cooldown bar (below feed button)
    const cooldownBg = k.add([
      k.rect(64, 8, { radius: 4 }),
      k.color(60, 60, 80),
      k.anchor("center"),
      k.pos(VW / 2, 84),
      k.z(10),
    ]);
    const cooldownBar = k.add([
      k.rect(64, 8, { radius: 4 }),
      k.color(16, 185, 129),
      k.anchor("left"),
      k.pos(VW / 2 - 32, 80),
      k.z(11),
    ]);
    // hide bg initially
    cooldownBg.opacity = 0;
    cooldownBar.opacity = 0;

    // ── Feed action ─────────────────────────────────────────────────────────
    feedBtnBg.onClick(() => {
      if (!canFeed) return;
      if (feedCount >= FEED_LIMIT) return;

      feedCount++;
      score++;
      canFeed = false;
      cooldownLeft = FEED_COOLDOWN;
      onScore(score);

      cooldownBg.opacity = 1;
      cooldownBar.opacity = 1;
      feedBtnBg.color = k.rgb(100, 100, 120);

      // Food pellet falling
      const food = k.add([
        k.circle(8),
        k.color(250, 204, 21),
        k.anchor("center"),
        k.pos(VW / 2, 90),
        k.z(12),
        "fallingFood",
      ]);
      // Animate toward fish
      const targetX = BCX;
      const targetY = BCY - BOWL_R + 20;
      let ft = 0;
      const startX = food.pos.x;
      const startY = food.pos.y;
      food.onUpdate(() => {
        ft += k.dt() * 2.5;
        food.pos.x = startX + (targetX - startX) * ft;
        food.pos.y = startY + (targetY - startY) * ft;
        if (ft >= 1) k.destroy(food);
      });

      updateFishAppearance();
      stageLabel.text = STAGE_LABELS[Math.min(Math.floor(feedCount / FEED_PER_STAGE), STAGES - 1)]!;

      // Explode if limit reached
      if (feedCount >= FEED_LIMIT) {
        k.wait(0.6, () => k.go("explode", score));
      }
    });

    // ── Main update loop ─────────────────────────────────────────────────────
    k.onUpdate(() => {
      // Cooldown
      if (!canFeed) {
        cooldownLeft -= k.dt();
        if (cooldownLeft <= 0) {
          canFeed = true;
          cooldownLeft = 0;
          feedBtnBg.color = k.rgb(16, 185, 129);
          cooldownBg.opacity = 0;
          cooldownBar.opacity = 0;
        } else {
          const frac = cooldownLeft / FEED_COOLDOWN;
          cooldownBar.width = 64 * frac;
        }
      }

      // Fish swimming in a circle
      swimT += k.dt();
      const swimSpeed = 0.55 + stage * 0.04; // gets a bit erratic when overfed
      const swimR = BOWL_R - 34;
      const theta = swimT * swimSpeed;
      const fishX = BCX + swimR * Math.cos(theta);
      const fishY = BCY + swimR * Math.sin(theta) * 0.55; // flatten to ellipse

      // Facing direction
      const dx = -Math.sin(theta) * swimSpeed;
      const dy = Math.cos(theta) * swimSpeed * 0.55;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Tail wag
      const wagAngle = Math.sin(swimT * 8) * 12;

      // Sync all parts
      const cos = Math.cos((angle * Math.PI) / 180);
      const sin = Math.sin((angle * Math.PI) / 180);

      for (const part of parts) {
        const lx = part.ox;
        const ly = part.oy;
        part.obj.pos.x = fishX + lx * cos - ly * sin;
        part.obj.pos.y = fishY + lx * sin + ly * cos;
        part.obj.angle = angle + part.baseRot + (part.obj === tailA || part.obj === tailB ? wagAngle : 0);
      }
    });
  });

  // ── EXPLODE SCENE ──────────────────────────────────────────────────────────
  k.scene("explode", (finalScore: number) => {
    addBowl(k);

    // Flesh chunks splattered around the bowl
    const chunkColors: [number, number, number][] = [
      [245, 158, 11],
      [255, 94, 94],
      [253, 186, 116],
      [245, 245, 220],
      [239, 68, 68],
    ];
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const dist = 30 + Math.random() * 90;
      const cx = BCX + Math.cos(angle) * dist;
      const cy = BCY + Math.sin(angle) * dist * 0.7;
      const col = chunkColors[i % chunkColors.length]!;
      k.add([
        k.circle(8 + Math.random() * 16),
        k.color(...col),
        k.opacity(0.82),
        k.anchor("center"),
        k.pos(cx, cy),
        k.z(5),
      ]);
    }
    // Bone / eye remnants
    k.add([
      k.circle(6),
      k.color(255, 255, 255),
      k.anchor("center"),
      k.pos(BCX + 20, BCY - 30),
      k.z(6),
    ]);
    k.add([
      k.circle(3),
      k.color(24, 24, 27),
      k.anchor("center"),
      k.pos(BCX + 22, BCY - 30),
      k.z(7),
    ]);

    // Dark overlay
    k.add([
      k.rect(VW, VH),
      k.color(0, 0, 0),
      k.opacity(0.55),
      k.pos(0, 0),
      k.z(8),
    ]);

    k.add([
      k.text("💀 YOU OVERFED THE FISH!", { size: 26, font: "sans-serif" }),
      k.anchor("center"),
      k.pos(VW / 2, VH / 2 - 50),
      k.color(239, 68, 68),
      k.z(10),
    ]);
    k.add([
      k.text("The fish exploded! 🐟💥", { size: 20, font: "sans-serif" }),
      k.anchor("center"),
      k.pos(VW / 2, VH / 2 - 14),
      k.color(251, 191, 36),
      k.z(10),
    ]);
    k.add([
      k.text("Score: " + String(finalScore), { size: 22, font: "sans-serif" }),
      k.anchor("center"),
      k.pos(VW / 2, VH / 2 + 26),
      k.color(16, 185, 129),
      k.z(10),
    ]);
    k.add([
      k.text("Tap or press Space to restart", { size: 15, font: "sans-serif" }),
      k.anchor("center"),
      k.pos(VW / 2, VH / 2 + 66),
      k.color(200, 200, 200),
      k.z(10),
    ]);

    k.onMousePress(() => k.go("play"));
    k.onKeyPress("space", () => k.go("play"));
  });

  k.go("play");
  return () => k.quit();
}
