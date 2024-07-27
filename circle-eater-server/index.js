const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Define world size
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;
const MINIMUM_INVESTMENT_RADIUS = 15;

const LEVELS = [
  { duration: 60, investmentCount: 300 },
  { duration: 90, investmentCount: 400 },
  { duration: 120, investmentCount: 500 },
];

let currentLevel = 0;
let gameTimer = null;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

let players = {};
let investments = [];

const INVESTMENT_OPTIONS = [
  { name: 'Invest in Gold', interest: 4, risk: 0.5 },
  { name: 'High-Yield Savings', interest: 2, risk: 0.1 },
  { name: 'Index Fund', interest: 7, risk: 5 },
  { name: 'Real Estate', interest: 10, risk: 8 },
  { name: 'New Crypto', interest: 20, risk: 40 },
  { name: 'Penny Stocks', interest: 15, risk: 30 },
  { name: 'Start-up Investment', interest: 25, risk: 50 },
  { name: 'Government Bonds', interest: 3, risk: 0.2 },
  { name: 'Blue Chip Stocks', interest: 8, risk: 4 },
  { name: 'Commodities', interest: 6, risk: 7 },
  { name: 'Corporate Bonds', interest: 5, risk: 1.5 },
  { name: 'Emerging Market Stocks', interest: 12, risk: 15 },
  { name: 'REITs', interest: 9, risk: 6 },
  { name: 'Private Equity', interest: 18, risk: 25 },
  { name: 'Venture Capital', interest: 30, risk: 60 },
  { name: 'Municipal Bonds', interest: 2.5, risk: 0.3 },
  { name: 'Annuities', interest: 4, risk: 1 },
  { name: 'Hedge Funds', interest: 12, risk: 20 },
  { name: 'Peer-to-Peer Lending', interest: 10, risk: 12 },
  { name: 'Forex Trading', interest: 25, risk: 50 },
  { name: 'Cryptocurrency Staking', interest: 8, risk: 35 },
  { name: 'Art Investment', interest: 10, risk: 10 },
  { name: 'Wine Investment', interest: 7, risk: 7 },
  { name: 'Antique Cars', interest: 5, risk: 9 },
  { name: 'Precious Metals', interest: 3.5, risk: 2 },
  { name: 'Sovereign Wealth Funds', interest: 5, risk: 1.2 },
  { name: 'Dividend Stocks', interest: 6, risk: 3 },
  { name: 'Convertible Bonds', interest: 7, risk: 4 },
  { name: 'Infrastructure Funds', interest: 8, risk: 5 },
  { name: 'Green Energy Funds', interest: 9, risk: 8 },
  { name: 'Agri-business', interest: 6, risk: 10 },
  { name: 'Timberland', interest: 5, risk: 3 },
  { name: 'Farmland', interest: 6, risk: 2.5 },
  { name: 'Distressed Debt', interest: 14, risk: 20 },
  { name: 'Luxury Goods', interest: 5, risk: 6 },
  { name: 'Music Royalties', interest: 8, risk: 4.5 },
  { name: 'Film Production', interest: 20, risk: 35 },
  { name: 'Sports Team Ownership', interest: 12, risk: 18 },
  { name: 'Maritime Shipping', interest: 7, risk: 10 },
  { name: 'Renewable Energy Projects', interest: 10, risk: 12 },
  { name: 'Blockchain Projects', interest: 15, risk: 25 },
  { name: 'AI Start-ups', interest: 30, risk: 55 },
  { name: 'Biotech Companies', interest: 18, risk: 30 },
  { name: 'Cloud Computing Services', interest: 12, risk: 15 },
  { name: 'Space Exploration', interest: 25, risk: 45 },
  { name: 'Water Rights', interest: 8, risk: 5 },
  { name: 'Telecommunication Infrastructure', interest: 9, risk: 6 },
  { name: 'Health Care Facilities', interest: 7, risk: 4 },
  { name: 'E-commerce Platforms', interest: 12, risk: 14 },
  { name: 'Logistics Companies', interest: 8, risk: 7 },
  { name: 'Consumer Electronics', interest: 10, risk: 8 },
];


