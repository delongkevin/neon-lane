import React, { useEffect, useRef, useState } from "react";

type Obstacle = {
  lane: number; // 0..2
  y: number;    // position from top in px
  w: number;    // width
  h: number;    // height
  passed: boolean; // for scoring when it passes the player
};

const CANVAS_W = 360;   // game width
const CANVAS_H = 640;   // game height
const LANES = 3;        // number of lanes
const PLAYER_R = 14;    // player radius
const PLAYER_Y = CANVAS_H - 80; // fixed Y position
const BASE_SPEED = 140; // px/sec
const SPEED_GROWTH = 6; // px/sec per minute ~0.1/sec
const BASE_SPAWN = 1.0; // seconds between spawns initially
const MIN_SPAWN = 0.35; // seconds minimum
const SPAWN_DECAY = 0.04; // reduces spawn interval per 10 seconds (~0.004/sec)

function laneX(lane: number) {
  const laneWidth = CANVAS_W / LANES;
  return laneWidth * lane + laneWidth / 2;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [running, setRunning] = useState(true);
  const [playerLane, setPlayerLane] = useState(1);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(() => {
    const v = localStorage.getItem("neonlane_best");
    return v ? parseInt(v) : 0;
  });

  // internal state not causing re-renders
  const obstaclesRef = useRef<Obstacle[]>([]);
  const speedRef = useRef<number>(BASE_SPEED);
  const spawnTimerRef = useRef<number>(0);
  const spawnIntervalRef = useRef<number>(BASE_SPAWN);
  const elapsedRef = useRef<number>(0); // seconds
  const deadRef = useRef<boolean>(false);

  // input handlers: tap left/right half to move lanes
  useEffect(() => {
    const canvas = canvasRef.current!;
    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const half = CANVAS_W / 2;
      if (x < half) {
        setPlayerLane((l) => clamp(l - 1, 0, LANES - 1));
      } else {
        setPlayerLane((l) => clamp(l + 1, 0, LANES - 1));
      }
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    return () => canvas.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // keyboard (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
        setPlayerLane((l) => clamp(l - 1, 0, LANES - 1));
      } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
        setPlayerLane((l) => clamp(l + 1, 0, LANES - 1));
      } else if (e.key.toLowerCase() === "r") {
        if (deadRef.current) restart();
      } else if (e.key.toLowerCase() === "p") {
        setRunning((r) => !r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function spawnObstacle() {
    const lane = Math.floor(Math.random() * LANES);
    const w = CANVAS_W / LANES * 0.6;
    const h = 26 + Math.random() * 20;
    obstaclesRef.current.push({ lane, y: -h, w, h, passed: false });
  }

  function restart() {
    obstaclesRef.current = [];
    speedRef.current = BASE_SPEED;
    spawnIntervalRef.current = BASE_SPAWN;
    spawnTimerRef.current = 0;
    elapsedRef.current = 0;
    deadRef.current = false;
    setScore(0);
    setRunning(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }

  // game loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loop(now: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    if (!running || deadRef.current) {
      draw(ctx);
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    // timing
    const last = (loop as any)._last || now;
    const dt = Math.min(0.05, (now - last) / 1000); // cap dt
    (loop as any)._last = now;
    elapsedRef.current += dt;

    // difficulty ramp
    speedRef.current = BASE_SPEED + SPEED_GROWTH * elapsedRef.current;
    const targetSpawn = Math.max(MIN_SPAWN, BASE_SPAWN - SPAWN_DECAY * elapsedRef.current);
    // approach target spawn interval smoothly
    spawnIntervalRef.current = spawnIntervalRef.current * 0.98 + targetSpawn * 0.02;

    // spawn
    spawnTimerRef.current += dt;
    if (spawnTimerRef.current >= spawnIntervalRef.current) {
      spawnTimerRef.current = 0;
      spawnObstacle();
    }

    // update obstacles
    const speed = speedRef.current;
    obstaclesRef.current.forEach((o) => {
      o.y += speed * dt;

      // scoring when passing player line
      if (!o.passed && o.y + o.h >= PLAYER_Y) {
        o.passed = true;
        setScore((s) => s + 1);
      }
    });

    // remove off-screen
    obstaclesRef.current = obstaclesRef.current.filter((o) => o.y < CANVAS_H + o.h);

    // collision: obstacle in same lane and overlapping y range around player
    for (const o of obstaclesRef.current) {
      if (o.lane === playerLane) {
        const playerTop = PLAYER_Y - PLAYER_R;
        const playerBottom = PLAYER_Y + PLAYER_R;
        const obstacleTop = o.y;
        const obstacleBottom = o.y + o.h;
        const overlap = !(playerBottom < obstacleTop || playerTop > obstacleBottom);
        if (overlap) {
          deadRef.current = true;
          setRunning(false);
          const newBest = Math.max(best, score);
          setBest(newBest);
          localStorage.setItem("neonlane_best", String(newBest));
          break;
        }
      }
    }

    draw(ctx);
    rafRef.current = requestAnimationFrame(loop);
  }

  function draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const laneWidth = CANVAS_W / LANES;
    for (let i = 0; i < LANES; i++) {
      const x0 = i * laneWidth;
      ctx.strokeStyle = i === playerLane ? "#37f" : "#133a59";
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 4, 4, laneWidth - 8, CANVAS_H - 8);
    }

    const px = laneX(playerLane);
    ctx.beginPath();
    ctx.arc(px, PLAYER_Y, PLAYER_R, 0, Math.PI * 2);
    ctx.closePath();
    const glow = ctx.createRadialGradient(px, PLAYER_Y, 2, px, PLAYER_Y, 24);
    glow.addColorStop(0, "#7cf");
    glow.addColorStop(1, "rgba(124,220,255,0)");
    ctx.fillStyle = "#7cf";
    ctx.fill();
    ctx.fillStyle = glow;
    ctx.fill();

    for (const o of obstaclesRef.current) {
      const ox = laneX(o.lane) - o.w / 2;
      const grad = ctx.createLinearGradient(ox, o.y, ox + o.w, o.y + o.h);
      grad.addColorStop(0, "#f0f");
      grad.addColorStop(1, "#f77");
      ctx.fillStyle = grad;
      ctx.fillRect(ox, o.y, o.w, o.h);
      ctx.strokeStyle = "rgba(255,0,255,0.35)";
      ctx.lineWidth = 3;
      ctx.strokeRect(ox, o.y, o.w, o.h);
    }

    ctx.fillStyle = "#9fd6ff";
    ctx.font = "bold 20px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Score: ${score}`, 10, 28);
    ctx.textAlign = "right";
    ctx.fillText(`Best: ${best}`, CANVAS_W - 10, 28);

    // Overlays after HUD
    if (deadRef.current) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 28px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
      ctx.fillText("Game Over", CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
      ctx.fillText("Tap to restart", CANVAS_W / 2, CANVAS_H / 2 + 12);
    } else if (!running) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 28px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
      ctx.fillText("Paused", CANVAS_W / 2, CANVAS_H / 2);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    const onPointerDown = () => {
      if (deadRef.current) restart();
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    return () => canvas.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        <button onClick={() => setRunning((r) => !r)} style={btnStyle} aria-label="Pause or resume">
          {running ? "Pause" : "Resume"}
        </button>
        <button onClick={restart} style={btnStyle} aria-label="Restart">
          Restart
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(55,120,255,0.35)",
          touchAction: "manipulation",
          background: "#071025"
        }}
      />
      <p style={{ color: "#9fd6ff", marginTop: 8 }}>
        Tip: Tap left/right sides to switch lanes. Press R to restart, P to pause.
      </p>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, #215, #37f)",
  color: "#fff",
  border: "none",
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(55,120,255,0.35)"
};