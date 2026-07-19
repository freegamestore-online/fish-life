import kaplay from "kaplay";
import type { KAPLAYCtx, GameObj } from "kaplay";

// ─── Constants ────────────────────────────────────────────────────────────────
const VW = 400;
const VH = 640;
const BCX = VW / 2;
const BCY = 310;
const BOWL_R = 118;

// Meters (0–100)
const METER_DRAIN_DIRTY  = 1.8;   // dirt per second
const METER_DRAIN_O2     = 1.2;   // o2 loss per second
const METER_DRAIN_HUNGER = 0.9;   // hunger per second
const FEED_COOLDOWN      = 4.0;   // seconds between feeds
const FEED_LIMIT         = 12;    // feeds before explosion

// Coins
const COIN_HAPPY_RATE = 0.04; // coins/sec when fish is happy
const LS_KEY = "fishlife_save";

// Shop items
interface ShopItem { id: string; label: string; cost: number; emoji: string }
const SHOP_ITEMS: ShopItem[] = [
  { id: "castle",  label: "Castle",   cost: 20, emoji: "🏰" },
  { id: "chest",   label: "Chest",    cost: 15, emoji: "💰" },
  { id: "coral",   label: "Coral",    cost: 10, emoji: "🪸" },
  { id: "snail",   label: "Snail",    cost: 25, emoji: "🐌" },
  { id: "bgBlue",  label: "Ocean Bg", cost: 30, emoji: "🌊" },
  { id: "bgPurp",  label: "Dusk Bg",  cost: 30, emoji: "🌆" },
  { id: "bgGreen", label: "Jungle Bg",cost: 30, emoji: "🌿" },
  { id: "goldfish",label: "Gold Fish", cost: 40, emoji: "✨" },
  { id: "stripey", label: "Stripes",  cost: 35, emoji: "🦓" },
];

// Fish mood
type Mood = "happy" | "hungry" | "dirty" | "suffocating" | "overfed" | "dead";

// Saved state
interface SaveData {
  coins: number;
  owned: string[];
  active: string[];
  bg: string;
  fishSkin: string;
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as SaveData;
  } catch { /* ignore */ }
  return { coins: 0, owned: [], active: [], bg: "default", fishSkin: "default" };
}
function saveSave(d: SaveData) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch { /* ignore */ }
}

type K = KAPLAYCtx;

