const { createServer } = require("http");
const { Server } = require('socket.io');

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "https://bingogame-frontend.onrender.com",
    //origin: "http://localhost:5173",
  },
});

// Use Maps for better performance
const allUsers = new Map();
const allRooms = new Map();

// Helper function to find available opponent
const findAvailableOpponent = (currentSocketId) => {
  for (const [socketId, user] of allUsers) {
    if (user.online && !user.playing && socketId !== currentSocketId) {
      return user;
    }
  }
  return null;
};

// Helper function to clean up user resources
const cleanupUser = (socketId) => {
  const user = allUsers.get(socketId);
  if (!user) return;

  if (user.roomId) {
    const room = allRooms.get(user.roomId);
    if (room) {
      // Notify opponent
      const opponent = room.player1.socket.id === socketId ? room.player2 : room.player1;
      if (opponent && opponent.socket) {
        opponent.socket.emit("opponentLeftMatch");
        // Reset opponent's playing status
        opponent.playing = false;
        opponent.roomId = null;
      }
      // Remove room
      allRooms.delete(user.roomId);
    }
  }
  
  // Remove user
  allUsers.delete(socketId);
};

// Helper function to create room ID
const createRoomId = (id1, id2) => `${id1}-${id2}`;

io.on("connection", (socket) => {
  // Add user to active users
  allUsers.set(socket.id, {
    socket: socket,
    online: true,
    playerName: null,
    roomId: null,
    playing: false,
  });

  socket.on("request_to_play", (data) => {
    const currentUser = allUsers.get(socket.id);
    if (!currentUser) return;

    currentUser.playerName = data.playerName;

    const opponentPlayer = findAvailableOpponent(socket.id);

    if (opponentPlayer) {
      const roomId = createRoomId(socket.id, opponentPlayer.socket.id);
      
      // Create room with optimized structure
      const room = {
        player1: currentUser,
        player2: opponentPlayer,
        ready: 0,
        countReady: 0,
        readyAgain: 0,
        score1: 0,
        score2: 0,
        player1Ready: false,
        player2Ready: false,
      };

      allRooms.set(roomId, room);

      // Update user states
      currentUser.roomId = roomId;
      currentUser.playing = true;
      opponentPlayer.roomId = roomId;
      opponentPlayer.playing = true;

      // Emit events
      currentUser.socket.emit("OpponentFound", {
        opponentName: opponentPlayer.playerName,
        playingAs: "player2",
      });

      opponentPlayer.socket.emit("OpponentFound", {
        opponentName: currentUser.playerName,
        playingAs: "player1",
      });
    } else {
      socket.emit("OpponentNotFound");
    }
  });

  socket.on("start_to_play", () => {
    const currentUser = allUsers.get(socket.id);
    if (!currentUser?.roomId) return;

    const room = allRooms.get(currentUser.roomId);
    if (!room) return;

    room.ready += 1;

    if (room.ready === 2) {
      room.ready = 0;
      // Use optional chaining for safety
      room.player1.socket?.emit("opponent-ready");
      room.player2.socket?.emit("opponent-ready");
    }
  });

  socket.on("playerMoveFromClient", (data) => {
    const currentUser = allUsers.get(socket.id);
    if (!currentUser?.roomId || !data?.num) return;

    const room = allRooms.get(currentUser.roomId);
    if (!room) return;

    const opponent = room.player1.socket.id === socket.id ? room.player2 : room.player1;
    opponent.socket?.emit("playerMoveFromServer", data);
  });

  socket.on("CheckWinner", (data) => {
    const currentUser = allUsers.get(socket.id);
    if (!currentUser?.roomId || typeof data?.count !== 'number') return;

    const room = allRooms.get(currentUser.roomId);
    if (!room) return;

    // Update scores and ready state atomically
    if (room.player1.socket.id === socket.id) {
      room.score1 = data.count;
      room.player1Ready = true;
    } else if (room.player2.socket.id === socket.id) {
      room.score2 = data.count;
      room.player2Ready = true;
    }

    // Check if both players are ready
    if (room.player1Ready && room.player2Ready) {
      const { score1, score2 } = room;
      let winner;

      // Determine winner
      if (score1 >= 5 && score1 > score2) {
        winner = room.player1.playerName;
      } else if (score2 >= 5 && score2 > score1) {
        winner = room.player2.playerName;
      } else if (score1 >= 5 && score1 === score2) {
        winner = 'none';
      }

      // Emit results if there's a winner
      if (winner !== undefined) {
        const winnerData1 = {
          winner: winner,
          opponentScore: score2,
        };
        const winnerData2 = {
          winner: winner,
          opponentScore: score1,
        };

        room.player1.socket?.emit("WinnerDeclared", winnerData1);
        room.player2.socket?.emit("WinnerDeclared", winnerData2);
      }

      // Reset ready states
      room.player1Ready = false;
      room.player2Ready = false;
    }
  });

  socket.on("PlayAgain", () => {
    const currentUser = allUsers.get(socket.id);
    if (!currentUser?.roomId) return;

    const room = allRooms.get(currentUser.roomId);
    if (!room) return;

    room.readyAgain += 1;

    if (room.readyAgain === 1) {
      const opponent = room.player1.socket.id === socket.id ? room.player2 : room.player1;
      opponent.socket?.emit("oppoWantToPlayAgain");
    } else if (room.readyAgain === 2) {
      // Reset room state for new game
      room.readyAgain = 0;
      room.score1 = 0;
      room.score2 = 0;
      room.player1Ready = false;
      room.player2Ready = false;
      
      room.player1.socket?.emit("opponent-ready-again");
      room.player2.socket?.emit("opponent-ready-again");
    }
  });

  socket.on("disconnect", () => {
    cleanupUser(socket.id);
  });

  // Handle explicit disconnect requests
  socket.on("disconnect", () => {
    cleanupUser(socket.id);
  });
});

// Periodic cleanup of stale connections (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [socketId, user] of allUsers) {
    // Check if socket is still connected
    if (!user.socket.connected) {
      cleanupUser(socketId);
    }
  }
}, 5 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  allUsers.clear();
  allRooms.clear();
  httpServer.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  allUsers.clear();
  allRooms.clear();
  httpServer.close(() => {
    process.exit(0);
  });
});

httpServer.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});