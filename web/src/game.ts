import kaplay from "kaplay";

const VW = 400;
const VH = 600;

const FEED_LIMIT = 7; // Too much food before the fish explodes

function drawBowl(k: any) {
  // Glass bowl base
  k.add([
    k.circle(140),
    k.color(59, 130, 246),
    k.opacity(0.3),
    k.anchor("center"),
    k.pos(VW / 2, VH / 2 + 60),
    "bowl"
  ]);
  // Rim highlight
  k.add([
    k.circle(140),
    k.color(255, 255, 255),
    k.opacity(0.10),
    k.anchor("center"),
    k.pos(VW / 2, VH / 2 + 60 - 3),
    "bowlRim"
  ]);
  // Waterline
  k.add([
    k.pos(VW / 2 - 80, VH / 2 + 28),
    k.rect(160, 6, { radius: 3 }),
    k.color(147, 197, 253),
    k.opacity(0.55),
    "waterline"
  ]);
  // Shine
  k.add([
    k.pos(VW / 2 - 50, VH / 2 + 60 - 60),
    k.rect(40, 12, { radius: 6 }),
    k.color(255, 255, 255),
    k.opacity(0.13),
    "shine"
  ]);
}

function drawFish(k: any) {
  // Body
  const fish = k.add([
    k.pos(VW / 2, VH / 2 + 60),
    k.rect(60, 28, { radius: 14 }),
    k.color(245, 158, 11), // orange
    k.area(),
    k.anchor("center"),
    "fish"
  ]);
  // Tail (triangle)
  k.add([
    k.pos(VW / 2 - 38, VH / 2 + 60),
    k.color(245, 158, 11),
    k.poly([
      { x: 0, y: 0 },
      { x: -18, y: -18 },
      { x: -18, y: 18 }
    ]),
    k.opacity(0.92),
    k.anchor("left"),
    "tail"
  ]);
  // Top fin
  k.add([
    k.pos(VW / 2 - 8, VH / 2 + 60 - 14),
    k.color(250, 204, 21),
    k.poly([
      { x: 0, y: 0 },
      { x: 16, y: -10 },
      { x: 28, y: 0 }
    ]),
    k.opacity(0.92),
    k.anchor("left"),
    "topfin"
  ]);
  // Bottom fin
  k.add([
    k.pos(VW / 2 - 8, VH / 2 + 60 + 14),
    k.color(250, 204, 21),
    k.poly([
      { x: 0, y: 0 },
      { x: 16, y: 10 },
      { x: 28, y: 0 }
    ]),
    k.opacity(0.92),
    k.anchor("left"),
    "bottomfin"
  ]);
  // Eye
  k.add([
    k.pos(VW / 2 + 18, VH / 2 + 60 - 6),
    k.circle(5),
    k.color(255, 255, 255),
    "eye"
  ]);
  k.add([
    k.pos(VW / 2 + 21, VH / 2 + 60 - 6),
    k.circle(2),
    k.color(24, 24, 27),
    "pupil"
  ]);
  return fish;
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
    onScore(0);

    drawBowl(k);

    const fish = drawFish(k);

    // Feed icon at top
    const feedBtn = k.add([
      k.pos(VW / 2, 40),
      k.rect(52, 52, { radius: 15 }),
      k.color(16, 185, 129),
      k.area(),
      k.anchor("center"),
      "feedBtn"
    ]);
    // Food icon
    k.add([
      k.pos(VW / 2, 40),
      k.circle(16),
      k.color(250, 204, 21),
      k.anchor("center"),
      "foodIcon"
    ]);
    k.add([
      k.pos(VW / 2, 40 - 18),
      k.text("🍞", { size: 30 }),
      k.anchor("center"),
      "bread"
    ]);

    // Feed action
    feedBtn.onClick(() => {
      if (feedCount >= FEED_LIMIT) return;
      feedCount++;
      score++;
      onScore(score);
      // Animate food dropping into bowl
      const food = k.add([
        k.pos(VW / 2, 60),
        k.circle(10),
        k.color(250, 204, 21),
        k.move(k.DOWN, 320),
        k.area(),
        "food"
      ]);
      food.onUpdate(() => {
        if (food.pos.y > VH / 2 + 80) {
          k.destroy(food);
        }
      });
      // Fish wiggle animation
      fish.scale = 1.15;
      k.wait(0.15, () => { fish.scale = 1; });
      // If overfed, explode
      if (feedCount === FEED_LIMIT) {
        k.wait(0.4, () => {
          k.go("explode", score);
        });
      }
    });
  });

  k.scene("explode", (finalScore: number) => {
    drawBowl(k);
    // Flesh splats
    for (let i = 0; i < 6; i++) {
      k.add([
        k.pos(VW / 2 + k.rand(-70, 70), VH / 2 + 60 + k.rand(-70, 70)),
        k.circle(k.rand(18, 28)),
        k.color(k.choose([
          k.rgb(245, 158, 11), // orange
          k.rgb(255, 94, 94),  // red
          k.rgb(245, 245, 220) // pale
        ])),
        k.opacity(0.85),
        "flesh"
      ]);
    }
    // Game over text
    k.add([k.text("You overfed the fish!", { size: 32 }), k.anchor("center"), k.pos(VW / 2, VH / 2 - 40), k.color(255, 255, 255)]);
    k.add([k.text("Fish exploded.", { size: 22 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 10), k.color(245, 158, 11)]);
    k.add([k.text(`Score: ${finalScore}`, { size: 22 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 50), k.color(16, 185, 129)]);
    k.add([k.text("tap to restart", { size: 16 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 100), k.color(160, 160, 160)]);
    k.onMousePress(() => k.go("play"));
    k.onKeyPress("space", () => k.go("play"));
  });

  k.go("play");
  return () => k.quit();
}
