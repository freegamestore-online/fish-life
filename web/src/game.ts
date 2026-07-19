import kaplay from "kaplay";

const VW = 400;
const VH = 600;

const FEED_LIMIT = 12; // More feeding allowed before exploding
const FEED_COOLDOWN = 2.0; // Seconds between allowed feeds

function drawBowl(k: any) {
  k.add([
    k.circle(140),
    k.color(59, 130, 246),
    k.opacity(0.3),
    k.anchor("center"),
    k.pos(VW / 2, VH / 2 + 60),
    "bowl"
  ]);
  k.add([
    k.circle(140),
    k.color(255, 255, 255),
    k.opacity(0.10),
    k.anchor("center"),
    k.pos(VW / 2, VH / 2 + 60 - 3),
    "bowlRim"
  ]);
  k.add([
    k.pos(VW / 2 - 80, VH / 2 + 28),
    k.rect(160, 6, { radius: 3 }),
    k.color(147, 197, 253),
    k.opacity(0.55),
    "waterline"
  ]);
  k.add([
    k.pos(VW / 2 - 50, VH / 2 + 60 - 60),
    k.rect(40, 12, { radius: 6 }),
    k.color(255, 255, 255),
    k.opacity(0.13),
    "shine"
  ]);
}

function fishExpression(k: any, feedCount: number, limit: number) {
  if (feedCount === 0) return { mouth: "smile", color: k.rgb(245, 158, 11) };
  if (feedCount < Math.floor(limit * 0.5)) return { mouth: "happy", color: k.rgb(251, 191, 36) };
  if (feedCount < limit - 2) return { mouth: "flat", color: k.rgb(245, 158, 11) };
  return { mouth: "worried", color: k.rgb(253, 164, 175) };
}

