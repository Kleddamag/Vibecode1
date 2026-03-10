const GRID_SIZE = 24;
const BASE_TICK_MS = 150;
const MIN_TICK_MS = 85;
const SPEED_UP_PER_FOOD = 3;

const canvas = document.getElementById("game-board");
const context = canvas.getContext("2d");
const startButton = document.getElementById("start-button");
const resetButton = document.getElementById("reset-button");
const statusText = document.getElementById("status-text");
const announcer = document.getElementById("announcer");
const roundNumber = document.getElementById("round-number");
const playerOneScore = document.getElementById("player-one-score");
const playerTwoScore = document.getElementById("player-two-score");
const playerOneLength = document.getElementById("player-one-length");
const playerTwoLength = document.getElementById("player-two-length");

const scoreboard = {
  p1: 0,
  p2: 0,
  round: 1,
};

let roundState = buildRoundState();
let roundActive = false;
let roundResolved = false;
let animationFrameId = 0;
let previousTimestamp = 0;
let accumulatedTime = 0;

const controlMap = new Map([
  ["KeyW", { snakeId: "p1", direction: { x: 0, y: -1 } }],
  ["KeyA", { snakeId: "p1", direction: { x: -1, y: 0 } }],
  ["KeyS", { snakeId: "p1", direction: { x: 0, y: 1 } }],
  ["KeyD", { snakeId: "p1", direction: { x: 1, y: 0 } }],
  ["ArrowUp", { snakeId: "p2", direction: { x: 0, y: -1 } }],
  ["ArrowLeft", { snakeId: "p2", direction: { x: -1, y: 0 } }],
  ["ArrowDown", { snakeId: "p2", direction: { x: 0, y: 1 } }],
  ["ArrowRight", { snakeId: "p2", direction: { x: 1, y: 0 } }],
]);

function buildRoundState() {
  const snakes = [
    {
      id: "p1",
      label: "Player 1",
      color: "#8dfc7f",
      glow: "rgba(141, 252, 127, 0.45)",
      direction: { x: 1, y: 0 },
      queuedDirection: { x: 1, y: 0 },
      hasQueuedTurn: false,
      body: [
        { x: 4, y: 7 },
        { x: 3, y: 7 },
        { x: 2, y: 7 },
      ],
      alive: true,
      foodCount: 0,
    },
    {
      id: "p2",
      label: "Player 2",
      color: "#ffb85c",
      glow: "rgba(255, 184, 92, 0.45)",
      direction: { x: -1, y: 0 },
      queuedDirection: { x: -1, y: 0 },
      hasQueuedTurn: false,
      body: [
        { x: GRID_SIZE - 5, y: GRID_SIZE - 8 },
        { x: GRID_SIZE - 4, y: GRID_SIZE - 8 },
        { x: GRID_SIZE - 3, y: GRID_SIZE - 8 },
      ],
      alive: true,
      foodCount: 0,
    },
  ];

  return {
    food: spawnFood(snakes),
    snakes,
    status: `Round ${scoreboard.round} ready. Press Space to start.`,
    winnerId: null,
    winnerLabel: null,
  };
}

function spawnFood(snakes) {
  const occupied = new Set();

  snakes.forEach((snake) => {
    snake.body.forEach((segment) => occupied.add(toKey(segment)));
  });

  const availableCells = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!occupied.has(`${x}:${y}`)) {
        availableCells.push({ x, y });
      }
    }
  }

  return availableCells[Math.floor(Math.random() * availableCells.length)];
}

function toKey(cell) {
  return `${cell.x}:${cell.y}`;
}

function sameCell(left, right) {
  return left.x === right.x && left.y === right.y;
}

function isOpposite(first, second) {
  return first.x + second.x === 0 && first.y + second.y === 0;
}

function queueTurn(snakeId, direction) {
  const snake = roundState.snakes.find((candidate) => candidate.id === snakeId);

  if (!snake || !snake.alive) {
    return;
  }

  const comparison = snake.hasQueuedTurn ? snake.queuedDirection : snake.direction;

  if (isOpposite(comparison, direction)) {
    return;
  }

  snake.queuedDirection = direction;
  snake.hasQueuedTurn = true;
}

