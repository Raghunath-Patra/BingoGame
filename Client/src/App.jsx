import React, { useState, useEffect } from 'react'
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
  if(finishState === 'continue'){
    socket?.emit("CheckWinner",{
      count: count,
    });
  }
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
  setOpponentCount(data?.opponentScore);
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
    //const newSocket = io("http://localhost:3000",{
    autoConnect: true,
  });

  newSocket?.emit("request_to_play", {
    playerName: userName,
  });

  setSocket(newSocket);
}

function findNewPlayer(){
  setMarkBox(renderFrom);
  setNumState(0);
  setFinishState(null);
  setNumArray(0);
  setWinner(null);
  setOpponentCount(0);
  setCount(0);
  const newSocket = io("https://bingogame-backend.onrender.com",{
    //const newSocket = io("http://localhost:3000",{
    autoConnect: true,
  });

  newSocket?.emit("request_to_play", {
    playerName: userName,
  });

  setSocket(newSocket);
}

socket?.on("opponent-ready-again",()=>{
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
});
socket?.on("oppoWantToPlayAgain",()=>{
    setMatchAgain("Opponent Wants to Play Again")
});
const playAgain = () =>{
  if(!wantToPlayAgain){
    setWantToPlayAgain(true);
    setMatchAgain("Waiting for Opponent's Response..");
    socket?.emit("PlayAgain");
  }
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
      <div>
        {(gameWinner !== 'opponentLeft')?matchAgain : ""}
      </div>
      <div className="turn">
        <div className={`player ${(finishState ==='continue' && playingAs===currentPlayer) ? 'my-turn':''}`} >{playerName}</div>
        <b>Bingo</b>
        <div className={`player ${(finishState === 'continue' && playingAs!==currentPlayer) ? 'opponent-turn':''}`}>{opponentName}</div>
      </div>
      <div className={`game-board ${(gameWinner && (gameWinner === opponentName || gameWinner === 'opponentLeft')) ? 'opponent-won' : ''}`}>
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
        {(finishState && finishState === 'start')? 'Let opponent finish Numbering':''}
        {(finishState && finishState === 'continue'&& !gameWinner && playingAs === currentPlayer)? "Your Turn":""}
        {(finishState && finishState === 'continue'&& !gameWinner && playingAs !== currentPlayer)? "Opponent's Turn":""}
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
