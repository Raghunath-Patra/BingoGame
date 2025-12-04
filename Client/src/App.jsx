import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import Box from './Box.jsx'
import { io } from 'socket.io-client' 
import Swal from 'sweetalert2'

const renderFrom = [
  [null,null,null,null,null],
  [null,null,null,null,null],
  [null,null,null,null,null],
  [null,null,null,null,null],
  [null,null,null,null,null]
]

const App = ()=> {
  const [numState, setNumState] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState("player1");
  const [firstPlayer, setFirstPlayer] = useState('player1');
  const [finishState, setFinishState] = useState(null);
  const [markBox, setMarkBox] = useState(renderFrom);
  const [count, setCount] = useState(0);
  const [playGame,setPlayGame] = useState(false);
  const [socket, setSocket] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [opponentName, setOpponentName] = useState(null);
  const [numArray, setNumArray] = useState(0);
  const [playingAs, setPlayingAs] = useState(null);
  const [gameWinner, setWinner] = useState(null);
  const [opponentcount, setOpponentCount] = useState(0);
  const [isplayAgain, setIsPlayAgain] = useState(false);
  const [wantToPlayAgain, setWantToPlayAgain] = useState(false);
  const [matchAgain, setMatchAgain] = useState(null);
  
  // New state for connection handling
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connected', 'disconnected', 'reconnecting'
  const [pendingEmits, setPendingEmits] = useState([]);
  const emitTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  // Helper function to emit with retry logic
  const emitWithRetry = (eventName, data, retries = 3) => {
    if (!socket || !socket.connected) {
      // Queue the emit for when connection is restored
      setPendingEmits(prev => [...prev, { eventName, data, retries }]);
      return;
    }

    socket.emit(eventName, data, (acknowledgment) => {
      // If acknowledgment fails, retry
      if (!acknowledgment && retries > 0) {
        setTimeout(() => {
          emitWithRetry(eventName, data, retries - 1);
        }, 1000);
      }
    });
  };

  // Process pending emits when connection is restored
  useEffect(() => {
    if (connectionStatus === 'connected' && pendingEmits.length > 0) {
      pendingEmits.forEach(({ eventName, data }) => {
        socket?.emit(eventName, data);
      });
      setPendingEmits([]);
    }
  }, [connectionStatus, pendingEmits]);

  // Monitor numState and emit when player finishes numbering
  useEffect(() => {
    if(numState === 25 && finishState !== 'start' && finishState !== 'continue'){
      setFinishState('start');
      emitWithRetry("start_to_play", {}); 
    }
  }, [numState]);

  // Listen for opponent ready event
  useEffect(() => {
    if (!socket) return;

    const handleOpponentReady = () => {
      setFinishState("continue");
    };

    socket.on("opponent-ready", handleOpponentReady);

    return () => {
      socket.off("opponent-ready", handleOpponentReady);
    };
  }, [socket]);

  useEffect(() => {
    if(finishState === 'gameOver'){
      return;
    }
    if (finishState === 'continue') {
      let rowCount = 0;
      let colCount = 0;
      let diagonalCount = 0;
      for (let i = 0; i < 5; i++) {
        let isRowFull = true;
        for (let j = 0; j < 5; j++) {
          if (markBox[i][j] === null) {
            isRowFull = false;
            break;
          }
        }
        if (isRowFull) rowCount++;
      }
      for (let i = 0; i < 5; i++) {
        let isColFull = true;
        for (let j = 0; j < 5; j++) {
          if (markBox[j][i] === null) {
            isColFull = false;
            break;
          }
        }
        if (isColFull) colCount++;
      }
      //Check Diagonal
      if(markBox[0][4]!==null && markBox[1][3]!==null && markBox[2][2]!==null && markBox[3][1]!==null && markBox[4][0]!==null)
        diagonalCount++;
      if(markBox[0][0]!==null && markBox[1][1]!==null && markBox[2][2]!==null && markBox[3][3]!==null && markBox[4][4]!==null)
        diagonalCount++;
      setCount(rowCount + colCount + diagonalCount);
    }
}, [markBox,finishState]);

useEffect(() => {
  if(finishState === 'continue'){
    emitWithRetry("CheckWinner", { count: count });
  }
}, [count]);

useEffect(() => { 
  if(finishState === 'continue' && playingAs !== currentPlayer){
    emitWithRetry("playerMoveFromClient", { num: numArray });
  }
}, [numArray]);

useEffect(() => {
  if (!socket) return;

  const handleWinnerDeclared = (data) => {
    setFinishState('gameOver');
    setWinner(data?.winner);
    setOpponentCount(data?.opponentScore);
  };

  const handleConnect = () => {
    setPlayGame(true);
    setConnectionStatus('connected');
    reconnectAttempts.current = 0;
  };

  const handleDisconnect = () => {
    setConnectionStatus('disconnected');
  };

  const handleReconnecting = (attemptNumber) => {
    setConnectionStatus('reconnecting');
    reconnectAttempts.current = attemptNumber;
  };

  const handleReconnect = () => {
    setConnectionStatus('connected');
    reconnectAttempts.current = 0;
    
    // Re-emit player info if game was in progress
    if (playerName && !opponentName) {
      emitWithRetry("request_to_play", { playerName: playerName });
    }
  };

  const handleConnectError = (error) => {
    console.error("Connection error:", error);
    setConnectionStatus('disconnected');
  };

  const handleOpponentNotFound = () => {
    setOpponentName(false);
  };

  const handleOpponentFound = (data) => {
    setOpponentName(data.opponentName);
    setPlayingAs(data.playingAs);
  };

  const handleOpponentLeft = () => {
    setFinishState('gameOver');
    setWinner('opponentLeft');
  };

  const handlePlayerMove = (data) => {
    if(data){
      setNumArray(data.num);
      if(finishState === 'continue' && playingAs !== currentPlayer){
        setCurrentPlayer(playingAs);
      }
    }
    else{
      console.log("some error occured");
    }
  };

  const handleOpponentReadyAgain = () => {
    setMarkBox(renderFrom);
    setNumState(0);
    setFinishState(null);
    setNumArray(0);
    setWinner(null);
    setOpponentCount(0);
    setCount(0);
    setIsPlayAgain(true);
    setWantToPlayAgain(false);
    setCurrentPlayer(firstPlayer === 'player1' ? 'player2' : 'player1');
    setFirstPlayer(firstPlayer === 'player1' ? 'player2' : 'player1');
    setMatchAgain("");
  };

  const handleOppoWantToPlayAgain = () => {
    setMatchAgain("Opponent Wants to Play Again");
  };

  // Connection events
  socket.on("connect", handleConnect);
  socket.on("disconnect", handleDisconnect);
  socket.on("reconnecting", handleReconnecting);
  socket.on("reconnect", handleReconnect);
  socket.on("connect_error", handleConnectError);

  // Game events
  socket.on("WinnerDeclared", handleWinnerDeclared);
  socket.on("OpponentNotFound", handleOpponentNotFound);
  socket.on("OpponentFound", handleOpponentFound);
  socket.on("opponentLeftMatch", handleOpponentLeft);
  socket.on("playerMoveFromServer", handlePlayerMove);
  socket.on("opponent-ready-again", handleOpponentReadyAgain);
  socket.on("oppoWantToPlayAgain", handleOppoWantToPlayAgain);

  return () => {
    socket.off("connect", handleConnect);
    socket.off("disconnect", handleDisconnect);
    socket.off("reconnecting", handleReconnecting);
    socket.off("reconnect", handleReconnect);
    socket.off("connect_error", handleConnectError);
    socket.off("WinnerDeclared", handleWinnerDeclared);
    socket.off("OpponentNotFound", handleOpponentNotFound);
    socket.off("OpponentFound", handleOpponentFound);
    socket.off("opponentLeftMatch", handleOpponentLeft);
    socket.off("playerMoveFromServer", handlePlayerMove);
    socket.off("opponent-ready-again", handleOpponentReadyAgain);
    socket.off("oppoWantToPlayAgain", handleOppoWantToPlayAgain);
  };
}, [socket, finishState, playingAs, currentPlayer, firstPlayer, playerName, opponentName]);

const takePlayerName = async() =>{
  const result = await Swal.fire({
    title: "Enter your Name",
    input: "text",
    inputLabel: "name",
    showCancelButton: true,
    inputValidator: (value) => {
      if (!value) {
        return "You need to write something!";
      }
    }
  });
  return result;
}

async function findPlayer(){
  const result = await takePlayerName();
  if(!result.isConfirmed){
    return;
  }
  const userName = result.value;
  setPlayerName(userName);
  
  const newSocket = io("https://bingogame-backend.onrender.com", {
    //const newSocket = io("http://localhost:3000", {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
  });

  newSocket?.emit("request_to_play", {
    playerName: userName,
  });

  setSocket(newSocket);
}

const findNewPlayer = ()=>{
  socket?.emit("disconnect",{});
  socket?.disconnect();
  setSocket(null);
  setOpponentName(null);
  setPlayingAs(null);

  setMarkBox(renderFrom);
  setNumState(0);
  setFinishState(null);
  setNumArray(0);
  setWinner(null);
  setOpponentCount(0);
  setCount(0);
  setConnectionStatus('disconnected');
  
  const newSocket = io("https://bingogame-backend.onrender.com", {
    //const newSocket = io("http://localhost:3000", {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    transports: ['websocket', 'polling'],
  });

  newSocket?.emit("request_to_play", {
    playerName: playerName,
  });

  setSocket(newSocket);
}

const playAgain = () =>{
  if(!wantToPlayAgain){
    setWantToPlayAgain(true);
    setMatchAgain("Waiting for Opponent's Response..");
    emitWithRetry("PlayAgain", {});
  }
}

  // Connection status indicator
  const getConnectionStatusDisplay = () => {
    switch(connectionStatus) {
      case 'connected':
        return <span className="status-indicator connected">🟢 Connected</span>;
      case 'reconnecting':
        return <span className="status-indicator reconnecting">🟡 Reconnecting...</span>;
      case 'disconnected':
        return <span className="status-indicator disconnected">🔴 Disconnected</span>;
      default:
        return null;
    }
  };

  if(!playGame){
    return(
      <div className='container'>
        <button onClick={findPlayer} className='find-player'>Find a Player</button>
      </div>
    )
  }

  if(playGame && !opponentName){
    return(
      <div className='container'>
        <div className="connection-status">{getConnectionStatusDisplay()}</div>
        <div>Looking for an opponent...</div>
      </div>
    )
  }
  return (
    
    <div className="container">
      <div className="connection-status">{getConnectionStatusDisplay()}</div>
      <div>
        {(gameWinner !== 'opponentLeft')?matchAgain : ""}
      </div>
      <div className="turn">
        <div className={`player ${(finishState ==='continue' && playingAs===currentPlayer) ? 'my-turn':''}`} >{playerName}</div>
        <b>Bingo</b>
        <div className={`player ${(finishState === 'continue' && playingAs!==currentPlayer) ? 'opponent-turn':''}`}>{opponentName}</div>
      </div>
      <div className={`game-board ${(gameWinner && (gameWinner === opponentName || gameWinner === 'opponentLeft')) ? 'opponent-won' : ''} ${connectionStatus !== 'connected' ? 'board-disabled' : ''}`}>
        {
          renderFrom.map( (arr,rowIndex) =>
            arr.map((e,colIndex) =>{
              return <Box 
              playingAs = {playingAs}
              numArray = {numArray}
              setNumArray={setNumArray}
              finishState = {finishState}
              setFinishState = {setFinishState}
              setMarkBox = {setMarkBox}
              numState = {numState}
              setNumState = {setNumState}
              currentPlayer = {currentPlayer}
              setCurrentPlayer = {setCurrentPlayer}
              isplayAgain = {isplayAgain}
              setIsPlayingAgain={setIsPlayAgain}
              id={rowIndex*5 + colIndex}
              key={rowIndex*5 + colIndex}/>;
            })
          )}
      </div>
      <div className="info">
        {(gameWinner && gameWinner === playerName)? 'You WON the Game 🤩':''}
        {(gameWinner && gameWinner === opponentName)? 'You LOST the Game 😟':''}
        {(gameWinner && gameWinner === 'none')? "It's a Draw":""}
        {(gameWinner && gameWinner !== 'opponentLeft')? <br/>:null}
        {(gameWinner && gameWinner !== 'opponentLeft')? "Your Score:"+count+" Opponent's Score:"+opponentcount:""}
        {(gameWinner && gameWinner === 'opponentLeft')? "Opponent Left the Match":""}
        {(!finishState)? 'Mark Numbers 1-25':''}
        {(finishState && finishState === 'start')? 'Waiting for opponent to finish numbering...':''}
        {(finishState && finishState === 'continue'&& !gameWinner && playingAs === currentPlayer)? "Your Turn":""}
        {(finishState && finishState === 'continue'&& !gameWinner && playingAs !== currentPlayer)? "Opponent's Turn":""}
        {connectionStatus === 'reconnecting' ? <div className="warning-text">⚠️ Connection unstable, reconnecting...</div> : ''}
      </div>
      <div className={`playAgain ${(gameWinner && gameWinner!=='opponentLeft') ? 'visible': ''}`}>
          <button onClick={playAgain}>Play Again</button>
      </div>
      <div className={`playAgain ${(gameWinner && gameWinner==='opponentLeft') ? 'visible': ''}`}>
          <button onClick={findNewPlayer}>Find Another Player</button>
      </div>
    </div>
  )
}

export default App
