const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

const OPPOSITE = new Map([
  ['ArrowUp', 'ArrowDown'],
  ['ArrowDown', 'ArrowUp'],
  ['ArrowLeft', 'ArrowRight'],
  ['ArrowRight', 'ArrowLeft'],
  ['w', 's'],
  ['s', 'w'],
  ['a', 'd'],
  ['d', 'a'],
]);

function positionKey(pos) {
  return `${pos.x},${pos.y}`;
}

export function createInitialState({ width, height, rng = Math.random }) {
  const start = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const snake = [start, { x: start.x - 1, y: start.y }];
  const direction = { x: 1, y: 0 };

  return {
    width,
    height,
    snake,
    direction,
    queuedDirection: direction,
    food: spawnFood({ width, height, snake, rng }),
    rng,
    score: 0,
    status: 'ready',
  };
}

export function spawnFood({ width, height, snake, rng = Math.random }) {
  const occupied = new Set(snake.map(positionKey));
  const free = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x},${y}`;
      if (!occupied.has(key)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  const index = Math.floor(rng() * free.length);
  return free[index];
}

export function enqueueDirection(state, key) {
  const next = DIRECTIONS[key];
  if (!next) return state;

  const currentKey = state.lastDirectionKey || 'ArrowRight';
  if (OPPOSITE.get(key) === currentKey) return state;

  return {
    ...state,
    queuedDirection: next,
    lastDirectionKey: key,
  };
}

export function stepState(state) {
  if (state.status !== 'playing') return state;

  const direction = state.queuedDirection || state.direction;
  const head = state.snake[0];
  const nextHead = { x: head.x + direction.x, y: head.y + direction.y };

  if (
    nextHead.x < 0 ||
    nextHead.x >= state.width ||
    nextHead.y < 0 ||
    nextHead.y >= state.height
  ) {
    return { ...state, status: 'gameover' };
  }

  const hitsSelf = state.snake.some(
    (segment) => segment.x === nextHead.x && segment.y === nextHead.y
  );
  if (hitsSelf) {
    return { ...state, status: 'gameover' };
  }

  const nextSnake = [nextHead, ...state.snake];
  const ateFood = state.food && nextHead.x === state.food.x && nextHead.y === state.food.y;

  if (!ateFood) {
    nextSnake.pop();
  }

  return {
    ...state,
    snake: nextSnake,
    direction,
    queuedDirection: direction,
    food: ateFood
      ? spawnFood({
          width: state.width,
          height: state.height,
          snake: nextSnake,
          rng: state.rng,
        })
      : state.food,
    score: ateFood ? state.score + 1 : state.score,
  };
}
