import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Target = { x: number; y: number; id: number };

export function MiniGame() {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number>(() => Number(localStorage.getItem("mini_game_best") || "0"));
  const [target, setTarget] = useState<Target>({ x: 50, y: 50, id: 1 });

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const moveTimer = window.setInterval(() => {
      setTarget((prev) => ({
        id: prev.id + 1,
        x: Math.floor(Math.random() * 86) + 7,
        y: Math.floor(Math.random() * 70) + 10,
      }));
    }, 750);
    return () => window.clearInterval(moveTimer);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning && score > bestScore) {
      setBestScore(score);
      localStorage.setItem("mini_game_best", String(score));
    }
  }, [bestScore, isRunning, score]);

  const accuracyHint = useMemo(() => {
    if (score >= 22) return "Fast hands. Barber-level reflexes.";
    if (score >= 12) return "Good pace. Keep tapping.";
    return "Warm-up round. You can beat this.";
  }, [score]);

  const startGame = () => {
    setScore(0);
    setTimeLeft(25);
    setIsRunning(true);
    setTarget({ x: 50, y: 50, id: Date.now() });
  };

  return (
    <Card className="overflow-hidden border-zinc-800/10 dark:border-zinc-700">
      <CardHeader className="pb-3">
        <CardTitle>Waiting Mini-Game: Catch The Clippers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="status-chip status-chip--pending">Time: {timeLeft}s</span>
          <span className="status-chip status-chip--accepted">Score: {score}</span>
          <span className="status-chip status-chip--completed">Best: {bestScore}</span>
        </div>

        <div className="relative h-60 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-gradient-to-br from-orange-100 via-white to-zinc-100 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900">
          <button
            key={target.id}
            type="button"
            disabled={!isRunning}
            onClick={() => {
              if (!isRunning) return;
              setScore((v) => v + 1);
              setTarget((prev) => ({
                id: prev.id + 1,
                x: Math.floor(Math.random() * 86) + 7,
                y: Math.floor(Math.random() * 70) + 10,
              }));
            }}
            className="absolute h-11 w-11 rounded-full bg-black text-orange-400 shadow-lg transition-all duration-150 hover:scale-110 disabled:opacity-60"
            style={{ left: `${target.x}%`, top: `${target.y}%`, transform: "translate(-50%, -50%)" }}
            aria-label="Catch target"
          >
            ✂
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={startGame}>{isRunning ? "Restart" : "Start Game"}</Button>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{accuracyHint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

