"use client";

import { useEffect, useState } from "react";

interface AudioVisualizerProps {
  level: number;
}

export function AudioVisualizer({ level }: AudioVisualizerProps) {
  const [bars, setBars] = useState<number[]>([]);

  useEffect(() => {
    // Create multiple bars with slight variations for visual effect
    const barCount = 20;
    const newBars = Array.from({ length: barCount }, (_, i) => {
      const variation = Math.random() * 0.3 + 0.7; // 70-100% of actual level
      const positionVariation = Math.sin((i / barCount) * Math.PI) * 0.5 + 0.5;
      return Math.min(level * variation * positionVariation * 100, 100);
    });
    setBars(newBars);
  }, [level]);

  return (
    <div className="flex items-end justify-center gap-1 h-16 px-4">
      {bars.map((height, index) => (
        <div
          key={index}
          className="w-2 bg-gradient-to-t from-blue-500 to-purple-500 rounded-t transition-all duration-75"
          style={{
            height: `${Math.max(height, 4)}%`,
            opacity: height > 5 ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}
