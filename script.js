const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const statusEl = document.getElementById("status");

const TILE = 20;
const SPEED = 4; // tiles per second
const GHOST_SPEED = 3.2;
const FRIGHTENED_DURATION = 6; // seconds

const baseMap = [
  "1111111111111111111111111111",
  "1000000000110000000000000001",
  "1011110110110110110111111101",
  "1020000100000000100000000201",
  "1011110111111110111111101101",
  "1000000100000000100000000001",
  "1011110110111110110111111101",
  "1000000000100000100000000001",
  "1011111110101110101111111101",
  "1000000000101010101000000001",
  "1111110111101010111101111101",
  "1000010100000000000010100001",
  "1111010101111111111010101111",
  "1000000101000000001010000001",
  "1011111101010111101011111101",
  "1020000001000100010000000201",
  "1011111101110101111011111101",
  "1000000000000100000000000001",
  "1011111111110101111111111101",
  "1000000000000000000000000001",
  "1111111111111111111111111111",
];

let map = baseMap.map((row) => row);

const pelletCount = (() => {
  let count = 0;
  baseMap.forEach((row) => {
    for (const c of row) {
      if (c === "0" || c === "2") count++;
    }
  });
  return count;
})();

canvas.width = baseMap[0].length * TILE;
canvas.height = baseMap.length * TILE;

let pelletsLeft = pelletCount;
let score = 0;
let lastTime = 0;
let paused = false;
let gameOver = false;
let frightenedTimer = 0;

const pacman = {
  x: 13,
  y: 17,
  dir: { x: 0, y: 0 },
  nextDir: { x: 0, y: 0 },
};

const ghosts = [
  { x: 13, y: 13, color: "#ff4b5c", dir: { x: 0, y: -1 }, home: { x: 13, y: 13 } },
  { x: 14, y: 13, color: "#5cf4ff", dir: { x: 0, y: -1 }, home: { x: 14, y: 13 } },
  { x: 12, y: 13, color: "#ff9c00", dir: { x: 0, y: -1 }, home: { x: 12, y: 13 } },
];

const directions = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

function resetGame(message = "准备开吃！") {
  map = baseMap.map((row) => row);
  pelletsLeft = pelletCount;
  score = 0;
  frightenedTimer = 0;
  gameOver = false;
  paused = false;
  pacman.x = 13;
  pacman.y = 17;
  pacman.dir = { x: 0, y: 0 };
  pacman.nextDir = { x: 0, y: 0 };
  ghosts.forEach((g) => {
    g.x = g.home.x;
    g.y = g.home.y;
    g.dir = { x: 0, y: -1 };
  });
  updateStatus(message);
  updateScore();
}

function updateScore() {
  scoreEl.textContent = `得分：${score}`;
}

function updateStatus(text, cssClass = "") {
  statusEl.textContent = text;
  statusEl.className = cssClass;
}

function isWall(x, y) {
  return map[y]?.[x] === "1" || typeof map[y]?.[x] === "undefined";
}

function handleInput(e) {
  if (e.code === "Space") {
    paused = !paused;
    updateStatus(paused ? "暂停中" : "继续游戏", paused ? "status-pause" : "");
    return;
  }

  if (e.key === "r" || e.key === "R") {
    resetGame("重新开始，吃掉所有豆子！");
    return;
  }

  const dir = directions[e.key];
  if (dir) {
    pacman.nextDir = dir;
    e.preventDefault();
  }
}

document.addEventListener("keydown", handleInput);

function canMove(x, y) {
  return !isWall(x, y);
}

function moveEntity(entity, speed, dt) {
  const moveStep = speed * dt;
  let nextX = entity.x + entity.dir.x * moveStep;
  let nextY = entity.y + entity.dir.y * moveStep;

  if (Number.isInteger(nextX) && Number.isInteger(nextY)) {
    if (!canMove(nextX, nextY)) {
      nextX = entity.x;
      nextY = entity.y;
    }
  }

  entity.x = nextX;
  entity.y = nextY;
}

