import kaplay from "kaplay";
import type { KAPLAYCtx, GameObj } from "kaplay";

const VW = 400;
const VH = 600;

const BCX = VW / 2;
const BCY = VH / 2 + 50;
const BOWL_R = 130;

// 5 stages × 3 feeds each = 15 total before explode
const FEED_PER_STAGE = 3;
const STAGES = 5;
const FEED_LIMIT = FEED_PER_STAGE * STAGES;
const FEED_COOLDOWN = 3.0;

const STAGE_LABELS = ["😊 Happy", "😄 Content", "😐 Full", "😰 Stuffed", "💀 CRITICAL!"];
const STAGE_COLORS: [number, number, number][] = [
  [245, 158, 11],
  [251, 191, 36],
  [234, 179, 8],
  [249, 115, 22],
  [239, 68, 68],
];

type K = KAPLAYCtx;

function addBowl(k: K) {
  // Water fill
  k.add([k.circle(BOWL_R), k.color(59, 130, 246), k.opacity(0.22), k.anchor("center"), k.pos(BCX, BCY), k.z(0)]);
  // Outer rim
  k.add([k.circle(BOWL_R + 8), k.color(147, 197, 253), k.opacity(0.18), k.anchor("center"), k.pos(BCX, BCY), k.z(0)]);
  // Inner rim highlight
  k.add([k.circle(BOWL_R - 4), k.color(255, 255, 255), k.opacity(0.06), k.anchor("center"), k.pos(BCX, BCY), k.z(0)]);
  // Waterline shimmer
  k.add([k.rect(180, 7, { radius: 4 }), k.color(186, 230, 253), k.opacity(0.5), k.anchor("center"), k.pos(BCX, BCY - BOWL_R + 28), k.z(2)]);
  k.add([k.rect(140, 4, { radius: 3 }), k.color(186, 230, 253), k.opacity(0.28), k.anchor("center"), k.pos(BCX, BCY - BOWL_R + 40), k.z(2)]);
  // Glass shine
  k.add([k.rect(48, 14, { radius: 7 }), k.color(255, 255, 255), k.opacity(0.18), k.anchor("center"), k.pos(BCX - 52, BCY - BOWL_R + 44), k.rotate(-20), k.z(3)]);
  k.add([k.rect(22, 8, { radius: 4 }), k.color(255, 255, 255), k.opacity(0.12), k.anchor("center"), k.pos(BCX - 60, BCY - BOWL_R + 62), k.rotate(-20), k.z(3)]);
  // Bowl base
  k.add([k.rect(120, 14, { radius: 7 }), k.color(147, 197, 253), k.opacity(0.45), k.anchor("center"), k.pos(BCX, BCY + BOWL_R + 2), k.z(0)]);
  k.add([k.rect(70, 10, { radius: 5 }), k.color(147, 197, 253), k.opacity(0.35), k.anchor("center"), k.pos(BCX, BCY + BOWL_R + 14), k.z(0)]);
  // Gravel
  const pebbleColors: [number, number, number][] = [
    [167, 243, 208], [253, 230, 138], [196, 181, 253], [147, 197, 253],
  ];
  for (let i = 0; i < 9; i++) {
    const px = BCX - 72 + i * 18 + (i % 2 === 0 ? 0 : 6);
    const pc = pebbleColors[i % 4] as [number, number, number];
    k.add([k.circle(6 + (i % 3)), k.color(...pc), k.opacity(0.7), k.anchor("center"), k.pos(px, BCY + BOWL_R - 18), k.z(1)]);
  }
  // Seaweed left
  for (let s = 0; s < 3; s++) {
    k.add([k.rect(6, 22 + s * 6, { radius: 3 }), k.color(34, 197, 94), k.opacity(0.7), k.anchor("bot"), k.pos(BCX - 80 + s * 12, BCY + BOWL_R - 12), k.rotate(-8 + s * 6), k.z(1)]);
  }
  // Seaweed right
  for (let s = 0; s < 2; s++) {
    k.add([k.rect(6, 18 + s * 8, { radius: 3 }), k.color(34, 197, 94), k.opacity(0.65), k.anchor("bot"), k.pos(BCX + 72 + s * 10, BCY + BOWL_R - 12), k.rotate(6 - s * 5), k.z(1)]);
  }
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

    // Food pellet state — one pellet at a time
    let foodPellet: GameObj | null = null;
    let foodX = BCX;
    let foodY = BCY - BOWL_R + 20;
    let foodActive = false;
    let fishChasing = false;

    onScore(0);
    addBowl(k);

    // ── Fish parts (manual offset parenting) ───────────────────────────────
    const getColor = (): [number, number, number] => {
      const s = Math.min(Math.floor(feedCount / FEED_PER_STAGE), STAGES - 1);
      return STAGE_COLORS[s] ?? [245, 158, 11];
    };

    const tailA = k.add([k.rect(20, 10, { radius: 3 }), k.color(...getColor()), k.opacity(0.9), k.anchor("center"), k.z(4), k.pos(BCX, BCY)]);
    const tailB = k.add([k.rect(20, 10, { radius: 3 }), k.color(...getColor()), k.opacity(0.9), k.anchor("center"), k.z(4), k.pos(BCX, BCY)]);
    const dorsalFin = k.add([k.rect(18, 10, { radius: 4 }), k.color(...getColor()), k.opacity(0.85), k.anchor("center"), k.z(4), k.pos(BCX, BCY)]);
    const pectoralFin = k.add([k.rect(14, 8, { radius: 3 }), k.color(...getColor()), k.opacity(0.8), k.anchor("center"), k.z(4), k.pos(BCX, BCY)]);
    const fishBody = k.add([k.rect(52, 26, { radius: 13 }), k.color(...getColor()), k.anchor("center"), k.z(5), k.pos(BCX, BCY)]);
    const belly = k.add([k.rect(30, 10, { radius: 5 }), k.color(255, 237, 213), k.opacity(0.45), k.anchor("center"), k.z(6), k.pos(BCX, BCY)]);
    const eyeWhite = k.add([k.circle(6), k.color(255, 255, 255), k.anchor("center"), k.z(7), k.pos(BCX, BCY)]);
    const pupil = k.add([k.circle(3), k.color(24, 24, 27), k.anchor("center"), k.z(8), k.pos(BCX, BCY)]);
    const eyeShine = k.add([k.circle(1.5), k.color(255, 255, 255), k.anchor("center"), k.z(9), k.pos(BCX, BCY)]);
    const mouthObj = k.add([k.rect(8, 3, { radius: 2 }), k.color(180, 60, 60), k.anchor("center"), k.z(7), k.pos(BCX, BCY)]);

    // Local offsets for each part (fish faces RIGHT at angle=0)
    const parts: { obj: GameObj; ox: number; oy: number; baseRot: number; waggy: boolean }[] = [
      { obj: tailA,       ox: -34, oy: -7,  baseRot:  25, waggy: true  },
      { obj: tailB,       ox: -34, oy:  7,  baseRot: -25, waggy: true  },
      { obj: dorsalFin,   ox:  -2, oy: -17, baseRot: -15, waggy: false },
      { obj: pectoralFin, ox:   4, oy:  10, baseRot:  20, waggy: false },
      { obj: fishBody,    ox:   0, oy:   0, baseRot:   0, waggy: false },
      { obj: belly,       ox:   6, oy:   5, baseRot:   0, waggy: false },
      { obj: eyeWhite,    ox:  18, oy:  -5, baseRot:   0, waggy: false },
      { obj: pupil,       ox:  20, oy:  -5, baseRot:   0, waggy: false },
      { obj: eyeShine,    ox:  21, oy:  -7, baseRot:   0, waggy: false },
      { obj: mouthObj,    ox:  24, oy:   5, baseRot:   0, waggy: false },
    ];

    // Current fish position (updated each frame)
    let fishX = BCX;
    let fishY = BCY;
    let fishAngle = 0;

    function updateFishAppearance() {
      const stg = Math.min(Math.floor(feedCount / FEED_PER_STAGE), STAGES - 1);
      const [r, g, b] = STAGE_COLORS[stg] ?? [245, 158, 11];
      tailA.color = k.rgb(r, g, b);
      tailB.color = k.rgb(r, g, b);
      dorsalFin.color = k.rgb(r, g, b);
      pectoralFin.color = k.rgb(r, g, b);
      fishBody.color = k.rgb(r, g, b);
      // Mouth per stage
      const mouthPart = parts.find(p => p.obj === mouthObj);
      if (stg === 0) {
        mouthObj.width = 8; mouthObj.height = 3;
        if (mouthPart) mouthPart.oy = 5;
      } else if (stg === 1) {
        mouthObj.width = 10; mouthObj.height = 3;
        if (mouthPart) mouthPart.oy = 6;
      } else if (stg === 2) {
        mouthObj.width = 10; mouthObj.height = 3;
        if (mouthPart) mouthPart.oy = 7;
      } else if (stg === 3) {
        mouthObj.width = 12; mouthObj.height = 6;
        if (mouthPart) mouthPart.oy = 8;
      } else {
        mouthObj.width = 14; mouthObj.height = 8;
        if (mouthPart) mouthPart.oy = 9;
      }
      // Eye: critical = red
      if (stg >= 4) {
        eyeWhite.color = k.rgb(239, 68, 68);
        pupil.color = k.rgb(239, 68, 68);
      } else {
        eyeWhite.color = k.rgb(255, 255, 255);
        pupil.color = k.rgb(24, 24, 27);
      }
    }

    function syncFishParts(angle: number) {
      const wagAngle = Math.sin(swimT * 8) * 12;
      const cosA = Math.cos((angle * Math.PI) / 180);
      const sinA = Math.sin((angle * Math.PI) / 180);
      for (const part of parts) {
        part.obj.pos.x = fishX + part.ox * cosA - part.oy * sinA;
        part.obj.pos.y = fishY + part.ox * sinA + part.oy * cosA;
        part.obj.angle = angle + part.baseRot + (part.waggy ? wagAngle : 0);
      }
    }

    // ── Stage label ─────────────────────────────────────────────────────────
    const stageLabel = k.add([
      k.text(STAGE_LABELS[0]!, { size: 18 }),
      k.anchor("center"),
      k.pos(BCX, BCY + BOWL_R + 34),
      k.color(255, 255, 255),
      k.z(10),
    ]);

    // ── Feed button (top center) ─────────────────────────────────────────────
    const feedBtnBg = k.add([
      k.rect(64, 64, { radius: 18 }),
      k.color(16, 185, 129),
      k.area(),
      k.anchor("center"),
      k.pos(VW / 2, 52),
      k.z(10),
      "feedBtn",
    ]);
    k.add([k.circle(10), k.color(250, 204, 21), k.anchor("center"), k.pos(VW / 2, 47), k.z(11)]);
    k.add([k.circle(5),  k.color(251, 191, 36), k.anchor("center"), k.pos(VW / 2 + 12, 54), k.z(11)]);
    k.add([k.circle(7),  k.color(253, 224, 71), k.anchor("center"), k.pos(VW / 2 - 10, 56), k.z(11)]);
    k.add([k.text("FEED", { size: 11 }), k.anchor("center"), k.pos(VW / 2, 72), k.color(255, 255, 255), k.z(12)]);

    // Cooldown bar
    const cooldownBg = k.add([k.rect(64, 8, { radius: 4 }), k.color(60, 60, 80), k.anchor("center"), k.pos(VW / 2, 84), k.z(10)]);
    const cooldownBar = k.add([k.rect(64, 8, { radius: 4 }), k.color(16, 185, 129), k.anchor("left"), k.pos(VW / 2 - 32, 80), k.z(11)]);
    cooldownBg.opacity = 0;
    cooldownBar.opacity = 0;

    // ── Feed action ─────────────────────────────────────────────────────────
    feedBtnBg.onClick(() => {
      if (!canFeed || feedCount >= FEED_LIMIT) return;

      feedCount++;
      score++;
      canFeed = false;
      cooldownLeft = FEED_COOLDOWN;
      onScore(score);

      cooldownBg.opacity = 1;
      cooldownBar.opacity = 1;
      feedBtnBg.color = k.rgb(100, 100, 120);

      // Drop food pellet from the feed button down into the bowl
      if (foodPellet) k.destroy(foodPellet);
      foodX = VW / 2 + k.rand(-20, 20);
      foodY = 90;
      foodActive = true;
      fishChasing = false;

      foodPellet = k.add([
        k.circle(8),
        k.color(250, 204, 21),
        k.anchor("center"),
        k.pos(foodX, foodY),
        k.z(12),
      ]);

      updateFishAppearance();
      const stg = Math.min(Math.floor(feedCount / FEED_PER_STAGE), STAGES - 1);
      stageLabel.text = STAGE_LABELS[stg]!;

      if (feedCount >= FEED_LIMIT) {
        k.wait(0.8, () => k.go("explode", score));
      }
    });

    // ── Main update loop ─────────────────────────────────────────────────────
    k.onUpdate(() => {
      const dt = k.dt();
      swimT += dt;

      // Cooldown tick
      if (!canFeed) {
        cooldownLeft -= dt;
        if (cooldownLeft <= 0) {
          canFeed = true;
          cooldownLeft = 0;
          feedBtnBg.color = k.rgb(16, 185, 129);
          cooldownBg.opacity = 0;
          cooldownBar.opacity = 0;
        } else {
          cooldownBar.width = 64 * (cooldownLeft / FEED_COOLDOWN);
        }
      }

      // Food pellet drifts down into the bowl water
      if (foodActive && foodPellet) {
        const targetY = BCY - BOWL_R + 30 + k.rand(0, 0.01); // top of water
        if (foodY < targetY) {
          foodY += 160 * dt;
          foodPellet.pos.y = foodY;
          foodPellet.pos.x = foodX;
        } else {
          // Pellet has reached the water surface — fish starts chasing it
          foodY = targetY;
          foodPellet.pos.y = foodY;
          fishChasing = true;
        }
      }

      // Fish movement: chase food OR swim in a vertical ellipse
      const swimR = BOWL_R - 34;

      if (fishChasing && foodPellet) {
        // Chase the pellet
        const dx = foodX - fishX;
        const dy = foodY - fishY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = 180 + Math.min(Math.floor(feedCount / FEED_PER_STAGE), STAGES - 1) * 20;
        if (dist > 12) {
          fishX += (dx / dist) * speed * dt;
          fishY += (dy / dist) * speed * dt;
          fishAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        } else {
          // Ate the food
          if (foodPellet) k.destroy(foodPellet);
          foodPellet = null;
          foodActive = false;
          fishChasing = false;
          // Snap swimT so the fish resumes orbit from its current position
          swimT = Math.atan2((fishY - BCY) / (swimR * 0.55), (fishX - BCX) / swimR) / 0.55;
        }
      } else {
        // Idle: swim in a vertical ellipse (tall oval — looks like a circle viewed at an angle)
        const swimSpeed = 0.55;
        const theta = swimT * swimSpeed;
        fishX = BCX + swimR * Math.cos(theta);
        fishY = BCY + swimR * Math.sin(theta) * 0.55;

        // Direction of travel (tangent to the ellipse)
        const tdx = -swimR * Math.sin(theta) * swimSpeed;
        const tdy = swimR * Math.cos(theta) * swimSpeed * 0.55;
        fishAngle = Math.atan2(tdy, tdx) * (180 / Math.PI);
      }

      syncFishParts(fishAngle);
    });
  });

  // ── EXPLODE SCENE ──────────────────────────────────────────────────────────
  k.scene("explode", (finalScore: number) => {
    addBowl(k);

    // Flesh chunks
    const chunkColors: [number, number, number][] = [
      [245, 158, 11], [255, 94, 94], [253, 186, 116], [245, 245, 220], [239, 68, 68],
    ];
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const dist = 30 + Math.random() * 90;
      const cx = BCX + Math.cos(angle) * dist;
      const cy = BCY + Math.sin(angle) * dist * 0.7;
      const col = chunkColors[i % chunkColors.length]!;
      k.add([k.circle(8 + Math.random() * 16), k.color(...col), k.opacity(0.82), k.anchor("center"), k.pos(cx, cy), k.z(5)]);
    }
    // Stray eye
    k.add([k.circle(6), k.color(255, 255, 255), k.anchor("center"), k.pos(BCX + 20, BCY - 30), k.z(6)]);
    k.add([k.circle(3), k.color(24, 24, 27), k.anchor("center"), k.pos(BCX + 22, BCY - 30), k.z(7)]);

    // Dark overlay
    k.add([k.rect(VW, VH), k.color(0, 0, 0), k.opacity(0.55), k.pos(0, 0), k.z(8)]);

    k.add([k.text("💀 YOU OVERFED THE FISH!", { size: 26 }), k.anchor("center"), k.pos(VW / 2, VH / 2 - 50), k.color(239, 68, 68), k.z(10)]);
    k.add([k.text("The fish exploded! 🐟💥",  { size: 20 }), k.anchor("center"), k.pos(VW / 2, VH / 2 - 14), k.color(251, 191, 36), k.z(10)]);
    k.add([k.text("Score: " + String(finalScore), { size: 22 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 26), k.color(16, 185, 129), k.z(10)]);
    k.add([k.text("Tap or press Space to restart", { size: 15 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 66), k.color(200, 200, 200), k.z(10)]);

    k.onMousePress(() => k.go("play"));
    k.onKeyPress("space", () => k.go("play"));
  });

  k.go("play");
  return () => k.quit();
}
