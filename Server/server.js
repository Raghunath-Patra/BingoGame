const { createServer } = require("http");
const { Server } = require('socket.io');

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "https://bingogame-frontend.onrender.com",
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
        room.player1.socket.emit("opponent-ready");
        room.player2.socket.emit("opponent-ready");
        room.ready = 0;
      }
    }
  });

  socket.on("playerMoveFromClient", (data) => {
    //console.log(data);
    const currentUser = allUsers[socket.id];
    const room = allRooms[currentUser.roomId];

    if (room) {
      const opponent = room.player1.socket.id === socket.id ? room.player2 : room.player1;
      opponent.socket.emit("playerMoveFromServer", data);
    }else {
      console.log("Room not found for user:", currentUser.roomId);
    }
  });
  /*
  socket.on("CheckWinner",(data) =>{
    const currentUser = allUsers[socket.id];
    const room = allRooms[currentUser.roomId];

    if (room) {
      room.countReady += 1;
      room.player1.socket.id === socket.id ? room.score1 = data.count : room.score2 = data.count;
      if (room.countReady === 2) {
        room.countReady = 1;
        const opponentCount = room.player1.socket.id === socket.id ? room.score2 : room.score1;
        const count = room.player1.socket.id === socket.id ? room.score1 : room.score2;
        console.log(count,opponentCount);
        if(count >= 5 && opponentCount < count){
          room.player1.socket?.emit("WinnerDeclared",{
            winner: room.player1.playerName,
          });
          room.player2.socket?.emit("WinnerDeclared",{
            winner: room.player1.playerName,
          });
        }else if(opponentCount >= 5 && count < opponentCount){
          room.player1.socket?.emit("WinnerDeclared",{
            winner: room.player2.playerName,
          });
          room.player2.socket?.emit("WinnerDeclared",{
            winner: room.player2.playerName,
          });
        }else if(count >= 5 && count === opponentCount){
          room.player1.socket?.emit("WinnerDeclared",{
            winner: 'none',
          });
          room.player2.socket?.emit("WinnerDeclared",{
            winner: 'none',
          });
        }
          
      }
    }
  })*/
  socket.on("CheckWinner", (data) => {
    const currentUser = allUsers[socket.id];
    const room = allRooms[currentUser.roomId];
  
    if (room) {
      // Update scores based on the player making the request
      if (room.player1.socket.id === socket.id) {
        room.score1 = data.count;
      } else if (room.player2.socket.id === socket.id) {
        room.score2 = data.count;
      }
  
      // Increment the countReady
      room.countReady += 1;
  
      if (room.countReady === 2) {
        // Determine the winner
        const player1Score = room.score1;
        const player2Score = room.score2;
        
        //let winner;
        if (player1Score >= 5 && player1Score > player2Score) {
          //winner = room.player1.playerName;
          room.player1.socket?.emit("WinnerDeclared",{
            winner: room.player1.playerName,
          });
          room.player2.socket?.emit("WinnerDeclared",{
            winner: room.player1.playerName,
          });
        } else if (player2Score >= 5 && player2Score > player1Score) {
          winner = room.player2.playerName;
          room.player1.socket?.emit("WinnerDeclared",{
            winner: room.player2.playerName,
          });
          room.player2.socket?.emit("WinnerDeclared",{
            winner: room.player2.playerName,
          });
        } else if (player1Score >= 5 && player1Score === player2Score) {
          //winner = 'none';
          room.player1.socket?.emit("WinnerDeclared",{
            winner: 'none',
          });
          room.player2.socket?.emit("WinnerDeclared",{
            winner: 'none',
          });
        }
        // Reset the room state for next round
        room.countReady = 0; // Reset countReady for next round
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