function updateStatus(message) {
  roundState.status = message;
  statusText.textContent = message;
  announcer.textContent = message;
}

function updateScoreboard() {
  roundNumber.textContent = String(scoreboard.round);
  playerOneScore.textContent = String(scoreboard.p1);
  playerTwoScore.textContent = String(scoreboard.p2);

  const [playerOne, playerTwo] = roundState.snakes;
  playerOneLength.textContent = `Length ${playerOne.body.length} • Food ${playerOne.foodCount}`;
  playerTwoLength.textContent = `Length ${playerTwo.body.length} • Food ${playerTwo.foodCount}`;
}

function resetTiming() {
  previousTimestamp = 0;
  accumulatedTime = 0;
}

function startRound() {
  if (roundActive) {
    return;
  }

  if (roundResolved) {
    scoreboard.round += 1;
    roundState = buildRoundState();
    roundResolved = false;
  }

  roundActive = true;
  resetTiming();
  updateStatus(`Round ${scoreboard.round} live. First crash loses.`);
  updateButtons();
  updateScoreboard();
}

function resetMatch() {
  scoreboard.p1 = 0;
  scoreboard.p2 = 0;
  scoreboard.round = 1;
  roundState = buildRoundState();
  roundActive = false;
  roundResolved = false;
  resetTiming();
  updateStatus(`Round ${scoreboard.round} ready. Press Space to start.`);
  updateButtons();
  updateScoreboard();
}

function updateButtons() {
  if (roundActive) {
    startButton.textContent = "Round Running";
    startButton.disabled = true;
    return;
  }

  startButton.disabled = false;
  startButton.textContent = roundResolved ? "Next Round" : "Start Round";
}

function getTickSpeed() {
  const totalFood = roundState.snakes.reduce((sum, snake) => sum + snake.foodCount, 0);
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - totalFood * SPEED_UP_PER_FOOD);
}

function isOutsideBoard(cell) {
  return cell.x < 0 || cell.x >= GRID_SIZE || cell.y < 0 || cell.y >= GRID_SIZE;
}

function tick() {
  const snakes = roundState.snakes;

  snakes.forEach((snake) => {
    if (snake.alive && snake.hasQueuedTurn && !isOpposite(snake.direction, snake.queuedDirection)) {
      snake.direction = snake.queuedDirection;
    }

    snake.hasQueuedTurn = false;
  });

  const nextHeads = new Map();
  const eatsFood = new Map();
  const deaths = new Set();

  snakes.forEach((snake) => {
    if (!snake.alive) {
      return;
    }

    const currentHead = snake.body[0];
    const nextHead = {
      x: currentHead.x + snake.direction.x,
      y: currentHead.y + snake.direction.y,
    };

    nextHeads.set(snake.id, nextHead);
    eatsFood.set(snake.id, sameCell(nextHead, roundState.food));

    if (isOutsideBoard(nextHead)) {
      deaths.add(snake.id);
    }
  });

  const [firstSnake, secondSnake] = snakes;
  const firstNextHead = nextHeads.get(firstSnake.id);
  const secondNextHead = nextHeads.get(secondSnake.id);

  if (firstNextHead && secondNextHead && sameCell(firstNextHead, secondNextHead)) {
    deaths.add(firstSnake.id);
    deaths.add(secondSnake.id);
  }

  if (
    firstNextHead &&
    secondNextHead &&
    sameCell(firstNextHead, secondSnake.body[0]) &&
    sameCell(secondNextHead, firstSnake.body[0])
  ) {
    deaths.add(firstSnake.id);
    deaths.add(secondSnake.id);
  }

  snakes.forEach((snake) => {
    if (!snake.alive) {
      return;
    }

    const nextHead = nextHeads.get(snake.id);
    const retainsTail = Boolean(eatsFood.get(snake.id));
    const ownOccupied = new Set(
      snake.body
        .slice(0, retainsTail ? snake.body.length : snake.body.length - 1)
        .map(toKey),
    );

    if (ownOccupied.has(toKey(nextHead))) {
      deaths.add(snake.id);
    }

    snakes.forEach((otherSnake) => {
      if (snake.id === otherSnake.id || !otherSnake.alive) {
        return;
      }

      const otherRetainsTail = Boolean(eatsFood.get(otherSnake.id));
      const otherOccupied = new Set(
        otherSnake.body
          .slice(0, otherRetainsTail ? otherSnake.body.length : otherSnake.body.length - 1)
          .map(toKey),
      );

      if (otherOccupied.has(toKey(nextHead))) {
        deaths.add(snake.id);
      }
    });
  });

  snakes.forEach((snake) => {
    if (!snake.alive) {
      return;
    }

    if (deaths.has(snake.id)) {
      snake.alive = false;
      return;
    }

    const nextHead = nextHeads.get(snake.id);
    const grew = Boolean(eatsFood.get(snake.id));

    snake.body.unshift(nextHead);

    if (grew) {
      snake.foodCount += 1;
    } else {
      snake.body.pop();
    }
  });

  const survivors = snakes.filter((snake) => snake.alive);

  if (survivors.length <= 1) {
    roundActive = false;
    roundResolved = true;

    if (survivors.length === 1) {
      const winner = survivors[0];
      roundState.winnerId = winner.id;
      roundState.winnerLabel = winner.label;
      scoreboard[winner.id] += 1;
      updateStatus(
        `${winner.label} wins round ${scoreboard.round}. Press Space or click Next Round.`,
      );
    } else {
      roundState.winnerId = null;
      roundState.winnerLabel = null;
      updateStatus(`Round ${scoreboard.round} ends in a draw. Press Space for a rematch.`);
    }

    updateButtons();
    updateScoreboard();
    return;
  }

  if ([...eatsFood.values()].some(Boolean)) {
    roundState.food = spawnFood(snakes);
  }

  updateScoreboard();
}