// ─── Bowl drawing ─────────────────────────────────────────────────────────────
function addBowl(k: K, dirtyness: number, bgKey: string, activeDecos: string[]) {
  // Background tint inside bowl
  const bgColors: Record<string, [number,number,number]> = {
    default: [15, 23, 42],
    bgBlue:  [7, 30, 70],
    bgPurp:  [30, 10, 60],
    bgGreen: [5, 40, 20],
  };
  const [br, bg, bb] = bgColors[bgKey] ?? bgColors["default"]!;

  // Dirty water overlay (brown tint)
  const dirtyAlpha = (dirtyness / 100) * 0.45;
  k.add([k.circle(BOWL_R), k.color(br, bg, bb), k.opacity(1), k.anchor("center"), k.pos(BCX, BCY), k.z(0)]);
  k.add([k.circle(BOWL_R), k.color(59, 130, 246), k.opacity(0.25 - dirtyAlpha * 0.1), k.anchor("center"), k.pos(BCX, BCY), k.z(1)]);
  if (dirtyness > 10) {
    k.add([k.circle(BOWL_R - 2), k.color(120, 80, 20), k.opacity(dirtyAlpha), k.anchor("center"), k.pos(BCX, BCY), k.z(1)]);
  }

  // Outer rim
  k.add([k.circle(BOWL_R + 9), k.color(147, 197, 253), k.opacity(0.22), k.anchor("center"), k.pos(BCX, BCY), k.z(0)]);
  // Waterline
  k.add([k.rect(180, 7, { radius: 4 }), k.color(186, 230, 253), k.opacity(0.5), k.anchor("center"), k.pos(BCX, BCY - BOWL_R + 26), k.z(3)]);
  k.add([k.rect(130, 4, { radius: 3 }), k.color(186, 230, 253), k.opacity(0.25), k.anchor("center"), k.pos(BCX, BCY - BOWL_R + 38), k.z(3)]);
  // Glass shines
  k.add([k.rect(48, 14, { radius: 7 }), k.color(255, 255, 255), k.opacity(0.16), k.anchor("center"), k.pos(BCX - 52, BCY - BOWL_R + 42), k.rotate(-20), k.z(4)]);
  k.add([k.rect(22, 8, { radius: 4 }), k.color(255, 255, 255), k.opacity(0.10), k.anchor("center"), k.pos(BCX - 60, BCY - BOWL_R + 60), k.rotate(-20), k.z(4)]);

  // Gravel
  const gravelCols: [number,number,number][] = [[167,243,208],[253,230,138],[196,181,253],[147,197,253],[251,207,232]];
  for (let i = 0; i < 10; i++) {
    const px = BCX - 76 + i * 17 + (i % 2 === 0 ? 0 : 5);
    const gc = gravelCols[i % gravelCols.length]!;
    k.add([k.circle(5 + (i % 3)), k.color(...gc), k.opacity(0.75), k.anchor("center"), k.pos(px, BCY + BOWL_R - 16), k.z(2)]);
  }
  // Seaweed
  for (let s = 0; s < 3; s++) {
    k.add([k.rect(6, 22 + s * 7, { radius: 3 }), k.color(34, 197, 94), k.opacity(0.7), k.anchor("bot"), k.pos(BCX - 82 + s * 13, BCY + BOWL_R - 14), k.rotate(-8 + s * 7), k.z(2)]);
  }
  for (let s = 0; s < 2; s++) {
    k.add([k.rect(6, 18 + s * 9, { radius: 3 }), k.color(34, 197, 94), k.opacity(0.65), k.anchor("bot"), k.pos(BCX + 70 + s * 11, BCY + BOWL_R - 14), k.rotate(6 - s * 6), k.z(2)]);
  }

  // Bowl base / stand
  k.add([k.rect(130, 14, { radius: 7 }), k.color(147, 197, 253), k.opacity(0.45), k.anchor("center"), k.pos(BCX, BCY + BOWL_R + 3), k.z(0)]);
  k.add([k.rect(75, 10, { radius: 5 }), k.color(147, 197, 253), k.opacity(0.35), k.anchor("center"), k.pos(BCX, BCY + BOWL_R + 15), k.z(0)]);

  // Decorations
  if (activeDecos.includes("castle")) {
    k.add([k.text("🏰", { size: 28 }), k.anchor("center"), k.pos(BCX - 60, BCY + BOWL_R - 36), k.z(2)]);
  }
  if (activeDecos.includes("chest")) {
    k.add([k.text("💰", { size: 22 }), k.anchor("center"), k.pos(BCX + 58, BCY + BOWL_R - 30), k.z(2)]);
  }
  if (activeDecos.includes("coral")) {
    k.add([k.text("🪸", { size: 26 }), k.anchor("center"), k.pos(BCX + 20, BCY + BOWL_R - 28), k.z(2)]);
  }
  if (activeDecos.includes("snail")) {
    k.add([k.text("🐌", { size: 22 }), k.anchor("center"), k.pos(BCX - 30, BCY + BOWL_R - 22), k.z(2)]);
  }

  // Dirt particles
  if (dirtyness > 30) {
    for (let i = 0; i < Math.floor(dirtyness / 15); i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.3;
      k.add([
        k.circle(3 + i % 3),
        k.color(100 + i * 10, 70, 20),
        k.opacity(0.35),
        k.anchor("center"),
        k.pos(BCX + Math.cos(angle) * (30 + i * 14), BCY + Math.sin(angle) * (20 + i * 10)),
        k.z(3),
      ]);
    }
  }
}

// ─── Fish builder ─────────────────────────────────────────────────────────────
interface FishPart { obj: GameObj; ox: number; oy: number; baseRot: number; waggy: boolean }

