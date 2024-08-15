import React, { useState, useEffect} from 'react'
import './Box.css'


const Box = ({numArray,setNumArray,playingAs,setFinishState,finishState,setMarkBox,id,numState,setNumState,currentPlayer,setCurrentPlayer}) => {
    const [num, setNum] = useState(null);
    const [clas, setClas] = useState('cell');

    const clickOnCell = () =>{
        if(!finishState){
            if(numState < 25){
                if(!num){
                    setNum(numState + 1);
                    setNumState(numState + 1);
                }
                if(numState === 24){
                    setFinishState('start');
                }
            }
        }
       if(finishState === 'continue' && playingAs !== currentPlayer){
        return;
       }
        if (finishState==='continue' && clas !== 'cell active') {
            setClas('cell active');
            const myCurrent = currentPlayer;
            if(currentPlayer === playingAs){
                setMarkBox(prevState => {
                    const newState = prevState.map(row => row.slice());
                    const row = Math.floor(id / 5);
                    const col = id % 5;
                    newState[row][col] = myCurrent;
                    return newState;
                });
            }
            setCurrentPlayer(currentPlayer === 'player1' ? 'player2' : 'player1');
            setNumArray(num);
        } 
    }
    useEffect(() => {
        if(finishState === 'gameOver' && clas !== 'cell active'){
            setClas('cell not-allowed');
        }
    }, [finishState]);

    useEffect(() => {
            const myCurrent = playingAs === 'player1'?'player2':'player1';
            if(currentPlayer === playingAs){
                if(num===numArray){
                    setMarkBox(prevState => {
                        const newState = prevState.map(row => row.slice());
                        const i = Math.floor(id / 5);
                        const j = id % 5;
                        newState[i][j] = myCurrent;
                        return newState;
                    });
                    setClas('cell active opponent');
                }  
            }
    }, [currentPlayer]);

  return (
    <div onClick={clickOnCell} className= {clas} >{num}</div>
  )
}

export default Box