function resizeCanvas() {
  const { width } = canvas.getBoundingClientRect();
  const size = Math.max(320, Math.floor(width));
  const ratio = window.devicePixelRatio || 1;

  canvas.width = size * ratio;
  canvas.height = size * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawRoundedRect(x, y, width, height, radius) {
  const clippedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + clippedRadius, y);
  context.arcTo(x + width, y, x + width, y + height, clippedRadius);
  context.arcTo(x + width, y + height, x, y + height, clippedRadius);
  context.arcTo(x, y + height, x, y, clippedRadius);
  context.arcTo(x, y, x + width, y, clippedRadius);
  context.closePath();
}

function drawBoard(timestamp) {
  const size = canvas.width / (window.devicePixelRatio || 1);
  const cellSize = size / GRID_SIZE;

  context.clearRect(0, 0, size, size);

  const boardGradient = context.createLinearGradient(0, 0, size, size);
  boardGradient.addColorStop(0, "#15252d");
  boardGradient.addColorStop(1, "#081217");
  context.fillStyle = boardGradient;
  context.fillRect(0, 0, size, size);

  context.strokeStyle = "rgba(255, 255, 255, 0.04)";
  context.lineWidth = 1;

  for (let index = 0; index <= GRID_SIZE; index += 1) {
    const position = Math.round(index * cellSize) + 0.5;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, size);
    context.stroke();
    context.beginPath();
    context.moveTo(0, position);
    context.lineTo(size, position);
    context.stroke();
  }

  const pulse = 0.72 + Math.sin(timestamp / 180) * 0.12;
  const foodX = roundState.food.x * cellSize;
  const foodY = roundState.food.y * cellSize;
  const foodRadius = cellSize * 0.36 * pulse;

  const foodGlow = context.createRadialGradient(
    foodX + cellSize / 2,
    foodY + cellSize / 2,
    cellSize * 0.08,
    foodX + cellSize / 2,
    foodY + cellSize / 2,
    cellSize * 0.7,
  );
  foodGlow.addColorStop(0, "rgba(255, 111, 97, 0.95)");
  foodGlow.addColorStop(1, "rgba(255, 111, 97, 0)");
  context.fillStyle = foodGlow;
  context.fillRect(foodX - cellSize / 2, foodY - cellSize / 2, cellSize * 2, cellSize * 2);

  context.fillStyle = "#ff6f61";
  context.beginPath();
  context.arc(foodX + cellSize / 2, foodY + cellSize / 2, foodRadius, 0, Math.PI * 2);
  context.fill();

  roundState.snakes.forEach((snake) => {
    snake.body.forEach((segment, segmentIndex) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const inset = segmentIndex === 0 ? cellSize * 0.08 : cellSize * 0.12;
      const sizeOffset = cellSize - inset * 2;

      context.shadowColor = snake.glow;
      context.shadowBlur = segmentIndex === 0 ? 18 : 10;
      context.fillStyle = snake.alive ? snake.color : "rgba(255, 255, 255, 0.18)";
      drawRoundedRect(x + inset, y + inset, sizeOffset, sizeOffset, cellSize * 0.24);
      context.fill();
      context.shadowBlur = 0;

      if (segmentIndex === 0) {
        const eyeOffset = cellSize * 0.18;
        const eyeRadius = cellSize * 0.06;
        const headCenterX = x + cellSize / 2;
        const headCenterY = y + cellSize / 2;
        const horizontal = snake.direction.x !== 0;
        const directionSign = snake.direction.x + snake.direction.y || 1;
        const eyeShiftX = horizontal ? eyeOffset * directionSign : 0;
        const eyeShiftY = horizontal ? 0 : eyeOffset * directionSign;

        context.fillStyle = "#081217";
        context.beginPath();
        context.arc(
          headCenterX + eyeShiftX + (horizontal ? 0 : -eyeOffset * 0.6),
          headCenterY + eyeShiftY + (horizontal ? -eyeOffset * 0.6 : 0),
          eyeRadius,
          0,
          Math.PI * 2,
        );
        context.arc(
          headCenterX + eyeShiftX + (horizontal ? 0 : eyeOffset * 0.6),
          headCenterY + eyeShiftY + (horizontal ? eyeOffset * 0.6 : 0),
          eyeRadius,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    });
  });

  if (!roundActive) {
    const overlay = context.createLinearGradient(0, 0, size, size);
    overlay.addColorStop(0, "rgba(8, 18, 23, 0.2)");
    overlay.addColorStop(1, "rgba(8, 18, 23, 0.56)");
    context.fillStyle = overlay;
    context.fillRect(0, 0, size, size);

    const title = roundResolved
      ? roundState.winnerLabel
        ? `${roundState.winnerLabel} Wins`
        : "Draw Round"
      : "Ready";
    const subtitle = roundResolved
      ? roundState.winnerLabel
        ? `Score ${scoreboard.p1} - ${scoreboard.p2} • Press Space for the next round`
        : "Both snakes crashed • Press Space for a rematch"
      : "Press Space to start";

    context.textAlign = "center";
    context.fillStyle = roundResolved
      ? roundState.winnerId === "p1"
        ? "#8dfc7f"
        : roundState.winnerId === "p2"
          ? "#ffb85c"
          : "#f5f1e8"
      : "#f5f1e8";
    context.font = '700 28px "Avenir Next", "Trebuchet MS", sans-serif';
    context.fillText(title, size / 2, size / 2 - 10);
    context.font = '500 16px "Avenir Next", "Trebuchet MS", sans-serif';
    context.fillStyle = "rgba(245, 241, 232, 0.82)";
    context.fillText(subtitle, size / 2, size / 2 + 20);
  }
}

function animate(timestamp) {
  if (roundActive) {
    if (!previousTimestamp) {
      previousTimestamp = timestamp;
    }

    accumulatedTime += timestamp - previousTimestamp;
    previousTimestamp = timestamp;

    while (accumulatedTime >= getTickSpeed()) {
      accumulatedTime -= getTickSpeed();
      tick();

      if (!roundActive) {
        accumulatedTime = 0;
        break;
      }
    }
  } else {
    previousTimestamp = timestamp;
  }

  drawBoard(timestamp);
  animationFrameId = window.requestAnimationFrame(animate);
}

document.addEventListener("keydown", (event) => {
  const mappedControl = controlMap.get(event.code);

  if (mappedControl) {
    event.preventDefault();
    queueTurn(mappedControl.snakeId, mappedControl.direction);
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    startRound();
    return;
  }

  if (event.code === "KeyR") {
    resetMatch();
  }
});

startButton.addEventListener("click", startRound);
resetButton.addEventListener("click", resetMatch);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
updateStatus(roundState.status);
updateButtons();
updateScoreboard();
animationFrameId = window.requestAnimationFrame(animate);

window.addEventListener("beforeunload", () => {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
  }
});