function buildFish(k: K, skin: string): FishPart[] {
  const skinColors: Record<string, [number,number,number]> = {
    default:  [245, 158, 11],
    goldfish: [255, 200, 40],
    stripey:  [80, 160, 240],
  };
  const [r, g, b] = skinColors[skin] ?? skinColors["default"]!;

  function fishObj(comps: unknown[]) { return k.add(comps as Parameters<typeof k.add>[0]); }

  const tailA = fishObj([k.rect(22, 11, { radius: 3 }), k.color(r, g, b), k.opacity(0.9), k.anchor("center"), k.z(4), k.pos(BCX, BCY)]);
  const tailB = fishObj([k.rect(22, 11, { radius: 3 }), k.color(r, g, b), k.opacity(0.9), k.anchor("center"), k.z(4), k.pos(BCX, BCY)]);
  const dorsalFin = fishObj([k.rect(20, 11, { radius: 4 }), k.color(r, g, b), k.opacity(0.85), k.anchor("center"), k.z(4), k.pos(BCX, BCY)]);
  const pectoralFin = fishObj([k.rect(15, 9, { radius: 3 }), k.color(r, g, b), k.opacity(0.8), k.anchor("center"), k.z(4), k.pos(BCX, BCY)]);
  const fishBody = fishObj([k.rect(54, 28, { radius: 14 }), k.color(r, g, b), k.anchor("center"), k.z(5), k.pos(BCX, BCY)]);

  // Stripes for stripey skin
  let stripe1: GameObj | null = null;
  let stripe2: GameObj | null = null;
  if (skin === "stripey") {
    stripe1 = fishObj([k.rect(8, 22, { radius: 3 }), k.color(255, 255, 255), k.opacity(0.35), k.anchor("center"), k.z(6), k.pos(BCX, BCY)]);
    stripe2 = fishObj([k.rect(8, 18, { radius: 3 }), k.color(255, 255, 255), k.opacity(0.25), k.anchor("center"), k.z(6), k.pos(BCX, BCY)]);
  }

  const belly = fishObj([k.rect(32, 11, { radius: 6 }), k.color(255, 237, 213), k.opacity(0.45), k.anchor("center"), k.z(6), k.pos(BCX, BCY)]);
  const eyeWhite = fishObj([k.circle(6), k.color(255, 255, 255), k.anchor("center"), k.z(7), k.pos(BCX, BCY)]);
  const pupil = fishObj([k.circle(3), k.color(24, 24, 27), k.anchor("center"), k.z(8), k.pos(BCX, BCY)]);
  const eyeShine = fishObj([k.circle(1.5), k.color(255, 255, 255), k.anchor("center"), k.z(9), k.pos(BCX, BCY)]);
  const mouthObj = fishObj([k.rect(8, 3, { radius: 2 }), k.color(180, 60, 60), k.anchor("center"), k.z(7), k.pos(BCX, BCY)]);

  const parts: FishPart[] = [
    { obj: tailA,       ox: -36, oy: -7,  baseRot:  28, waggy: true  },
    { obj: tailB,       ox: -36, oy:  7,  baseRot: -28, waggy: true  },
    { obj: dorsalFin,   ox:  -2, oy: -18, baseRot: -15, waggy: false },
    { obj: pectoralFin, ox:   4, oy:  11, baseRot:  20, waggy: false },
    { obj: fishBody,    ox:   0, oy:   0, baseRot:   0, waggy: false },
    { obj: belly,       ox:   6, oy:   6, baseRot:   0, waggy: false },
    { obj: eyeWhite,    ox:  19, oy:  -5, baseRot:   0, waggy: false },
    { obj: pupil,       ox:  21, oy:  -5, baseRot:   0, waggy: false },
    { obj: eyeShine,    ox:  22, oy:  -7, baseRot:   0, waggy: false },
    { obj: mouthObj,    ox:  25, oy:   5, baseRot:   0, waggy: false },
  ];
  if (stripe1) parts.push({ obj: stripe1, ox: -4, oy: 0, baseRot: 0, waggy: false });
  if (stripe2) parts.push({ obj: stripe2, ox: 8,  oy: 0, baseRot: 0, waggy: false });

  return parts;
}

// ─── HUD helpers ──────────────────────────────────────────────────────────────
function makeBar(k: K, x: number, y: number, color: [number,number,number], label: string) {
  const W = 80, H = 10;
  k.add([k.rect(W + 4, H + 4, { radius: 3 }), k.color(30, 30, 50), k.anchor("left"), k.pos(x - 2, y - 2), k.z(20)]);
  const fill = k.add([k.rect(W, H, { radius: 3 }), k.color(...color), k.anchor("left"), k.pos(x, y), k.z(21)]);
  k.add([k.text(label, { size: 10 }), k.anchor("left"), k.pos(x, y - 13), k.color(200, 200, 200), k.z(21)]);
  return { fill, maxW: W };
}

function makeMoodBadge(k: K) {
  const badge = k.add([k.text("😊 Happy", { size: 14 }), k.anchor("center"), k.pos(BCX, BCY + BOWL_R + 28), k.color(255, 255, 255), k.z(20)]);
  return badge;
}

function makeCoinLabel(k: K, coins: number) {
  const lbl = k.add([k.text("🪙 " + Math.floor(coins), { size: 14 }), k.anchor("right"), k.pos(VW - 8, 14), k.color(253, 224, 71), k.z(20)]);
  return lbl;
}

