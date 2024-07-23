const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Define world size
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

let players = {};
let foods = [];

function spawnFood() {
  if (foods.length < 20) {
    foods.push({
      id: Date.now(),
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      radius: Math.random() * 5 + 5,
    });
  }
}

function checkCollision(player1, player2) {
  const dx = player1.x - player2.x;
  const dy = player1.y - player2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < Math.max(player1.radius, player2.radius);
}

io.on('connection', (socket) => {
  console.log('New client connected');

  // Create a new player
  players[socket.id] = {
    id: socket.id,
    x: Math.random() * CANVAS_WIDTH,
    y: Math.random() * CANVAS_HEIGHT,
    radius: 20,
    color: `hsl(${Math.random() * 360}, 100%, 50%)`
  };

  // Send initial game state to the new player
  socket.emit('initGame', { players, foods });

  // Broadcast new player to all other players
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('updatePosition', (movement) => {
    if (players[socket.id]) {
      const speed = 5;
      if (movement.up) players[socket.id].y -= speed;
      if (movement.down) players[socket.id].y += speed;
      if (movement.left) players[socket.id].x -= speed;
      if (movement.right) players[socket.id].x += speed;

      // Keep player within world bounds
      players[socket.id].x = Math.max(0, Math.min(players[socket.id].x, WORLD_WIDTH));
      players[socket.id].y = Math.max(0, Math.min(players[socket.id].y, WORLD_HEIGHT));

      // Check for player collisions
      Object.values(players).forEach(otherPlayer => {
        if (otherPlayer.id !== socket.id && checkCollision(players[socket.id], otherPlayer)) {
          if (players[socket.id].radius > otherPlayer.radius * 1.1) { // 10% size advantage needed to eat
            players[socket.id].radius = Math.sqrt(players[socket.id].radius ** 2 + otherPlayer.radius ** 2);
            io.emit('playerEaten', { eaterId: socket.id, eatenId: otherPlayer.id, newRadius: players[socket.id].radius });
            io.to(otherPlayer.id).emit('gameOver');
            delete players[otherPlayer.id];
          }
        }
      });

      io.emit('updatePlayers', players);
    }
  });

  socket.on('eatFood', (foodId) => {
    const foodIndex = foods.findIndex(food => food.id === foodId);
    if (foodIndex !== -1) {
      const eatenFood = foods[foodIndex];
      players[socket.id].radius += eatenFood.radius * 0.1;
      foods.splice(foodIndex, 1);
      io.emit('foodEaten', { playerId: socket.id, foodId, newRadius: players[socket.id].radius });
      spawnFood();
      io.emit('updateFoods', foods);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

setInterval(() => {
  spawnFood();
  io.emit('updateFoods', foods);
}, 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));