import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimerProps {
  durationMinutes: number;
  onTimeUp: () => void;
  isRunning: boolean;
}

const Timer: React.FC<TimerProps> = ({ durationMinutes, onTimeUp, isRunning }) => {
  const [secondsRemaining, setSecondsRemaining] = useState(durationMinutes * 60);

  useEffect(() => {
    let interval: any;
    if (isRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0) {
      onTimeUp();
    }
    return () => clearInterval(interval);
  }, [isRunning, secondsRemaining, onTimeUp]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  
  // Last minute logic (Visual alert for feedback time)
  const isLastMinute = secondsRemaining <= 60 && secondsRemaining > 0;
  const isTimeUp = secondsRemaining === 0;

  let containerClass = "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xl font-bold shadow-sm transition-colors duration-300";
  
  if (isTimeUp) {
    containerClass += " bg-red-800 text-white animate-pulse";
  } else if (isLastMinute) {
    containerClass += " bg-amber-500 text-white animate-pulse";
  } else {
    containerClass += " bg-white text-slate-700 border border-slate-200";
  }

  return (
    <div className={containerClass}>
      <Clock size={24} />
      <span>
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </span>
      {isLastMinute && <span className="text-xs ml-2 font-sans uppercase tracking-wider font-semibold">Tiempo de Feedback</span>}
      {isTimeUp && <span className="text-xs ml-2 font-sans uppercase tracking-wider font-semibold">Finalizado</span>}
    </div>
  );
};

export default Timer;