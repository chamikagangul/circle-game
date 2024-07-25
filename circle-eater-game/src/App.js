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
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const [gameOver, setGameOver] = useState(false);
  const keysPressed = useRef({ up: false, down: false, left: false, right: false });

  const [level, setLevel] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(60);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    function drawCircle(x, y, radius, color) {
      const zoom = cameraRef.current.zoom;
      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.beginPath();
      ctx.arc(
        (x - cameraRef.current.x) / zoom, 
        (y - cameraRef.current.y) / zoom,
        radius,
        0,
        Math.PI * 2,
        false
      );
      
      // Create gradient
      const gradient = ctx.createRadialGradient(
        (x - cameraRef.current.x) / zoom, (y - cameraRef.current.y) / zoom, 0,
        (x - cameraRef.current.x) / zoom, (y - cameraRef.current.y) / zoom, radius
      );
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
      
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Add highlight
      ctx.beginPath();
      ctx.arc(
        (x - cameraRef.current.x) / zoom - radius * 0.2, 
        (y - cameraRef.current.y) / zoom - radius * 0.2, 
        radius * 0.4, 
        0, 
        Math.PI * 2, 
        false
      );
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
      
      // Add shadow
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10 * zoom;
      ctx.shadowOffsetX = 5 * zoom;
      ctx.shadowOffsetY = 5 * zoom;
      
      ctx.restore();
    }

    function drawFood(x, y, radius, isPoisonous) {
      const zoom = cameraRef.current.zoom;
      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.beginPath();
      ctx.arc(
        (x - cameraRef.current.x) / zoom, 
        (y - cameraRef.current.y) / zoom, 
        radius, 
        0, 
        Math.PI * 2, 
        false
      );
      
      // Create gradient for food
      const gradient = ctx.createRadialGradient(
        (x - cameraRef.current.x) / zoom, (y - cameraRef.current.y) / zoom, 0,
        (x - cameraRef.current.x) / zoom, (y - cameraRef.current.y) / zoom, radius
      );
      if (isPoisonous) {
        gradient.addColorStop(0, 'purple');
        gradient.addColorStop(1, 'red');
      } else {
        gradient.addColorStop(0, 'yellow');
        gradient.addColorStop(1, 'orange');
      }
      
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Add highlight
      ctx.beginPath();
      ctx.arc(
        (x - cameraRef.current.x) / zoom - radius * 0.3, 
        (y - cameraRef.current.y) / zoom - radius * 0.3, 
        radius * 0.2, 
        0, 
        Math.PI * 2, 
        false
      );
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
      
      // Add shadow
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 5 * zoom;
      ctx.shadowOffsetX = 2 * zoom;
      ctx.shadowOffsetY = 2 * zoom;

      ctx.restore();
    }

    socketRef.current = io('http://localhost:3001');

    socketRef.current.on('updateTimer', (time) => {
      setTimeRemaining(time);
    });
  
    socketRef.current.on('levelUp', (newLevel) => {
      setLevel(newLevel + 1);
    });

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
      // Set black background
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const currentPlayer = playersRef.current[socketRef.current.id];
      if (currentPlayer) {
        // Calculate zoom factor based on player size
        const baseRadius = 20; // Assume this is the starting radius
        const maxZoom = 2; // Maximum zoom out factor
        const zoomFactor = Math.max(1, Math.min(maxZoom, currentPlayer.radius / baseRadius));

        // Update camera
        cameraRef.current.zoom = 1 / zoomFactor;
        cameraRef.current.x = currentPlayer.x - CANVAS_WIDTH / 2;
        cameraRef.current.y = currentPlayer.y - CANVAS_HEIGHT / 2;

        // Check collision with food
        foodsRef.current.forEach(food => {
          const dx = currentPlayer.x - food.x;
          const dy = currentPlayer.y - food.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < currentPlayer.radius && currentPlayer.radius > food.radius) {
            socketRef.current.emit('eatFood', food.id);
          }
        });
      }

      // Draw grid
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1 * cameraRef.current.zoom;
      const gridSize = 100 * cameraRef.current.zoom;
      for (let x = -cameraRef.current.x % gridSize; x < CANVAS_WIDTH; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = -cameraRef.current.y % gridSize; y < CANVAS_HEIGHT; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Draw players
      Object.values(playersRef.current).forEach(player => {
        drawCircle(player.x, player.y, player.radius, player.color);
      });

      // Draw foods
      foodsRef.current.forEach(food => {
        drawFood(food.x, food.y, food.radius, food.isPoisonous);
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

  // return (
  //   <div style={{ textAlign: 'center', marginTop: '20px' }}>
  //     <h1>Circle Eater 2D - Multiplayer</h1>
  //     <p>Level: {level} | Time: {timeRemaining} | Score: {score}</p>
  //     <canvas
  //       ref={canvasRef}
  //       width={CANVAS_WIDTH}
  //       height={CANVAS_HEIGHT}
  //       style={{ border: '1px solid black' }}
  //     />
  //     {gameOver && <div style={{ marginTop: '20px', fontSize: '24px', color: 'red' }}>Game Over!</div>}
  //   </div>
  // );
  return (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f0f0f0',
    padding: '20px',
    minHeight: '100vh'
  }}>
    <h1 style={{
      color: '#333',
      marginBottom: '20px'
    }}>Circle Eater 2D - Multiplayer</h1>
    
    <div style={{
      display: 'flex',
      justifyContent: 'space-around',
      width: '100%',
      maxWidth: '800px',
      marginBottom: '20px',
      backgroundColor: '#fff',
      borderRadius: '10px',
      padding: '10px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '14px', color: '#666' }}>Level</span>
        <br />
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{level}</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '14px', color: '#666' }}>Time</span>
        <br />
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{timeRemaining}</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '14px', color: '#666' }}>Score</span>
        <br />
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{score}</span>
      </div>
    </div>
    
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        border: '2px solid #333',
        borderRadius: '5px'
      }}
    />
    
    {gameOver && (
      <div style={{
        marginTop: '20px',
        fontSize: '36px',
        fontWeight: 'bold',
        color: '#ff0000',
        textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
      }}>
        Game Over!
      </div>
    )}
  </div>
);
}

export default App;