import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import './Box.css'

const Box = memo(({
  numArray,
  setNumArray,
  playingAs,
  setFinishState,
  finishState,
  setMarkBox,
  id,
  numState,
  setNumState,
  currentPlayer,
  setCurrentPlayer,
  isplayAgain,
  setIsPlayingAgain
}) => {
  const [num, setNum] = useState(null);
  const [clas, setClas] = useState('cell');

  // Memoize position calculations
  const position = useMemo(() => ({
    row: Math.floor(id / 5),
    col: id % 5
  }), [id]);

  // Memoized click handler
  const clickOnCell = useCallback(() => {
    // Handle number marking phase
    if (!finishState) {
      if (numState < 25 && !num) {
        const newNum = numState + 1;
        setNum(newNum);
        setNumState(newNum);
      }
      return;
    }

    // Handle game phase
    if (finishState === 'continue') {
      if (playingAs !== currentPlayer) return;
      if (clas === 'cell active') return;

      setClas('cell active');
      const myCurrent = currentPlayer;
      
      // Optimized markBox update - only update the specific cell
      setMarkBox(prevState => {
        const newState = [...prevState];
        newState[position.row] = [...newState[position.row]];
        newState[position.row][position.col] = myCurrent;
        return newState;
      });

      setCurrentPlayer(currentPlayer === 'player1' ? 'player2' : 'player1');
      setNumArray(num);
    }
  }, [
    finishState,
    numState,
    num,
    playingAs,
    currentPlayer,
    clas,
    position,
    setNumState,
    setMarkBox,
    setCurrentPlayer,
    setNumArray
  ]);

  // Consolidated useEffect for game state changes
  useEffect(() => {
    // Check if numbering phase is complete
    if (numState === 25) {
      setFinishState('start');
    }

    // Handle game over state
    if (finishState === 'gameOver' && clas !== 'cell active') {
      setClas('cell not-allowed');
    }

    // Handle play again
    if (isplayAgain) {
      setClas('cell');
      setNum(null);
      setIsPlayingAgain(false);
    }
  }, [numState, finishState, clas, isplayAgain, setFinishState, setIsPlayingAgain]);

  // Optimized effect for opponent moves
  useEffect(() => {
    if (currentPlayer === playingAs && num === numArray && finishState === 'continue') {
      const myCurrent = playingAs === 'player1' ? 'player2' : 'player1';
      
      setMarkBox(prevState => {
        const newState = [...prevState];
        newState[position.row] = [...newState[position.row]];
        newState[position.row][position.col] = myCurrent;
        return newState;
      });
      
      setClas('cell active');
    }
  }, [currentPlayer, playingAs, num, numArray, finishState, position, setMarkBox]);

  return (
    <div onClick={clickOnCell} className={clas}>
      {num}
    </div>
  );
});

Box.displayName = 'Box';

export default Box;