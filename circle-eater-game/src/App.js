import React, { useRef, useEffect, useState, useCallback } from "react";
import io from "socket.io-client";
import "./App.css";

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
  const keysPressed = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const [level, setLevel] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  const updateDimensions = useCallback(() => {
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight
    });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		let animationFrameId;

		function drawCircle(x, y, radius, color) {
      const screenX = x - cameraRef.current.x;
      const screenY = y - cameraRef.current.y;
    
      // Only draw if the circle is within or partially within the screen
      // if (
      //   screenX + radius > 0 &&
      //   screenX - radius < dimensions.width &&
      //   screenY + radius > 0 &&
      //   screenY - radius < dimensions.height
      // ) {

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2, false);
    
			// Create gradient
			const gradient = ctx.createRadialGradient(
        x, y, 0,
        x, y, radius
      );
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(0,0,0,0.3)");
      ctx.fillStyle = gradient;
      ctx.fill();

			// Add highlight
			ctx.beginPath();
      ctx.arc(x - radius * 0.2, y - radius * 0.2, radius * 0.4, 0, Math.PI * 2, false);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fill();

			// Add shadow
			ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;

      ctx.restore();
    }
  

		function drawFood(x, y, radius, isPoisonous) {
      const screenX = x - cameraRef.current.x;
      const screenY = y - cameraRef.current.y;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2, false);

			// Create gradient for food
      const gradient = ctx.createRadialGradient(
        x, y, 0,
        x, y, radius
      );
      if (isPoisonous) {
        gradient.addColorStop(0, "purple");
        gradient.addColorStop(1, "red");
      } else {
        gradient.addColorStop(0, "yellow");
        gradient.addColorStop(1, "orange");
      }

			ctx.fillStyle = gradient;
			ctx.fill();

			// Add highlight
			ctx.beginPath();
      ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.2, 0, Math.PI * 2, false);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fill();

      // Add shadow
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

			ctx.restore();
		}

		socketRef.current = io("http://localhost:3001");

		socketRef.current.on("updateTimer", (time) => {
			setTimeRemaining(time);
		});

		socketRef.current.on("levelUp", (newLevel) => {
			setLevel(newLevel + 1);
		});

		socketRef.current.on("initGame", ({ players, foods, worldSize }) => {
      console.log("Received initial game state:", { players, foods, worldSize });
			playersRef.current = players;
			foodsRef.current = foods;
			worldSizeRef.current = worldSize;
		});

		socketRef.current.on("newPlayer", (player) => {
			playersRef.current[player.id] = player;
		});

		socketRef.current.on("updatePlayers", (players) => {
			playersRef.current = players;
		});

		socketRef.current.on("updateFoods", (foods) => {
			foodsRef.current = foods;
		});

		socketRef.current.on("foodEaten", ({ playerId, foodId, newRadius }) => {
			if (playersRef.current[playerId]) {
				playersRef.current[playerId].radius = newRadius;
			}
			if (playerId === socketRef.current.id) {
				setScore((prevScore) => prevScore + 1);
			}
		});

		socketRef.current.on("playerEaten", ({ eaterId, eatenId, newRadius }) => {
			if (playersRef.current[eaterId]) {
				playersRef.current[eaterId].radius = newRadius;
			}
			delete playersRef.current[eatenId];
			if (eatenId === socketRef.current.id) {
				setGameOver(true);
			}
		});

		socketRef.current.on("gameOver", () => {
			setGameOver(true);
		});

		socketRef.current.on("playerDisconnected", (playerId) => {
			delete playersRef.current[playerId];
		});

		socketRef.current.on("restartGame", () => {
			setGameOver(false);
			setScore(0);
			setTimeRemaining(60);
			setLevel(1);
		});



		function drawCircle(x, y, radius, color) {
			ctx.beginPath();
			ctx.arc(
				x - cameraRef.current.x,
				y - cameraRef.current.y,
				radius,
				0,
				Math.PI * 2,
				false
			);
			ctx.fillStyle = color;
			ctx.fill();
			ctx.closePath();
		}

    socketRef.current.emit('canvasSize', dimensions);

		function update() {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

			const currentPlayer = playersRef.current[socketRef.current.id];
      console.log("Current player:", currentPlayer);
      console.log("All players:", playersRef.current);
      
			if (currentPlayer) {
        // Update camera position to center the player
        cameraRef.current.x = Math.max(0, Math.min(currentPlayer.x - dimensions.width / 2, worldSizeRef.current.width - dimensions.width));
        cameraRef.current.y = Math.max(0, Math.min(currentPlayer.y - dimensions.height / 2, worldSizeRef.current.height - dimensions.height));
    
        console.log("Camera position:", cameraRef.current);
      
				// Check collision with food
				foodsRef.current.forEach((food) => {
					const dx = currentPlayer.x - food.x;
					const dy = currentPlayer.y - food.y;
					const distance = Math.sqrt(dx * dx + dy * dy);
					if (
						distance < currentPlayer.radius &&
						currentPlayer.radius > food.radius
					) {
						socketRef.current.emit("eatFood", food.id);
					}
				});
			}

			// Draw grid
			ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      const gridSize = 100;
      const offsetX = -cameraRef.current.x % gridSize;
      const offsetY = -cameraRef.current.y % gridSize;
      
      for (let x = offsetX; x < dimensions.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, dimensions.height);
        ctx.stroke();
      }
      for (let y = offsetY; y < dimensions.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.width, y);
        ctx.stroke();
      }

			// Draw players
			Object.values(playersRef.current).forEach((player) => {
        drawCircle(player.x, player.y, player.radius, player.color);
        console.log("Drawing player:", player);
      });

			// Draw foods
			foodsRef.current.forEach((food) => {
        drawFood(
          food.x - cameraRef.current.x,
          food.y - cameraRef.current.y,
          food.radius,
          food.isPoisonous
        );
      });

			animationFrameId = requestAnimationFrame(update);
		}

		update();

		function handleKeyDown(e) {
			if (gameOver) return;
			if (e.key === "ArrowUp") keysPressed.current.up = true;
			if (e.key === "ArrowDown") keysPressed.current.down = true;
			if (e.key === "ArrowLeft") keysPressed.current.left = true;
			if (e.key === "ArrowRight") keysPressed.current.right = true;
		}

		function handleKeyUp(e) {
			if (gameOver) return;
			if (e.key === "ArrowUp") keysPressed.current.up = false;
			if (e.key === "ArrowDown") keysPressed.current.down = false;
			if (e.key === "ArrowLeft") keysPressed.current.left = false;
			if (e.key === "ArrowRight") keysPressed.current.right = false;
		}

    function handleTouchStart(e) {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      keysPressed.current.up = y < dimensions.height / 2;
      keysPressed.current.down = y >= dimensions.height / 2;
      keysPressed.current.left = x < dimensions.width / 2;
      keysPressed.current.right = x >= dimensions.width / 2;
    }

    function handleTouchEnd() {
      keysPressed.current = { up: false, down: false, left: false, right: false };
    }

		window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("touchmove", handleTouchStart);
    canvas.addEventListener("touchend", handleTouchEnd);

		function emitMovement() {
      socketRef.current.emit("updatePosition", keysPressed.current);
    }

    const movementInterval = setInterval(emitMovement, 1000 / 60);

		return () => {
      socketRef.current.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(animationFrameId);
      clearInterval(movementInterval);
    };
  }, [gameOver, dimensions]);

  function restartGame() {
    socketRef.current.emit("restartGame");
  }

	return (
		<div className="game-container">
			<h1 className="game-title">Circle Eater 2D - Multiplayer</h1>

			<div className="game-stats">
				<div className="stat-container">
					<span className="stat-label">Level</span>
					<br />
					<span className="stat-value">{level}</span>
				</div>
				<div className="stat-container">
					<span className="stat-label">Time</span>
					<br />
					<span className="stat-value">{timeRemaining}</span>
				</div>
				<div className="stat-container">
					<span className="stat-label">Score</span>
					<br />
					<span className="stat-value">{score}</span>
				</div>
			</div>

			<canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="game-canvas"
      />

			{gameOver && (
				<div>
					<div className="game-over">Game Over!</div>
					<button onClick={() => restartGame()} className="restart-button">
						Restart Game
					</button>
				</div>
			)}
		</div>
	);
}

export default App;