function spawnInvestments() {
  const level = LEVELS[currentLevel];
  while (investments.length < level.investmentCount) {
    const option =
      INVESTMENT_OPTIONS[Math.floor(Math.random() * INVESTMENT_OPTIONS.length)];
    investments.push({
      id: Date.now() + Math.random(),
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
      radius: Math.round(Math.max(Math.random() * 50, MINIMUM_INVESTMENT_RADIUS), 0),
      ...option,
    });
  }
}

function startGameTimer(socket) {
  const level = LEVELS[currentLevel];
  let timeRemaining = level.duration;

  gameTimer = setInterval(() => {
    console.log('Time remaining:', timeRemaining);
    timeRemaining--;
    io.emit('updateTimer', timeRemaining);

    if (timeRemaining <= 0) {
      clearInterval(gameTimer);
      if (currentLevel < LEVELS.length - 1) {
        currentLevel++;
        io.emit('levelUp', currentLevel);
        startGameTimer(socket);
      } else {
        io.emit('gameOver');
      }
    }
  }, 1000);
}

function checkCollision(player1, player2) {
  const dx = player1.x - player2.x;
  const dy = player1.y - player2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < Math.max(player1.radius, player2.radius);
}


io.on('connection', (socket) => {
  console.log('New client connected');
  if (Object.keys(players).length === 2) {
    startGameTimer(socket);
  }

  players[socket.id] = {
    id: socket.id,
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT,
    radius: MINIMUM_INVESTMENT_RADIUS+10,
    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
    wealth: 1000,
  };

  socket.emit('initGame', { players, investments });
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('updatePosition', (movement) => {
    if (players[socket.id]) {
      const speed = 5;
      if (movement.up) players[socket.id].y -= speed;
      if (movement.down) players[socket.id].y += speed;
      if (movement.left) players[socket.id].x -= speed;
      if (movement.right) players[socket.id].x += speed;

      players[socket.id].x = Math.max(
        0,
        Math.min(players[socket.id].x, WORLD_WIDTH),
      );
      players[socket.id].y = Math.max(
        0,
        Math.min(players[socket.id].y, WORLD_HEIGHT),
      );

      // Update player radius based on wealth
      // players[socket.id].radius = calculatePlayerRadius(players[socket.id]);

      io.emit('updatePlayers', players);
    }
  });

  socket.on('makeInvestment', (investmentId) => {
    const investmentIndex = investments.findIndex(
      (inv) => inv.id === investmentId,
    );
    if (investmentIndex !== -1) {
      const investment = investments[investmentIndex];
      const player = players[socket.id];

      // Calculate investment outcome
      const successChance = Math.random() * 100;
      const investmentAmount = investment.radius;
      let outcomeAmount;

      if (successChance > investment.risk) {
        // Investment succeeds
        outcomeAmount = investmentAmount * (1 + investment.interest / 100);
      } else {
        // Investment fails
        outcomeAmount = investmentAmount * (1 - investment.risk / 100);
      }

      player.wealth += outcomeAmount - investmentAmount;
      const newPlayerRadius = player.radius + (outcomeAmount - investmentAmount)

      // Check if wealth is negative
      if (player.wealth <= 0 || newPlayerRadius <= MINIMUM_INVESTMENT_RADIUS) {
        io.to(socket.id).emit('gameOver');
        // delete players[socket.id];
        // io.emit('playerDisconnected', socket.id);
      } else {
        // Update player radius based on new wealth
        player.radius = newPlayerRadius
      }

      investments.splice(investmentIndex, 1);
      io.emit('investmentMade', {
        playerId: socket.id,
        investmentId,
        newWealth: player.wealth,
        newRadius: player.radius,
        investmentName: investment.name,
        outcome: outcomeAmount - investmentAmount,
      });
      spawnInvestments();
      io.emit('updateInvestments', investments);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

setInterval(() => {
  spawnInvestments();
  io.emit('updateInvestments', investments);
}, 1000);

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
