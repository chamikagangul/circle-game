import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';
import './App.css';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

function App() {
  const canvasRef = useRef(null);
  const [wealth, setWealth] = useState(1000);
  const socketRef = useRef(null);
  const playersRef = useRef({});
  const investmentsRef = useRef([]);
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
  const [lastInvestment, setLastInvestment] = useState(null);

  console.log(playersRef?.current[socketRef?.current?.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    function drawCircle(x, y, radius, color) {
      ctx.save();

      // Begin a new path for the circle
      ctx.beginPath();

      // Draw the circle arc
      ctx.arc(
        x - cameraRef.current.x,
        y - cameraRef.current.y,
        radius,
        0,
        Math.PI * 2,
        false,
      );

      // Set the fill color to the specified color
      ctx.fillStyle = color;

      // Fill the circle with the specified color
      ctx.fill();

      // Restore the previous context state
      ctx.restore();
    }

    function drawInvestment(investment) {
     let x = investment.x
     let y=    investment.y
      let radius =   investment.radius
      let investmentName =    investment.name
      let interest =    investment.interest
      let  risk =   investment.risk

      ctx.save();
      ctx.beginPath();
      ctx.arc(
        x - cameraRef.current.x,
        y - cameraRef.current.y,
        radius,
        0,
        Math.PI * 2,
        false,
      );

      const gradient = ctx.createRadialGradient(
        x - cameraRef.current.x,
        y - cameraRef.current.y,
        0,
        x - cameraRef.current.x,
        y - cameraRef.current.y,
        radius,
      );

      // Color based on risk-reward ratio
      const riskRewardRatio = interest / risk;
      let color;
      if (riskRewardRatio > 1) {
        color = `rgb(0, ${Math.min(255, riskRewardRatio * 100)}, 0)`; // Green for good investments
      } else {
        color = `rgb(${Math.min(255, (1 / riskRewardRatio) * 100)}, 0, 0)`; // Red for risky investments
      }

      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(255,255,255,0.3)');

      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${radius}$`,
        x - cameraRef.current.x,
        y - cameraRef.current.y + 3,
      );

      ctx.restore();
      let currentPlayer = playersRef.current[socketRef.current.id];
      const thresholdDistance = 100;
      const distance = Math.sqrt(
        Math.pow(x - currentPlayer.x, 2) + Math.pow(y - currentPlayer.y, 2)
    );
      // show popup with investment details
      if (distance <= thresholdDistance) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      let name  = `Investment: ${investmentName}`
      const textWidth = ctx.measureText(name).width;
      const rectWidth = textWidth + 20;
      ctx.fillRect(x - cameraRef.current.x - rectWidth / 2, y - cameraRef.current.y - 60, rectWidth, 50);

      ctx.fillStyle = 'black'; 
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(name, x - cameraRef.current.x, y - cameraRef.current.y - 45);
      ctx.fillText(`Interest: ${interest}%`, x - cameraRef.current.x, y - cameraRef.current.y - 30);
      ctx.fillText(`Risk: ${risk}%`, x - cameraRef.current.x, y - cameraRef.current.y - 15);
      }
    }

    console.log('Connecting to server... : ', process.env.REACT_APP_SOCKET_URL);
    socketRef.current = io(process.env.REACT_APP_SOCKET_URL);

    socketRef.current.on('updateTimer', (time) => {
      setTimeRemaining(time);
    });

    socketRef.current.on('levelUp', (newLevel) => {
      setLevel(newLevel + 1);
    });

    socketRef.current.on('initGame', ({ players, investments, worldSize }) => {
      playersRef.current = players;
      investmentsRef.current = investments;
      worldSizeRef.current = worldSize;
    });

    socketRef.current.on('newPlayer', (player) => {
      playersRef.current[player.id] = player;
    });

    socketRef.current.on('updatePlayers', (players) => {
      playersRef.current = players;
    });

    socketRef.current.on('updateInvestments', (investments) => {
      investmentsRef.current = investments;
    });

    socketRef.current.on(
      'investmentMade',
      ({
        playerId,
        investmentId,
        newWealth,
        newRadius,
        investmentName,
        outcome,
      }) => {
        if (playersRef.current[playerId]) {
          playersRef.current[playerId].wealth = newWealth;
          playersRef.current[playerId].radius = newRadius;
        }
        if (playerId === socketRef.current.id) {
          setWealth(newWealth);
          setLastInvestment({ name: investmentName, outcome });
        }
      },
    );

    socketRef.current.on('gameOver', () => {
      setGameOver(true);
    });

    socketRef.current.on('playerDisconnected', (playerId) => {
      delete playersRef.current[playerId];
    });

    function update() {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const currentPlayer = playersRef.current[socketRef.current.id];
      if (currentPlayer) {
        cameraRef.current.x = currentPlayer.x - CANVAS_WIDTH / 2;
        cameraRef.current.y = currentPlayer.y - CANVAS_HEIGHT / 2;

        investmentsRef.current.forEach((investment) => {
          const dx = currentPlayer.x - investment.x;
          const dy = currentPlayer.y - investment.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (
            distance < currentPlayer.radius &&
            currentPlayer.radius > investment.radius
          ) {
            socketRef.current.emit('makeInvestment', investment.id);
          }
          // if (distance < currentPlayer.radius + investment.radius) {
          //   socketRef.current.emit('makeInvestment', investment.id);
          // }
        });
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      const gridSize = 100;
      for (
        let x = -cameraRef.current.x % gridSize;
        x < CANVAS_WIDTH;
        x += gridSize
      ) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (
        let y = -cameraRef.current.y % gridSize;
        y < CANVAS_HEIGHT;
        y += gridSize
      ) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      Object.values(playersRef.current).forEach((player) => {
        drawCircle(player.x, player.y, player.radius, player.color);
      });

      investmentsRef.current.forEach((investment) => {
        drawInvestment(
          investment
        );
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

    const movementInterval = setInterval(emitMovement, 1000 / 60);

    return () => {
      socketRef.current.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
      clearInterval(movementInterval);
    };
  }, []);

	const handleButtonPress = (direction) => {
		keysPressed.current[direction] = true;

	};

	const handleButtonRelease = (direction) => {
		keysPressed.current[direction] = false;

	};

  return (
    <div className="game-container">
      <h1 className="game-title">Financial Investment Simulator</h1>

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
          <span className="stat-label">Wealth</span>
          <br />
          <span className="stat-value">${wealth.toFixed(2)}</span>
        </div>
      </div>
      {lastInvestment && (
        <div className="last-investment">
          <p>Last Investment Outcome: ${lastInvestment.outcome.toFixed(2)}</p>
        </div>
      )}
      {gameOver && (
        <div className="game-over">
          <h2>Game Over!</h2>
          <p>Final Wealth: ${wealth.toFixed(2)}</p>
        </div>
      )}
		<div className="wrapper"  style={{position: 'relative'}}>
      {!gameOver && <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="game-canvas"
      />}


			<div className="controls">
        <div className="control-col">

				<button 
            onMouseDown={() => handleButtonPress('left')}
            onMouseUp={() => handleButtonRelease('left')}
            onTouchStart={() => handleButtonPress('left')}
            onTouchEnd={() => handleButtonRelease('left')}
          >
            Left
          </button>
          
        </div>
        <div className="control-col">
				<button 
            onMouseDown={() => handleButtonPress('up')}
            onMouseUp={() => handleButtonRelease('up')}
            onTouchStart={() => handleButtonPress('up')}
            onTouchEnd={() => handleButtonRelease('up')}
          >
            Up
          </button>
					<button 
            onMouseDown={() => handleButtonPress('down')}
            onMouseUp={() => handleButtonRelease('down')}
            onTouchStart={() => handleButtonPress('down')}
            onTouchEnd={() => handleButtonRelease('down')}
          >
            Down
          </button>
          
          
        </div>
        <div className="control-col">
				<button 
            onMouseDown={() => handleButtonPress('right')}
            onMouseUp={() => handleButtonRelease('right')}
            onTouchStart={() => handleButtonPress('right')}
            onTouchEnd={() => handleButtonRelease('right')}
          >
            Right
          </button>
        </div>
				</div>
      </div>
    </div>
  );
}

export default App;