export function startGame(canvas: HTMLCanvasElement, onScore: (n: number) => void): () => void {
  const k = kaplay({
    canvas,
    width: VW,
    height: VH,
    letterbox: true,
    background: [24, 24, 27],
    global: false,
    pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
  });

  k.scene("play", () => {
    let score = 0;
    let feedCount = 0;
    let canFeed = true;
    let cooldown = 0;
    let t = 0; // For swimming
    onScore(0);

    drawBowl(k);

    // Fish group
    const fishRoot = k.add([
      k.pos(0, 0),
      "fishRoot"
    ]);

    // Initial fish state
    let fishFace = fishExpression(k, feedCount, FEED_LIMIT);

    // Fish body
    const fishBody = k.add([
      k.pos(0, 0),
      k.rect(54, 24, { radius: 12 }),
      k.color(fishFace.color),
      k.area(),
      k.anchor("center"),
      "fish"
    ]);
    fishRoot.add(fishBody);
    // Tail
    const tail = k.add([
      k.pos(-30, 0),
      k.polygon([
        [0, 0], [16, -16], [18, 0], [16, 16]
      ]),
      k.color(fishFace.color),
      k.anchor("left"),
      "tail"
    ]);
    fishRoot.add(tail);
    // Fins
    const finTop = k.add([
      k.pos(-6, -12),
      k.polygon([[0,0],[10,-8],[8,0]]),
      k.color(252, 211, 77),
      k.anchor("left"),
      "finTop"
    ]);
    fishRoot.add(finTop);
    const finBot = k.add([
      k.pos(-6, 12),
      k.polygon([[0,0],[10,8],[8,0]]),
      k.color(252, 211, 77),
      k.anchor("left"),
      "finBot"
    ]);
    fishRoot.add(finBot);
    // Eye
    const eye = k.add([
      k.pos(16, -5),
      k.circle(5),
      k.color(255, 255, 255),
      "eye"
    ]);
    fishRoot.add(eye);
    const pupil = k.add([
      k.pos(18, -5),
      k.circle(2),
      k.color(24, 24, 27),
      "pupil"
    ]);
    fishRoot.add(pupil);
    // Mouth
    let mouth: any;
    function updateMouth(type: string) {
      if (mouth) {
        k.destroy(mouth);
      }
      if (type === "smile") {
        mouth = k.add([
          k.pos(22, 6),
          k.arc(7, 80, 200),
          k.color(24, 24, 27),
          k.opacity(0.8),
          k.anchor("center"),
          "mouth"
        ]);
      } else if (type === "happy") {
        mouth = k.add([
          k.pos(22, 7),
          k.arc(6, 100, 220),
          k.color(24, 24, 27),
          k.opacity(0.9),
          k.anchor("center"),
          "mouth"
        ]);
      } else if (type === "flat") {
        mouth = k.add([
          k.pos(22, 8),
          k.rect(10, 3, { radius: 1 }),
          k.color(24, 24, 27),
          k.anchor("left"),
          "mouth"
        ]);
      } else if (type === "worried") {
        mouth = k.add([
          k.pos(22, 12),
          k.arc(5, 240, 340),
          k.color(24, 24, 27),
          k.opacity(0.9),
          k.anchor("center"),
          "mouth"
        ]);
      }
      fishRoot.add(mouth);
    }
    updateMouth(fishFace.mouth);

    // Animate fish swimming in a circle inside the bowl
    k.onUpdate(() => {
      t += k.dt();
      const r = 60;
      const cx = VW / 2, cy = VH / 2 + 60;
      const theta = t * 0.6;
      fishRoot.pos = k.vec2(
        cx + r * Math.cos(theta),
        cy + r * Math.sin(theta)
      );
      fishRoot.angle = (theta * 180 / Math.PI) + 90;
      // Feeding cooldown
      if (!canFeed) {
        cooldown -= k.dt();
        if (cooldown <= 0) {
          canFeed = true;
        }
      }
    });

    // Feed button
    const feedBtn = k.add([
      k.pos(VW - 52, VH / 2 + 60 + 120),
      k.rect(56, 56, { radius: 15 }),
      k.color(canFeed ? 16 : 180, canFeed ? 185 : 180, canFeed ? 129 : 180),
      k.area(),
      k.anchor("center"),
      "feedBtn"
    ]);
    // Food icon
    k.add([
      k.pos(VW - 52, VH / 2 + 60 + 120),
      k.circle(16),
      k.color(250, 204, 21),
      k.anchor("center"),
      "foodIcon"
    ]);
    k.add([
      k.pos(VW - 52, VH / 2 + 60 + 120 - 18),
      k.text("🍞", { size: 30 }),
      k.anchor("center"),
      "bread"
    ]);
    // Cooldown indicator
    let cooldownArc: any = null;
    k.onUpdate(() => {
      if (!canFeed) {
        if (cooldownArc) k.destroy(cooldownArc);
        const frac = Math.max(0, cooldown / FEED_COOLDOWN);
        cooldownArc = k.add([
          k.pos(VW - 52, VH / 2 + 60 + 120),
          k.arc(24, -90, -90 + 360 * frac),
          k.color(59, 130, 246),
          k.opacity(0.4),
          k.anchor("center"),
          "cooldown"
        ]);
      } else if (cooldownArc) {
        k.destroy(cooldownArc); cooldownArc = null;
      }
    });
    // Feed action
    feedBtn.onClick(() => {
      if (!canFeed) return;
      if (feedCount >= FEED_LIMIT) return;
      feedCount++;
      score++;
      canFeed = false;
      cooldown = FEED_COOLDOWN;
      onScore(score);
      // Animate food dropping
      const food = k.add([
        k.pos(VW - 52, VH / 2 + 60 + 120 - 26),
        k.circle(10),
        k.color(250, 204, 21),
        k.move(k.UP.add(k.LEFT).unit(), 220),
        k.area(),
        "food"
      ]);
      food.onUpdate(() => {
        if (food.pos.dist(fishRoot.pos) < 26) {
          k.destroy(food);
        }
        if (food.pos.y < 60) k.destroy(food);
      });
      // Update fish face
      let exp = fishExpression(k, feedCount, FEED_LIMIT);
      fishBody.color = exp.color;
      updateMouth(exp.mouth);
      // If overfed, explode
      if (feedCount === FEED_LIMIT) {
        k.wait(0.5, () => {
          k.go("explode", score);
        });
      }
    });
  });

  k.scene("explode", (finalScore: number) => {
    drawBowl(k);
    for (let i = 0; i < 7; i++) {
      k.add([
        k.pos(VW / 2 + k.rand(-70, 70), VH / 2 + 60 + k.rand(-70, 70)),
        k.circle(k.rand(18, 28)),
        k.color(k.choose([
          k.rgb(245, 158, 11),
          k.rgb(255, 94, 94),
          k.rgb(245, 245, 220)
        ])),
        k.opacity(0.85),
        "flesh"
      ]);
    }
    k.add([k.text("You overfed the fish!", { size: 32 }), k.anchor("center"), k.pos(VW / 2, VH / 2 - 40), k.color(255, 255, 255)]);
    k.add([k.text("Fish exploded.", { size: 22 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 10), k.color(245, 158, 11)]);
    k.add([k.text(`Score: ${finalScore}", { size: 22 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 50), k.color(16, 185, 129)]);
    k.add([k.text("tap to restart", { size: 16 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 100), k.color(160, 160, 160)]);
    k.onMousePress(() => k.go("play"));
    k.onKeyPress("space", () => k.go("play"));
  });

  k.go("play");
  return () => k.quit();
}
