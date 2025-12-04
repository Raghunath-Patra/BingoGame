const { createServer } = require("http");
const { Server } = require('socket.io');

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "https://bingogame-frontend.onrender.com",
    //origin: "http://localhost:5173",
  },
  // Optimizations for slow connections
  pingTimeout: 30000, // Increased from default 5000ms
  pingInterval: 10000, // Increased from default 2500ms
  upgradeTimeout: 20000, // Increased from default 10000ms
  maxHttpBufferSize: 1e6, // 1MB buffer
  transports: ['websocket', 'polling'], // Support both transports
  allowEIO3: true, // Backward compatibility
  cookie: false,
  serveClient: false,
});

const allUsers = {};
const allRooms = {};

// Helper function to safely emit with error handling
const safeEmit = (socket, event, data, callback) => {
  try {
    if (socket && socket.connected) {
      socket.emit(event, data, callback);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error emitting ${event}:`, error);
    return false;
  }
};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  allUsers[socket.id] = {
    socket: socket,
    online: true,
    playerName: null,
    roomId: null,
    playing: false,
    lastActivity: Date.now(),
  };

  // Heartbeat mechanism
  socket.on('heartbeat', () => {
    if (allUsers[socket.id]) {
      allUsers[socket.id].lastActivity = Date.now();
    }
  });

  socket.on("request_to_play", (data) => {
    const currentUser = allUsers[socket.id];
    if (!currentUser) return;

    currentUser.playerName = data.playerName;
    currentUser.lastActivity = Date.now();

    let opponentPlayer = null;

    for (const key in allUsers) {
      const user = allUsers[key];
      if (user.online && !user.playing && socket.id !== key) {
        opponentPlayer = user;
        break;
      }
    }

    if (opponentPlayer) {
      const roomId = `${socket.id}-${opponentPlayer.socket.id}`;
      allRooms[roomId] = {
        player1: currentUser,
        player2: opponentPlayer,
        ready: 0,
        countReady: 0,
        readyAgain: 0,
        score1: 0,
        score2: 0,
        lastActivity: Date.now(),
      };
      currentUser.roomId = roomId;
      currentUser.playing = true;
      opponentPlayer.roomId = roomId;
      opponentPlayer.playing = true;

      safeEmit(currentUser.socket, "OpponentFound", {
        opponentName: opponentPlayer.playerName,
        playingAs: "player2",
      });

      safeEmit(opponentPlayer.socket, "OpponentFound", {
        opponentName: currentUser.playerName,
        playingAs: "player1",
      });
    } else {
      safeEmit(currentUser.socket, "OpponentNotFound");
    }
  });

  socket.on("start_to_play", () => {
    const currentUser = allUsers[socket.id];
    if (!currentUser) return;

    const room = allRooms[currentUser.roomId];

    if (room) {
      room.ready += 1;
      room.lastActivity = Date.now();

      if (room.ready === 2) {
        room.ready = 0;
        safeEmit(room.player1.socket, "opponent-ready");
        safeEmit(room.player2.socket, "opponent-ready");
      }
    }
  });

  socket.on("playerMoveFromClient", (data) => {
    const currentUser = allUsers[socket.id];
    if (!currentUser) return;

    const room = allRooms[currentUser.roomId];

    if (room) {
      room.lastActivity = Date.now();
      const opponent = room.player1.socket.id === socket.id ? room.player2 : room.player1;
      
      // Send acknowledgment back to sender
      safeEmit(socket, "moveAcknowledged", { success: true });
      
      // Forward move to opponent
      safeEmit(opponent.socket, "playerMoveFromServer", data);
    } else {
      console.log("Room not found for user:", currentUser.roomId);
      safeEmit(socket, "moveAcknowledged", { success: false, error: "Room not found" });
    }
  });

  socket.on("CheckWinner", (data) => {
    const currentUser = allUsers[socket.id];
    if (!currentUser) return;

    const room = allRooms[currentUser.roomId];

    if (room) {
        room.lastActivity = Date.now();
        
        // Update the player's score based on who emitted the event
        if (room.player1.socket.id === socket.id) {
            room.score1 = data.count;
            room.player1Ready = true;
        } else if (room.player2.socket.id === socket.id) {
            room.score2 = data.count;
            room.player2Ready = true;
        }

        // Proceed if both players are ready
        if (room.player1Ready && room.player2Ready) {
            const player1Score = room.score1;
            const player2Score = room.score2;

            let winner;

            if (player1Score >= 5 && player1Score > player2Score) {
                winner = room.player1.playerName;
                safeEmit(room.player1.socket, "WinnerDeclared", {
                    winner: room.player1.playerName,
                    opponentScore: player2Score,
                });
                safeEmit(room.player2.socket, "WinnerDeclared", {
                    winner: room.player1.playerName,
                    opponentScore: player1Score,
                });
            } else if (player2Score >= 5 && player2Score > player1Score) {
                winner = room.player2.playerName;
                safeEmit(room.player1.socket, "WinnerDeclared", {
                    winner: room.player2.playerName,
                    opponentScore: player2Score,
                });
                safeEmit(room.player2.socket, "WinnerDeclared", {
                    winner: room.player2.playerName,
                    opponentScore: player1Score,
                });
            } else if (player1Score >= 5 && player1Score === player2Score) {
                winner = 'none';
                safeEmit(room.player1.socket, "WinnerDeclared", {
                    winner: 'none',
                    opponentScore: player2Score,
                });
                safeEmit(room.player2.socket, "WinnerDeclared", {
                    winner: 'none',
                    opponentScore: player1Score,
                });
            }

            // Reset the readiness state for the next round
            room.player1Ready = false;
            room.player2Ready = false;
        }
    }
  });

  socket.on("PlayAgain", () => {
    const currentUser = allUsers[socket.id];
    if (!currentUser) return;

    const room = allRooms[currentUser.roomId];

    if (room) {
      room.readyAgain += 1;
      room.lastActivity = Date.now();
      
      if (room.readyAgain === 1) {
        const opponent = room.player1.socket.id === socket.id ? room.player2 : room.player1;
        safeEmit(opponent.socket, "oppoWantToPlayAgain");
      } else if (room.readyAgain === 2) {
        room.readyAgain = 0;
        room.score2 = 0;
        room.score1 = 0;
        safeEmit(room.player1.socket, "opponent-ready-again");
        safeEmit(room.player2.socket, "opponent-ready-again");
      }
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
    
    const currentUser = allUsers[socket.id];
    if (!currentUser) return;

    currentUser.online = false;

    if (currentUser.roomId) {
      const room = allRooms[currentUser.roomId];
      if (room) {
        const opponent = room.player1.socket.id === socket.id ? room.player2 : room.player1;
        
        // Only notify opponent if they're still connected
        if (opponent && opponent.socket && opponent.socket.connected) {
          safeEmit(opponent.socket, "opponentLeftMatch");
        }
        
        delete allRooms[currentUser.roomId];
      }
    }

    delete allUsers[socket.id];
  });

  // Handle connection errors
  socket.on("error", (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Periodic cleanup of stale rooms and users
setInterval(() => {
  const now = Date.now();
  const STALE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  // Clean up stale users
  for (const userId in allUsers) {
    const user = allUsers[userId];
    if (!user.online && (now - user.lastActivity) > STALE_TIMEOUT) {
      delete allUsers[userId];
    }
  }

  // Clean up stale rooms
  for (const roomId in allRooms) {
    const room = allRooms[roomId];
    if ((now - room.lastActivity) > STALE_TIMEOUT) {
      delete allRooms[roomId];
    }
  }
}, 60000); // Run every minute

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

httpServer.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
