const { createServer } = require("http");
const { Server } = require('socket.io');

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "https://bingogame-frontend.onrender.com",
    //origin: "http://localhost:5173",
  },
});

const allUsers = {};
const allRooms = {};

io.on("connection", (socket) => {
  allUsers[socket.id] = {
    socket: socket,
    online: true,
    playerName: null,
    roomId: null,
    playing: false,
  };

  socket.on("request_to_play", (data) => {
    const currentUser = allUsers[socket.id];
    currentUser.playerName = data.playerName;

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
      };
      currentUser.roomId = roomId;
      currentUser.playing = true;
      opponentPlayer.roomId = roomId;
      opponentPlayer.playing = true;

      currentUser.socket.emit("OpponentFound", {
        opponentName: opponentPlayer.playerName,
        playingAs: "player2",
      });

      opponentPlayer.socket.emit("OpponentFound", {
        opponentName: currentUser.playerName,
        playingAs: "player1",
      });
    } else {
      currentUser.socket.emit("OpponentNotFound");
    }
  });

  socket.on("start_to_play", () => {
    const currentUser = allUsers[socket.id];
    const room = allRooms[currentUser.roomId];

    if (room) {
      room.ready += 1;

      if (room.ready === 2) {
        room.ready = 0;
        room.player1.socket.emit("opponent-ready");
        room.player2.socket.emit("opponent-ready");
       
      }
    }
  });

  socket.on("playerMoveFromClient", (data) => {
    //console.log(data);
    const currentUser = allUsers[socket.id];
    const room = allRooms[currentUser.roomId];

    if (room) {
      //room.countReady
      const opponent = room.player1.socket.id === socket.id ? room.player2 : room.player1;
      opponent.socket.emit("playerMoveFromServer", data);
    }else {
      console.log("Room not found for user:", currentUser.roomId);
    }
  });
  socket.on("CheckWinner", (data) => {
    const currentUser = allUsers[socket.id];
    const room = allRooms[currentUser.roomId];

    if (room) {
        // Update the player's score based on who emitted the event
        if (room.player1.socket.id === socket.id) {
            room.score1 = data.count;
            room.player1Ready = true; // Mark player 1 as ready
        } else if (room.player2.socket.id === socket.id) {
            room.score2 = data.count;
            room.player2Ready = true; // Mark player 2 as ready
        }

        // Proceed if both players are ready
        if (room.player1Ready && room.player2Ready) {
            const player1Score = room.score1;
            const player2Score = room.score2;

            let winner;

            if (player1Score >= 5 && player1Score > player2Score) {
                winner = room.player1.playerName;
                room.player1.socket?.emit("WinnerDeclared", {
                    winner: room.player1.playerName,
                    opponentScore: player2Score,
                });
                room.player2.socket?.emit("WinnerDeclared", {
                    winner: room.player1.playerName,
                    opponentScore: player1Score,
                });
            } else if (player2Score >= 5 && player2Score > player1Score) {
                winner = room.player2.playerName;
                room.player1.socket?.emit("WinnerDeclared", {
                    winner: room.player2.playerName,
                    opponentScore: player2Score,
                });
                room.player2.socket?.emit("WinnerDeclared", {
                    winner: room.player2.playerName,
                    opponentScore: player1Score,
                });
            } else if (player1Score >= 5 && player1Score === player2Score) {
                winner = 'none';
                room.player1.socket?.emit("WinnerDeclared", {
                    winner: 'none',
                    opponentScore: player2Score,
                });
                room.player2.socket?.emit("WinnerDeclared", {
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

  
  socket.on("PlayAgain",() =>{
    const currentUser = allUsers[socket.id];
    const room = allRooms[currentUser.roomId];

    if (room) {
      room.readyAgain += 1;
      if(room.readyAgain === 1){
        const opponent = room.player1.socket.id === socket.id ? room.player2 : room.player1;
        opponent.socket.emit("oppoWantToPlayAgain");
      }
      else if (room.readyAgain === 2) {
        room.readyAgain = 0;
        room.score2 = 0;
        room.score1 = 0;
        room.player1.socket.emit("opponent-ready-again");
        room.player2.socket.emit("opponent-ready-again");
        
      }
    }
  });
  
  socket.on("disconnect", () => {
    const currentUser = allUsers[socket.id];
    currentUser.online = false;

    if (currentUser.roomId) {
      const room = allRooms[currentUser.roomId];
      if (room) {
        const opponent = room.player1.socket.id === socket.id ? room.player2 : room.player1;
        opponent.socket.emit("opponentLeftMatch");
        delete allRooms[currentUser.roomId];
      }
    }

    delete allUsers[socket.id];
  });
});

httpServer.listen(process.env.PORT || 3000, () => {
  //console.log('Server is running on port 3000');
});
