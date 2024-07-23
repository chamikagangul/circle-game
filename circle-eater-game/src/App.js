import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

function App() {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const socketRef = useRef(null);
  const playersRef = useRef({});
  const foodsRef = useRef([]);
  const worldSizeRef = useRef({ width: 0, height: 0 });
  const cameraRef = useRef({ x: 0, y: 0 });
  const [gameOver, setGameOver] = useState(false);
  const keysPressed = useRef({ up: false, down: false, left: false, right: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    socketRef.current = io('http://localhost:3001');

    socketRef.current.on('initGame', ({ players, foods, worldSize }) => {
      playersRef.current = players;
      foodsRef.current = foods;
      worldSizeRef.current = worldSize;
    });

    socketRef.current.on('newPlayer', (player) => {
      playersRef.current[player.id] = player;
    });

    socketRef.current.on('updatePlayers', (players) => {
      playersRef.current = players;
    });

    socketRef.current.on('updateFoods', (foods) => {
      foodsRef.current = foods;
    });

    socketRef.current.on('foodEaten', ({ playerId, foodId, newRadius }) => {
      if (playersRef.current[playerId]) {
        playersRef.current[playerId].radius = newRadius;
      }
      if (playerId === socketRef.current.id) {
        setScore(prevScore => prevScore + 1);
      }
    });

    socketRef.current.on('playerEaten', ({ eaterId, eatenId, newRadius }) => {
      if (playersRef.current[eaterId]) {
        playersRef.current[eaterId].radius = newRadius;
      }
      delete playersRef.current[eatenId];
      if (eatenId === socketRef.current.id) {
        setGameOver(true);
      }
    });

    socketRef.current.on('gameOver', () => {
      setGameOver(true);
    });

    socketRef.current.on('playerDisconnected', (playerId) => {
      delete playersRef.current[playerId];
    });

    function drawCircle(x, y, radius, color) {
      ctx.beginPath();
      ctx.arc(x - cameraRef.current.x, y - cameraRef.current.y, radius, 0, Math.PI * 2, false);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.closePath();
    }

    function update() {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const currentPlayer = playersRef.current[socketRef.current.id];
      if (currentPlayer) {
        cameraRef.current.x = currentPlayer.x - CANVAS_WIDTH / 2;
        cameraRef.current.y = currentPlayer.y - CANVAS_HEIGHT / 2;

        // Check collision with food
        foodsRef.current.forEach(food => {
          const dx = currentPlayer.x - food.x;
          const dy = currentPlayer.y - food.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < currentPlayer.radius + food.radius) {
            socketRef.current.emit('eatFood', food.id);
          }
        });

        // Remove player-to-player collision check from client side
      }

      // Draw players
      Object.values(playersRef.current).forEach(player => {
        drawCircle(player.x, player.y, player.radius, player.color);
      });

      // Draw foods
      foodsRef.current.forEach(food => {
        drawCircle(food.x, food.y, food.radius, 'red');
      });

      animationFrameId = requestAnimationFrame(update);
    }

    update();

    function handleKeyDown(e) {
      if (e.key === 'ArrowUp') keysPressed.current.up = true;
      if (e.key === 'ArrowDown') keysPressed.current.down = true;
      if (e.key === 'ArrowLeft') keysPressed.current.left = true;
      if (e.key === 'ArrowRight') keysPressed.current.right = true;
    }

    function handleKeyUp(e) {
      if (e.key === 'ArrowUp') keysPressed.current.up = false;
      if (e.key === 'ArrowDown') keysPressed.current.down = false;
      if (e.key === 'ArrowLeft') keysPressed.current.left = false;
      if (e.key === 'ArrowRight') keysPressed.current.right = false;
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    function emitMovement() {
      socketRef.current.emit('updatePosition', keysPressed.current);
    }

    const movementInterval = setInterval(emitMovement, 1000 / 60); // 60 times per second

    return () => {
      socketRef.current.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
      clearInterval(movementInterval);
    };
  }, []);

  return (
    <div style={{ textAlign: 'center', marginTop: '20px' }}>
      <h1>Circle Eater 2D - Multiplayer</h1>
      <p>Score: {score}</p>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ border: '1px solid black' }}
      />
      {gameOver && <div style={{ marginTop: '20px', fontSize: '24px', color: 'red' }}>Game Over!</div>}
    </div>
  );
}

export default App;