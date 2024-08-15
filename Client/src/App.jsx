import React, { useState, useEffect } from 'react'
import './App.css'
import Box from './box.jsx'
import { io } from 'socket.io-client' 
import Swal from 'sweetalert2'

const renderFrom = [
  [1,2,3,4,5],[6,7,8,9,10],[11,12,13,14,15],[16,17,18,19,20],[21,22,23,24,25]
]
const renderMarks = [
  [null,null,null,null,null],
  [null,null,null,null,null],
  [null,null,null,null,null],
  [null,null,null,null,null],
  [null,null,null,null,null]
]

const App = ()=> {
  const [numState, setNumState] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState("player1");
  const [finishState, setFinishState] = useState(null);
  const [markBox, setMarkBox] = useState(renderMarks);
  const [count, setCount] = useState(0);
  const [playGame,setPlayGame] = useState(false);
  const [socket, setSocket] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [opponentName, setOpponentName] = useState(null);
  const [numArray, setNumArray] = useState(0);
  const [playingAs, setPlayingAs] = useState(null);
  const [gameWinner, setWinner] = useState(null);

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
  if(finishState === 'start'){
    socket?.emit("start_to_play"); 
  }
}, [finishState]);

socket?.on("opponent-ready", function(){
  setFinishState("continue");
}) 

useEffect(() => {
  socket?.emit("CheckWinner",{
    count: count,
  });
}, [count]);

useEffect(() => {
  if(finishState === 'continue' && playingAs !== currentPlayer){
    
    socket?.emit("playerMoveFromClient",{
      num: numArray,
    });
  }
}, [numArray]);

socket?.on("WinnerDeclared",(data)=>{
  setFinishState('gameOver');
  setWinner(data?.winner);
  console.log(markBox);
});

socket?.on("connect", function(){
  setPlayGame(true);
});

socket?.on("OpponentNotFound", function () {
  setOpponentName(false);
});

socket?.on("OpponentFound", function (data) {
  setOpponentName(data.opponentName);
  setPlayingAs(data.playingAs);
  
});

socket?.on("opponentLeftMatch",()=>{
  setFinishState('gameOver');
  setWinner('opponentLeft');
});

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

socket?.on("playerMoveFromServer", (data) => {
  if(data){
    setNumArray(data.num);
    if(finishState === 'continue' && playingAs !== currentPlayer){
      setCurrentPlayer(playingAs);
    }
  }
  else{
    console.log("some error occured");
  }
});

async function findPlayer(){
  const result = await takePlayerName();
  if(!result.isConfirmed){
    return;
  }
  const userName = result.value;
  setPlayerName(userName);
  const newSocket = io("https://bingogame-backend.onrender.com",{
    autoConnect: true,
  });

  newSocket?.emit("request_to_play", {
    playerName: userName,
  });

  setSocket(newSocket);
}

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
        <div>Looking for an opponent...</div>
      </div>
    )
  }
  return (
    
    <div className="container">
      <div className="turn">
        <div className={`player ${(finishState ==='continue' && playingAs===currentPlayer) ? 'my-turn':''}`} >{playerName}</div>

        <div className={`player ${(finishState === 'continue' && playingAs!==currentPlayer) ? 'opponent-turn':''}`}>{opponentName}</div>
      </div>
      <div className={`game-board ${(gameWinner && gameWinner === opponentName) ? 'opponent-won' : ''}`}>
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
              id={rowIndex*5 + colIndex}
              key={e}/>;
            })
          )}
      </div>
      <div className="info">
        {(gameWinner && gameWinner === playerName)? 'You WON the Game':''}
        {(gameWinner && gameWinner === opponentName)? 'You LOST the Game':''}
        {(gameWinner && gameWinner === 'none')? "It's a Draw":""}
        {(gameWinner && gameWinner === 'opponentLeft')? "Opponent Left the Match":""}
        {(!finishState)? 'Mark Numbers 1-25':''}
        {(finishState && finishState === 'start')? 'Let opponent finish Numbering':''}
        {(finishState && finishState === 'continue'&& !gameWinner && playingAs === currentPlayer)? "Your Turn":""}
        {(finishState && finishState === 'continue'&& !gameWinner && playingAs !== currentPlayer)? "Opponent's Turn":""}
      </div>
    </div>
  )
}

export default App