function updatePacman(dt) {
  const targetDir = pacman.nextDir;
  const nextTileX = Math.round(pacman.x + targetDir.x);
  const nextTileY = Math.round(pacman.y + targetDir.y);
  if (Number.isInteger(pacman.x) && Number.isInteger(pacman.y) && canMove(nextTileX, nextTileY)) {
    pacman.dir = targetDir;
  }

  moveEntity(pacman, SPEED, dt);

  const tileX = Math.round(pacman.x);
  const tileY = Math.round(pacman.y);
  const cell = map[tileY]?.[tileX];
  if (cell === "0") {
    map[tileY] = replaceChar(map[tileY], tileX, "3");
    score += 10;
    pelletsLeft--;
    updateScore();
  } else if (cell === "2") {
    map[tileY] = replaceChar(map[tileY], tileX, "3");
    score += 50;
    pelletsLeft--;
    frightenedTimer = FRIGHTENED_DURATION;
    updateScore();
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function ghostTarget(ghost) {
  if (frightenedTimer > 0) {
    return { x: ghost.x + (ghost.x - pacman.x), y: ghost.y + (ghost.y - pacman.y) };
  }
  return { x: pacman.x, y: pacman.y };
}

function stepGhost(ghost, dt) {
  if (!Number.isInteger(ghost.x) || !Number.isInteger(ghost.y)) {
    moveEntity(ghost, GHOST_SPEED * (frightenedTimer > 0 ? 0.6 : 1), dt);
    return;
  }

  const target = ghostTarget(ghost);
  const options = [
    { x: ghost.x + 1, y: ghost.y, dir: { x: 1, y: 0 } },
    { x: ghost.x - 1, y: ghost.y, dir: { x: -1, y: 0 } },
    { x: ghost.x, y: ghost.y + 1, dir: { x: 0, y: 1 } },
    { x: ghost.x, y: ghost.y - 1, dir: { x: 0, y: -1 } },
  ].filter((opt) => !isWall(opt.x, opt.y));

  options.sort((a, b) => distance(a, target) - distance(b, target));
  const chosen = frightenedTimer > 0 ? options[options.length - 1] : options[0];
  ghost.dir = chosen?.dir || ghost.dir;
  moveEntity(ghost, GHOST_SPEED * (frightenedTimer > 0 ? 0.6 : 1), dt);
}

function replaceChar(str, index, value) {
  return str.substring(0, index) + value + str.substring(index + 1);
}

function checkCollisions() {
  ghosts.forEach((g) => {
    if (distance(g, pacman) < 0.7) {
      if (frightenedTimer > 0) {
        score += 200;
        g.x = g.home.x;
        g.y = g.home.y;
        g.dir = { x: 0, y: -1 };
        updateScore();
      } else {
        endGame(false);
      }
    }
  });
}

function endGame(win) {
  gameOver = true;
  updateStatus(win ? "你赢了！按 R 重开" : "被鬼吃掉了，再来！按 R 重开", win ? "status-win" : "status-lose");
}

function drawMap() {
  ctx.fillStyle = "#000826";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const cell = map[y][x];
      const px = x * TILE;
      const py = y * TILE;
      if (cell === "1") {
        ctx.fillStyle = "#1d2b5f";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = "#2f3f7b";
        ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
      } else if (cell === "0") {
        ctx.fillStyle = "#ffd166";
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (cell === "2") {
        ctx.fillStyle = "#7bf09e";
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPacman() {
  const angle = Math.sin(performance.now() / 100) * 0.25 + 0.35;
  ctx.fillStyle = "#ffce00";
  ctx.beginPath();
  const mouthDir = Math.atan2(pacman.dir.y, pacman.dir.x) || 0;
  ctx.moveTo(pacman.x * TILE + TILE / 2, pacman.y * TILE + TILE / 2);
  ctx.arc(
    pacman.x * TILE + TILE / 2,
    pacman.y * TILE + TILE / 2,
    TILE / 2,
    angle + mouthDir,
    Math.PI * 2 - angle + mouthDir
  );
  ctx.closePath();
  ctx.fill();
}

function drawGhost(ghost) {
  const px = ghost.x * TILE;
  const py = ghost.y * TILE;
  ctx.fillStyle = frightenedTimer > 0 ? "#4db6ff" : ghost.color;
  ctx.beginPath();
  ctx.arc(px + TILE / 2, py + TILE / 2, TILE / 2, Math.PI, 0);
  ctx.rect(px, py + TILE / 2, TILE, TILE / 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(px + TILE * 0.35, py + TILE * 0.45, 3, 0, Math.PI * 2);
  ctx.arc(px + TILE * 0.65, py + TILE * 0.45, 3, 0, Math.PI * 2);
  ctx.fill();
}

function render() {
  drawMap();
  drawPacman();
  ghosts.forEach(drawGhost);
}

function gameLoop(timestamp) {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (!paused && !gameOver) {
    frightenedTimer = Math.max(0, frightenedTimer - dt);
    updatePacman(dt);
    ghosts.forEach((g) => stepGhost(g, dt));
    checkCollisions();
    if (pelletsLeft <= 0) {
      endGame(true);
    }
  }

  render();
  requestAnimationFrame(gameLoop);
}

resetGame();
requestAnimationFrame(gameLoop);
