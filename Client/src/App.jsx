import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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

const App = () => {
  const [numState, setNumState] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState("player1");
  const [firstPlayer, setFirstPlayer] = useState('player1');
  const [finishState, setFinishState] = useState(null);
  const [markBox, setMarkBox] = useState(renderFrom);
  const [count, setCount] = useState(0);
  const [playGame, setPlayGame] = useState(false);
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

  // Use ref to store socket event cleanup functions
  const socketCleanupRef = useRef([]);

  // Memoized function to calculate game score
  const calculateScore = useCallback((board) => {
    let rowCount = 0;
    let colCount = 0;
    let diagonalCount = 0;
    
    // Check rows
    for (let i = 0; i < 5; i++) {
      if (board[i].every(cell => cell !== null)) rowCount++;
    }
    
    // Check columns
    for (let i = 0; i < 5; i++) {
      if (board.every(row => row[i] !== null)) colCount++;
    }
    
    // Check diagonals
    if (board[0][4] !== null && board[1][3] !== null && board[2][2] !== null && 
        board[3][1] !== null && board[4][0] !== null) diagonalCount++;
    if (board[0][0] !== null && board[1][1] !== null && board[2][2] !== null && 
        board[3][3] !== null && board[4][4] !== null) diagonalCount++;
    
    return rowCount + colCount + diagonalCount;
  }, []);

  // Optimized effect for score calculation
  useEffect(() => {
    if (finishState === 'continue') {
      const newCount = calculateScore(markBox);
      if (newCount !== count) {
        setCount(newCount);
      }
    }
  }, [markBox, finishState, calculateScore, count]);

  // Optimized effect for game start
  useEffect(() => {
    if (finishState === 'start' && socket) {
      socket.emit("start_to_play");
    }
  }, [finishState, socket]);

  // Optimized effect for winner check
  useEffect(() => {
    if (finishState === 'continue' && socket) {
      socket.emit("CheckWinner", { count });
    }
  }, [count, finishState, socket]);

  // Optimized effect for player moves
  useEffect(() => {
    if (finishState === 'continue' && playingAs !== currentPlayer && numArray && socket) {
      socket.emit("playerMoveFromClient", { num: numArray });
    }
  }, [numArray, finishState, playingAs, currentPlayer, socket]);

  // Socket event handlers with cleanup
  useEffect(() => {
    if (!socket) return;

    const handlers = [
      ['opponent-ready', () => setFinishState("continue")],
      ['WinnerDeclared', (data) => {
        setFinishState('gameOver');
        setWinner(data?.winner);
        setOpponentCount(data?.opponentScore);
      }],
      ['connect', () => setPlayGame(true)],
      ['OpponentNotFound', () => setOpponentName(false)],
      ['OpponentFound', (data) => {
        setOpponentName(data.opponentName);
        setPlayingAs(data.playingAs);
      }],
      ['opponentLeftMatch', () => {
        setFinishState('gameOver');
        setWinner('opponentLeft');
      }],
      ['playerMoveFromServer', (data) => {
        if (data?.num) {
          setNumArray(data.num);
          if (finishState === 'continue' && playingAs !== currentPlayer) {
            setCurrentPlayer(playingAs);
          }
        }
      }],
      ['opponent-ready-again', () => {
        resetGameState();
        setIsPlayAgain(true);
        setWantToPlayAgain(false);
        setCurrentPlayer(firstPlayer === 'player1' ? 'player2' : 'player1');
        setFirstPlayer(firstPlayer === 'player1' ? 'player2' : 'player1');
        setMatchAgain("");
      }],
      ['oppoWantToPlayAgain', () => setMatchAgain("Opponent Wants to Play Again")]
    ];

    // Add all event listeners
    handlers.forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Store cleanup function
    socketCleanupRef.current = () => {
      handlers.forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };

    return () => {
      if (socketCleanupRef.current) {
        socketCleanupRef.current();
      }
    };
  }, [socket, finishState, playingAs, currentPlayer, firstPlayer]);

  // Memoized reset function
  const resetGameState = useCallback(() => {
    setMarkBox(renderFrom.map(row => [...row])); // Create new arrays
    setNumState(0);
    setFinishState(null);
    setNumArray(0);
    setWinner(null);
    setOpponentCount(0);
    setCount(0);
  }, []);

  // Memoized player name function
  const takePlayerName = useCallback(async () => {
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
  }, []);

  // Optimized find player function
  const findPlayer = useCallback(async () => {
    const result = await takePlayerName();
    if (!result.isConfirmed) return;
    
    const userName = result.value;
    setPlayerName(userName);
    
    const newSocket = io("https://bingogame-backend.onrender.com", {
      autoConnect: true,
    });

    newSocket.emit("request_to_play", { playerName: userName });
    setSocket(newSocket);
  }, [takePlayerName]);

  // Optimized find new player function
  const findNewPlayer = useCallback(() => {
    if (socket) {
      socket.emit("disconnect", {});
      if (socketCleanupRef.current) {
        socketCleanupRef.current();
      }
    }
    
    setSocket(null);
    setOpponentName(null);
    setPlayingAs(null);
    resetGameState();
    
    const newSocket = io("https://bingogame-backend.onrender.com", {
      autoConnect: true,
    });

    newSocket.emit("request_to_play", { playerName });
    setSocket(newSocket);
  }, [socket, playerName, resetGameState]);

  // Optimized play again function
  const playAgain = useCallback(() => {
    if (!wantToPlayAgain && socket) {
      setWantToPlayAgain(true);
      setMatchAgain("Waiting for Opponent's Response..");
      socket.emit("PlayAgain");
    }
  }, [wantToPlayAgain, socket]);

  // Memoized render conditions
  const shouldShowMatchAgain = useMemo(() => 
    gameWinner !== 'opponentLeft' ? matchAgain : "", 
    [gameWinner, matchAgain]
  );

  const gameInfo = useMemo(() => {
    if (gameWinner && gameWinner === playerName) return 'You WON the Game 🤩';
    if (gameWinner && gameWinner === opponentName) return 'You LOST the Game 😟';
    if (gameWinner && gameWinner === 'none') return "It's a Draw";
    if (gameWinner && gameWinner === 'opponentLeft') return "Opponent Left the Match";
    if (!finishState) return 'Mark Numbers 1-25';
    if (finishState === 'start') return 'Let opponent finish Numbering';
    if (finishState === 'continue' && !gameWinner && playingAs === currentPlayer) return "Your Turn";
    if (finishState === 'continue' && !gameWinner && playingAs !== currentPlayer) return "Opponent's Turn";
    return '';
  }, [gameWinner, playerName, opponentName, finishState, playingAs, currentPlayer]);

  const scoreInfo = useMemo(() => {
    if (gameWinner && gameWinner !== 'opponentLeft') {
      return `Your Score: ${count} Opponent's Score: ${opponentcount}`;
    }
    return '';
  }, [gameWinner, count, opponentcount]);

  if (!playGame) {
    return (
      <div className='container'>
        <button onClick={findPlayer} className='find-player'>Find a Player</button>
      </div>
    );
  }

  if (playGame && !opponentName) {
    return (
      <div className='container'>
        <div>Looking for an opponent...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div>{shouldShowMatchAgain}</div>
      <div className="turn">
        <div className={`player ${(finishState === 'continue' && playingAs === currentPlayer) ? 'my-turn' : ''}`}>
          {playerName}
        </div>
        <b>Bingo</b>
        <div className={`player ${(finishState === 'continue' && playingAs !== currentPlayer) ? 'opponent-turn' : ''}`}>
          {opponentName}
        </div>
      </div>
      <div className={`game-board ${(gameWinner && (gameWinner === opponentName || gameWinner === 'opponentLeft')) ? 'opponent-won' : ''}`}>
        {renderFrom.map((arr, rowIndex) =>
          arr.map((e, colIndex) => (
            <Box 
              key={rowIndex * 5 + colIndex}
              playingAs={playingAs}
              numArray={numArray}
              setNumArray={setNumArray}
              finishState={finishState}
              setFinishState={setFinishState}
              setMarkBox={setMarkBox}
              numState={numState}
              setNumState={setNumState}
              currentPlayer={currentPlayer}
              setCurrentPlayer={setCurrentPlayer}
              isplayAgain={isplayAgain}
              setIsPlayingAgain={setIsPlayAgain}
              id={rowIndex * 5 + colIndex}
            />
          ))
        )}
      </div>
      <div className="info">
        {gameInfo}
        {gameWinner && gameWinner !== 'opponentLeft' && <br />}
        {scoreInfo}
      </div>
      <div className={`playAgain ${(gameWinner && gameWinner !== 'opponentLeft') ? 'visible' : ''}`}>
        <button onClick={playAgain}>Play Again</button>
      </div>
      <div className={`playAgain ${(gameWinner && gameWinner === 'opponentLeft') ? 'visible' : ''}`}>
        <button onClick={findNewPlayer}>Find Another Player</button>
      </div>
    </div>
  );
};

export default App;