// ─── Main export ──────────────────────────────────────────────────────────────
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

  // ══════════════════════════════════════════════════════════════════════════
  // PLAY SCENE
  // ══════════════════════════════════════════════════════════════════════════
  k.scene("play", () => {
    const save = loadSave();

    // ── State ────────────────────────────────────────────────────────────────
    let coins     = save.coins;
    let dirty     = 0;      // 0–100
    let o2        = 100;    // 0–100
    let hunger    = 60;     // 0–100 (100 = starving)
    let feedCount = 0;
    let canFeed   = true;
    let cooldownLeft = 0;
    let swimT     = 0;
    let fishX     = BCX;
    let fishY     = BCY;
    let fishAngle = 0;
    let mood: Mood = "happy";
    let showShop  = false;
    let foodPellet: GameObj | null = null;
    let foodTargetX = BCX;
    let foodTargetY = BCY - BOWL_R + 30;
    let foodDrifting = false;
    let fishChasing  = false;
    let bubbleTimer  = 0;
    let coinAccum    = 0;
    let score        = 0;
    onScore(0);

    // ── Bowl + fish ──────────────────────────────────────────────────────────
    addBowl(k, dirty, save.bg, save.active);
    const parts = buildFish(k, save.fishSkin);

    // Grab key part refs by index (body=4, eyeWhite=6, pupil=7, mouth=9)
    const fishBodyObj     = parts[4]!.obj;
    const eyeWhiteObj     = parts[6]!.obj;
    const pupilObj        = parts[7]!.obj;
    const mouthObj        = parts[9]!.obj;
    const tailAObj        = parts[0]!.obj;
    const tailBObj        = parts[1]!.obj;
    const dorsalFinObj    = parts[2]!.obj;
    const pectoralFinObj  = parts[3]!.obj;

    // ── HUD ──────────────────────────────────────────────────────────────────
    // Left side meters
    const dirtyBar = makeBar(k, 8, 30, [180, 120, 40], "🧹 Clean");
    const o2Bar    = makeBar(k, 8, 58, [96, 165, 250], "💨 O₂");
    const hungerBar= makeBar(k, 8, 86, [251, 191, 36], "🍽 Hunger");

    const moodBadge  = makeMoodBadge(k);
    const coinLabel  = makeCoinLabel(k, coins);

    // ── Feed button (top center) ──────────────────────────────────────────────
    const feedBtnBg = k.add([
      k.rect(56, 56, { radius: 16 }),
      k.color(16, 185, 129),
      k.area(),
      k.anchor("center"),
      k.pos(VW / 2, 44),
      k.z(20),
      "feedBtn",
    ]);
    k.add([k.circle(9), k.color(250, 204, 21), k.anchor("center"), k.pos(VW / 2, 39), k.z(21)]);
    k.add([k.circle(5), k.color(251, 191, 36), k.anchor("center"), k.pos(VW / 2 + 11, 46), k.z(21)]);
    k.add([k.circle(6), k.color(253, 224, 71), k.anchor("center"), k.pos(VW / 2 - 9, 48), k.z(21)]);
    k.add([k.text("FEED", { size: 10 }), k.anchor("center"), k.pos(VW / 2, 62), k.color(255, 255, 255), k.z(22)]);

    // Cooldown bar under feed button
    const cdBg  = k.add([k.rect(56, 7, { radius: 3 }), k.color(40, 40, 60), k.anchor("center"), k.pos(VW / 2, 74), k.z(20)]);
    const cdBar = k.add([k.rect(56, 7, { radius: 3 }), k.color(16, 185, 129), k.anchor("left"), k.pos(VW / 2 - 28, 71), k.z(21)]);
    cdBg.opacity = 0; cdBar.opacity = 0;

    // ── Action buttons (bottom row) ───────────────────────────────────────────
    // Scrub button
    const scrubBtn = k.add([
      k.rect(64, 52, { radius: 14 }),
      k.color(251, 191, 36),
      k.area(),
      k.anchor("center"),
      k.pos(60, VH - 44),
      k.z(20),
      "scrubBtn",
    ]);
    k.add([k.text("🧹", { size: 26 }), k.anchor("center"), k.pos(60, VH - 48), k.z(21)]);
    k.add([k.text("SCRUB", { size: 9 }), k.anchor("center"), k.pos(60, VH - 26), k.color(80, 60, 0), k.z(21)]);

    // O2 pump button
    const o2Btn = k.add([
      k.rect(64, 52, { radius: 14 }),
      k.color(96, 165, 250),
      k.area(),
      k.anchor("center"),
      k.pos(VW - 60, VH - 44),
      k.z(20),
      "o2Btn",
    ]);
    k.add([k.text("💨", { size: 26 }), k.anchor("center"), k.pos(VW - 60, VH - 48), k.z(21)]);
    k.add([k.text("PUMP O₂", { size: 9 }), k.anchor("center"), k.pos(VW - 60, VH - 26), k.color(20, 40, 80), k.z(21)]);

    // Shop button
    const shopBtn = k.add([
      k.rect(64, 52, { radius: 14 }),
      k.color(167, 139, 250),
      k.area(),
      k.anchor("center"),
      k.pos(VW / 2, VH - 44),
      k.z(20),
      "shopBtn",
    ]);
    k.add([k.text("🛒", { size: 26 }), k.anchor("center"), k.pos(VW / 2, VH - 48), k.z(21)]);
    k.add([k.text("SHOP", { size: 9 }), k.anchor("center"), k.pos(VW / 2, VH - 26), k.color(60, 40, 100), k.z(21)]);

    // ── Scrub action ─────────────────────────────────────────────────────────
    scrubBtn.onClick(() => {
      dirty = Math.max(0, dirty - 35);
      // Flash
      scrubBtn.color = k.rgb(255, 255, 200);
      k.wait(0.2, () => { scrubBtn.color = k.rgb(251, 191, 36); });
      // Bubble burst effect
      for (let i = 0; i < 5; i++) {
        const bx = BCX + k.rand(-50, 50);
        const by = BCY + k.rand(-40, 40);
        const bub = k.add([k.circle(k.rand(4, 9)), k.color(186, 230, 253), k.opacity(0.7), k.anchor("center"), k.pos(bx, by), k.z(15)]);
        k.wait(0.4 + i * 0.08, () => { if (bub.exists()) k.destroy(bub); });
      }
    });

    // ── O2 pump action ───────────────────────────────────────────────────────
    o2Btn.onClick(() => {
      o2 = Math.min(100, o2 + 40);
      o2Btn.color = k.rgb(200, 240, 255);
      k.wait(0.2, () => { o2Btn.color = k.rgb(96, 165, 250); });
      // Bubble stream
      for (let i = 0; i < 6; i++) {
        k.wait(i * 0.07, () => {
          const bub = k.add([k.circle(4 + i % 3), k.color(186, 230, 253), k.opacity(0.65), k.anchor("center"), k.pos(BCX + k.rand(-30, 30), BCY + 60), k.z(15)]);
          let bt = 0;
          bub.onUpdate(() => {
            bt += k.dt();
            bub.pos.y -= 60 * k.dt();
            bub.opacity = 0.65 - bt * 0.9;
            if (bt > 0.7) k.destroy(bub);
          });
        });
      }
    });

    // ── Feed action ───────────────────────────────────────────────────────────
    feedBtnBg.onClick(() => {
      if (!canFeed) return;
      if (feedCount >= FEED_LIMIT) return;

      feedCount++;
      score++;
      hunger = Math.max(0, hunger - 30);
      canFeed = false;
      cooldownLeft = FEED_COOLDOWN;
      onScore(score);

      cdBg.opacity = 1; cdBar.opacity = 1;
      feedBtnBg.color = k.rgb(80, 100, 100);

      // Drop pellet from feed button
      if (foodPellet) k.destroy(foodPellet);
      foodTargetX = BCX + k.rand(-30, 30);
      foodTargetY = BCY - BOWL_R + 28 + k.rand(0, 20);
      foodDrifting = true;
      fishChasing = false;

      foodPellet = k.add([
        k.circle(8),
        k.color(250, 204, 21),
        k.anchor("center"),
        k.pos(VW / 2, 80),
        k.z(12),
      ]);

      if (feedCount >= FEED_LIMIT) {
        k.wait(0.9, () => k.go("explode", score));
      }
    });

    // ── Shop panel ────────────────────────────────────────────────────────────
    let shopPanel: GameObj[] = [];

    function openShop() {
      showShop = true;
      const panelX = 20, panelY = 90;
      const panelW = VW - 40, panelH = 400;

      const bg = k.add([k.rect(panelW, panelH, { radius: 16 }), k.color(20, 20, 40), k.opacity(0.97), k.anchor("topleft"), k.pos(panelX, panelY), k.z(50)]);
      shopPanel.push(bg);

      const title = k.add([k.text("🛒 Shop", { size: 20 }), k.anchor("center"), k.pos(VW / 2, panelY + 24), k.color(253, 224, 71), k.z(51)]);
      shopPanel.push(title);

      const coinInfo = k.add([k.text("🪙 " + Math.floor(coins), { size: 14 }), k.anchor("center"), k.pos(VW / 2, panelY + 46), k.color(200, 200, 200), k.z(51)]);
      shopPanel.push(coinInfo);

      SHOP_ITEMS.forEach((item, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const ix = panelX + 20 + col * 170;
        const iy = panelY + 68 + row * 72;

        const owned  = save.owned.includes(item.id);
        const active = save.active.includes(item.id) || save.bg === item.id || save.fishSkin === item.id;
        const btnColor: [number,number,number] = owned
          ? (active ? [16, 185, 129] : [60, 80, 100])
          : [80, 60, 120];

        const btn = k.add([
          k.rect(155, 60, { radius: 10 }),
          k.color(...btnColor),
          k.area(),
          k.anchor("topleft"),
          k.pos(ix, iy),
          k.z(51),
        ]);
        shopPanel.push(btn);

        const emojiLbl = k.add([k.text(item.emoji, { size: 22 }), k.anchor("topleft"), k.pos(ix + 6, iy + 8), k.z(52)]);
        shopPanel.push(emojiLbl);

        const nameLbl = k.add([k.text(item.label, { size: 12 }), k.anchor("topleft"), k.pos(ix + 36, iy + 8), k.color(255, 255, 255), k.z(52)]);
        shopPanel.push(nameLbl);

        const subLbl = k.add([
          k.text(owned ? (active ? "✓ Active" : "Tap to use") : "🪙 " + item.cost, { size: 10 }),
          k.anchor("topleft"),
          k.pos(ix + 36, iy + 28),
          k.color(owned ? (active ? [167, 243, 208] : [180, 180, 180]) : [253, 224, 71]),
          k.z(52),
        ]);
        shopPanel.push(subLbl);

        btn.onClick(() => {
          if (!owned) {
            if (coins < item.cost) return;
            coins -= item.cost;
            save.owned.push(item.id);
            coinLabel.text = "🪙 " + Math.floor(coins);
          }
          // Apply item
          if (item.id.startsWith("bg")) {
            save.bg = item.id;
          } else if (item.id === "goldfish" || item.id === "stripey") {
            save.fishSkin = item.id;
          } else {
            if (!save.active.includes(item.id)) save.active.push(item.id);
          }
          save.coins = coins;
          saveSave(save);
          closeShop();
          k.go("play"); // Reload scene to apply changes
        });
      });

      const closeBtn = k.add([
        k.rect(80, 32, { radius: 8 }),
        k.color(239, 68, 68),
        k.area(),
        k.anchor("center"),
        k.pos(VW / 2, panelY + panelH - 20),
        k.z(52),
      ]);
      shopPanel.push(closeBtn);
      const closeLbl = k.add([k.text("Close", { size: 13 }), k.anchor("center"), k.pos(VW / 2, panelY + panelH - 20), k.color(255, 255, 255), k.z(53)]);
      shopPanel.push(closeLbl);
      closeBtn.onClick(() => closeShop());
      void closeLbl;
    }

    function closeShop() {
      showShop = false;
      shopPanel.forEach(obj => { if (obj.exists()) k.destroy(obj); });
      shopPanel = [];
    }

    shopBtn.onClick(() => {
      if (showShop) closeShop(); else openShop();
    });

    // ── Mood calc ─────────────────────────────────────────────────────────────
    const MOOD_BADGES: Record<Mood, string> = {
      happy:       "😊 Happy",
      hungry:      "😋 Hungry",
      dirty:       "🤢 Dirty Water",
      suffocating: "😵 No O₂!",
      overfed:     "😰 Overfed!",
      dead:        "💀 Dead",
    };

    function calcMood(): Mood {
      if (feedCount >= FEED_LIMIT - 1) return "overfed";
      if (o2 < 15)      return "suffocating";
      if (dirty > 80)   return "dirty";
      if (hunger > 75)  return "hungry";
      return "happy";
    }

    function applyMoodToFish(m: Mood) {
      // Body color
      const skinColors: Record<string, [number,number,number]> = {
        default:  [245, 158, 11],
        goldfish: [255, 200, 40],
        stripey:  [80, 160, 240],
      };
      let [r, g, b] = skinColors[save.fishSkin] ?? [245, 158, 11];
      if (m === "suffocating") { r = 150; g = 150; b = 200; }
      if (m === "dirty")       { r = 160; g = 130; b = 60;  }
      if (m === "overfed")     { r = 239; g = 68;  b = 68;  }
      fishBodyObj.color     = k.rgb(r, g, b);
      tailAObj.color        = k.rgb(r, g, b);
      tailBObj.color        = k.rgb(r, g, b);
      dorsalFinObj.color    = k.rgb(r, g, b);
      pectoralFinObj.color  = k.rgb(r, g, b);

      // Mouth shape
      if (m === "happy")       { mouthObj.width = 8;  mouthObj.height = 3; }
      if (m === "hungry")      { mouthObj.width = 12; mouthObj.height = 5; }
      if (m === "dirty")       { mouthObj.width = 6;  mouthObj.height = 3; }
      if (m === "suffocating") { mouthObj.width = 14; mouthObj.height = 7; }
      if (m === "overfed")     { mouthObj.width = 14; mouthObj.height = 8; }

      // Eyes
      if (m === "suffocating" || m === "overfed") {
        eyeWhiteObj.color = k.rgb(239, 68, 68);
        pupilObj.color    = k.rgb(239, 68, 68);
      } else {
        eyeWhiteObj.color = k.rgb(255, 255, 255);
        pupilObj.color    = k.rgb(24, 24, 27);
      }
    }

    // ── Sync fish parts ───────────────────────────────────────────────────────
    function syncFish(angle: number) {
      const wag = Math.sin(swimT * 8) * 14;
      const cosA = Math.cos((angle * Math.PI) / 180);
      const sinA = Math.sin((angle * Math.PI) / 180);
      for (const p of parts) {
        p.obj.pos.x = fishX + p.ox * cosA - p.oy * sinA;
        p.obj.pos.y = fishY + p.ox * sinA + p.oy * cosA;
        p.obj.angle = angle + p.baseRot + (p.waggy ? wag : 0);
      }
    }

    // ── Main update ───────────────────────────────────────────────────────────
    k.onUpdate(() => {
      if (showShop) return;
      const dt = k.dt();
      swimT += dt;

      // Meter drains
      dirty  = Math.min(100, dirty  + METER_DRAIN_DIRTY  * dt);
      o2     = Math.max(0,   o2     - METER_DRAIN_O2     * dt);
      hunger = Math.min(100, hunger + METER_DRAIN_HUNGER * dt);

      // Update bar widths
      dirtyBar.fill.width  = dirtyBar.maxW * (1 - dirty  / 100); // more dirty = less clean shown
      o2Bar.fill.width     = o2Bar.maxW    * (o2     / 100);
      hungerBar.fill.width = hungerBar.maxW * (1 - hunger / 100); // more hunger = less full shown

      // Color bars by danger level
      if (dirty > 70)  dirtyBar.fill.color  = k.rgb(239, 68, 68);
      else if (dirty > 40) dirtyBar.fill.color = k.rgb(251, 191, 36);
      else             dirtyBar.fill.color  = k.rgb(167, 243, 208);

      if (o2 < 20)     o2Bar.fill.color     = k.rgb(239, 68, 68);
      else if (o2 < 50) o2Bar.fill.color    = k.rgb(251, 191, 36);
      else             o2Bar.fill.color     = k.rgb(96, 165, 250);

      if (hunger > 70) hungerBar.fill.color = k.rgb(239, 68, 68);
      else             hungerBar.fill.color = k.rgb(251, 191, 36);

      // Mood
      mood = calcMood();
      moodBadge.text = MOOD_BADGES[mood];
      applyMoodToFish(mood);

      // Coins — earn when happy
      if (mood === "happy") {
        coinAccum += COIN_HAPPY_RATE * dt;
        if (coinAccum >= 1) {
          const earned = Math.floor(coinAccum);
          coins += earned;
          coinAccum -= earned;
          score += earned;
          onScore(score);
          coinLabel.text = "🪙 " + Math.floor(coins);
          save.coins = coins;
          saveSave(save);
        }
      }

      // Feed cooldown
      if (!canFeed) {
        cooldownLeft -= dt;
        if (cooldownLeft <= 0) {
          canFeed = true;
          cooldownLeft = 0;
          feedBtnBg.color = k.rgb(16, 185, 129);
          cdBg.opacity = 0; cdBar.opacity = 0;
        } else {
          cdBar.width = 56 * (cooldownLeft / FEED_COOLDOWN);
        }
      }

      // Food pellet drifting down
      if (foodDrifting && foodPellet) {
        const spd = 130 * dt;
        const dy = foodTargetY - foodPellet.pos.y;
        const dx = foodTargetX - foodPellet.pos.x;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 6) {
          foodPellet.pos.x += (dx / dist) * spd;
          foodPellet.pos.y += (dy / dist) * spd;
        } else {
          foodDrifting = false;
          fishChasing  = true;
        }
      }

      // Fish movement
      const swimR = BOWL_R - 32;
      const speedMult = mood === "happy" ? 1 : mood === "hungry" ? 1.4 : mood === "suffocating" ? 0.4 : 0.7;

      if (fishChasing && foodPellet) {
        const dx = foodTargetX - fishX;
        const dy = foodTargetY - fishY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const spd = 160 * speedMult;
        if (dist > 10) {
          fishX += (dx / dist) * spd * dt;
          fishY += (dy / dist) * spd * dt;
          fishAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        } else {
          if (foodPellet) k.destroy(foodPellet);
          foodPellet = null;
          fishChasing = false;
          // Re-sync swim angle
          swimT = Math.atan2((fishY - BCY) / (swimR * 0.55), (fishX - BCX) / swimR) / 0.55;
        }
      } else {
        // Idle ellipse orbit
        const theta = swimT * 0.52 * speedMult;
        fishX = BCX + swimR * Math.cos(theta);
        fishY = BCY + swimR * Math.sin(theta) * 0.55;
        const tdx = -swimR * Math.sin(theta) * 0.52 * speedMult;
        const tdy =  swimR * Math.cos(theta) * 0.52 * speedMult * 0.55;
        fishAngle = Math.atan2(tdy, tdx) * (180 / Math.PI);
      }

      syncFish(fishAngle);

      // Bubbles when happy
      if (mood === "happy") {
        bubbleTimer -= dt;
        if (bubbleTimer <= 0) {
          bubbleTimer = 1.5 + Math.random() * 2;
          const bub = k.add([k.circle(3 + Math.random() * 4), k.color(186, 230, 253), k.opacity(0.6), k.anchor("center"), k.pos(fishX + 10, fishY - 10), k.z(13)]);
          let bt = 0;
          bub.onUpdate(() => {
            bt += k.dt();
            bub.pos.y -= 45 * k.dt();
            bub.pos.x += Math.sin(bt * 4) * 0.8;
            bub.opacity = 0.6 - bt * 0.5;
            if (bt > 1.2) k.destroy(bub);
          });
        }
      }

      // Death check
      if (o2 <= 0 && mood === "suffocating") {
        k.wait(2, () => k.go("dead", score, "suffocated"));
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // EXPLODE SCENE
  // ══════════════════════════════════════════════════════════════════════════
  k.scene("explode", (finalScore: number) => {
    const save = loadSave();
    addBowl(k, 0, save.bg, save.active);

    const chunkCols: [number,number,number][] = [
      [245, 158, 11], [255, 94, 94], [253, 186, 116], [245, 245, 220], [239, 68, 68],
    ];
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const dist  = 20 + Math.random() * 95;
      const cx = BCX + Math.cos(angle) * dist;
      const cy = BCY + Math.sin(angle) * dist * 0.7;
      const col = chunkCols[i % chunkCols.length]!;
      k.add([k.circle(7 + Math.random() * 18), k.color(...col), k.opacity(0.85), k.anchor("center"), k.pos(cx, cy), k.z(5)]);
    }
    // Stray eye
    k.add([k.circle(7), k.color(255, 255, 255), k.anchor("center"), k.pos(BCX + 22, BCY - 34), k.z(6)]);
    k.add([k.circle(3), k.color(24, 24, 27), k.anchor("center"), k.pos(BCX + 24, BCY - 34), k.z(7)]);
    // Scales
    for (let i = 0; i < 6; i++) {
      k.add([k.rect(10, 7, { radius: 3 }), k.color(245, 158, 11), k.opacity(0.7), k.anchor("center"), k.pos(BCX - 40 + i * 18, BCY + 20 + (i % 2) * 14), k.rotate(i * 25), k.z(5)]);
    }

    k.add([k.rect(VW, VH), k.color(0, 0, 0), k.opacity(0.6), k.pos(0, 0), k.z(8)]);
    k.add([k.text("💀 OVERFED!", { size: 34 }), k.anchor("center"), k.pos(VW / 2, VH / 2 - 60), k.color(239, 68, 68), k.z(10)]);
    k.add([k.text("The fish exploded! 🐟💥", { size: 18 }), k.anchor("center"), k.pos(VW / 2, VH / 2 - 18), k.color(251, 191, 36), k.z(10)]);
    k.add([k.text("Fish flesh is everywhere...", { size: 14 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 12), k.color(200, 150, 150), k.z(10)]);
    k.add([k.text("Score: " + String(finalScore), { size: 22 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 46), k.color(16, 185, 129), k.z(10)]);
    k.add([k.text("Tap or Space to restart", { size: 14 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 80), k.color(200, 200, 200), k.z(10)]);

    k.onMousePress(() => k.go("play"));
    k.onKeyPress("space", () => k.go("play"));
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DEAD SCENE (suffocated / dirty)
  // ══════════════════════════════════════════════════════════════════════════
  k.scene("dead", (finalScore: number, reason: string) => {
    const save = loadSave();
    addBowl(k, reason === "suffocated" ? 0 : 100, save.bg, save.active);

    // Dead fish (floats upside down)
    const [r, g, b]: [number,number,number] = reason === "suffocated" ? [150, 150, 200] : [120, 100, 60];
    k.add([k.rect(54, 28, { radius: 14 }), k.color(r, g, b), k.opacity(0.8), k.anchor("center"), k.pos(BCX, BCY - 60), k.rotate(180), k.z(5)]);
    k.add([k.circle(6), k.color(255, 255, 255), k.anchor("center"), k.pos(BCX + 16, BCY - 72), k.z(6)]);
    k.add([k.text("×", { size: 14 }), k.anchor("center"), k.pos(BCX + 16, BCY - 72), k.color(24, 24, 27), k.z(7)]);

    k.add([k.rect(VW, VH), k.color(0, 0, 0), k.opacity(0.6), k.pos(0, 0), k.z(8)]);
    const msg = reason === "suffocated" ? "The fish suffocated! 😵" : "The tank got too dirty! 🤢";
    k.add([k.text("😢 Your fish died!", { size: 28 }), k.anchor("center"), k.pos(VW / 2, VH / 2 - 60), k.color(239, 68, 68), k.z(10)]);
    k.add([k.text(msg, { size: 16 }), k.anchor("center"), k.pos(VW / 2, VH / 2 - 18), k.color(200, 200, 200), k.z(10)]);
    k.add([k.text("Score: " + String(finalScore), { size: 22 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 20), k.color(16, 185, 129), k.z(10)]);
    k.add([k.text("Tap or Space to try again", { size: 14 }), k.anchor("center"), k.pos(VW / 2, VH / 2 + 60), k.color(200, 200, 200), k.z(10)]);

    k.onMousePress(() => k.go("play"));
    k.onKeyPress("space", () => k.go("play"));
  });

  k.go("play");
  return () => k.quit();
}
