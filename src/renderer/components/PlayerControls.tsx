import React, { useState, useRef } from "react";
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  RepeatIcon,
  ShuffleIcon,
  Volume2Icon,
} from "lucide-react";

interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onSkipForward: () => void;
  onSkipBack: () => void;
}

export function PlayerControls({
  isPlaying,
  onPlayPause,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  onSkipForward,
  onSkipBack,
}: PlayerControlsProps) {
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [isDragging, setIsDragging] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" + secs : secs}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;

    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;

    onSeek(newTime);
  };

  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !progressRef.current || !duration) return;

    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const newTime = percentage * duration;

    onSeek(newTime);
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeRef.current) return;

    const rect = volumeRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newVolume = Math.round(percentage * 100);

    onVolumeChange(newVolume);
  };

  const toggleShuffle = () => {
    setIsShuffle(!isShuffle);
    // Implementar lógica de shuffle
  };

  const toggleRepeat = () => {
    const modes: Array<"off" | "all" | "one"> = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
    // Implementar lógica de repetición
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-center mb-2">
        <button
          className={`mx-2 transition-colors ${
            isShuffle ? "text-[#2196F3]" : "text-gray-500 hover:text-[#2196F3]"
          }`}
          onClick={toggleShuffle}
          title="Shuffle"
        >
          <ShuffleIcon className="h-4 w-4" />
        </button>

        <button
          className="mx-2 text-gray-500 hover:text-[#2196F3] transition-colors"
          onClick={onSkipBack}
          title="Previous"
        >
          <SkipBackIcon className="h-5 w-5" />
        </button>

        <button
          className="mx-3 p-2 rounded-full bg-[#2196F3] text-white hover:bg-blue-600 transition-colors"
          onClick={onPlayPause}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <PauseIcon className="h-6 w-6" />
          ) : (
            <PlayIcon className="h-6 w-6 ml-0.5" />
          )}
        </button>

        <button
          className="mx-2 text-gray-500 hover:text-[#2196F3] transition-colors"
          onClick={onSkipForward}
          title="Next"
        >
          <SkipForwardIcon className="h-5 w-5" />
        </button>

        <button
          className={`mx-2 transition-colors ${
            repeatMode !== "off"
              ? "text-[#2196F3]"
              : "text-gray-500 hover:text-[#2196F3]"
          }`}
          onClick={toggleRepeat}
          title={`Repeat: ${repeatMode}`}
        >
          <div className="relative">
            <RepeatIcon className="h-4 w-4" />
            {repeatMode === "one" && (
              <span className="absolute -top-1 -right-1 text-xs font-bold">
                1
              </span>
            )}
          </div>
        </button>
      </div>

      <div className="flex items-center">
        <span className="text-xs text-gray-500 w-10 text-right">
          {formatTime(currentTime)}
        </span>

        <div
          ref={progressRef}
          className="flex-1 mx-3 h-1 bg-gray-200 rounded relative cursor-pointer group"
          onClick={handleProgressClick}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onMouseMove={handleProgressDrag}
        >
          <div
            className="absolute h-full bg-[#2196F3] rounded pointer-events-none"
            style={{ width: `${progressPercentage}%` }}
          />
          <div
            className="absolute h-3 w-3 bg-[#2196F3] rounded-full shadow -mt-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              left: `${progressPercentage}%`,
              transform: "translateX(-50%)",
            }}
          />
        </div>

        <span className="text-xs text-gray-500 w-10">
          {formatTime(duration)}
        </span>

        <div className="ml-6 flex items-center">
          <Volume2Icon className="h-4 w-4 text-gray-500 mr-2" />
          <div
            ref={volumeRef}
            className="w-24 h-1 bg-gray-200 rounded relative cursor-pointer group"
            onClick={handleVolumeClick}
          >
            <div
              className="absolute h-full bg-[#2196F3] rounded pointer-events-none"
              style={{ width: `${volume}%` }}
            />
            <div
              className="absolute h-3 w-3 bg-[#2196F3] rounded-full shadow -mt-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${volume}%`, transform: "translateX(-50%)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
