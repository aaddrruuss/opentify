import React, { useState, useRef, useEffect } from "react";
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  RepeatIcon,
  ShuffleIcon,
  Volume2Icon,
  VolumeXIcon,
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
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [lastVolume, setLastVolume] = useState(volume);
  const [draggedTime, setDraggedTime] = useState(0); // Tiempo que se mostrará mientras se arrastra
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Efecto para manejar eventos globales de mouse
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Manejar dragging del volumen
      if (isVolumeDragging && volumeRef.current) {
        const rect = volumeRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const newVolume = Math.round(percentage * 100);

        setIsMuted(false);
        onVolumeChange(newVolume);
      }

      // Manejar dragging del progreso
      if (isDragging && progressRef.current && duration) {
        const rect = progressRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const newTime = percentage * duration;

        // Solo actualizar el tiempo visual, no hacer seek hasta que se suelte
        setDraggedTime(newTime);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isVolumeDragging) {
        setIsVolumeDragging(false);
      }
      
      if (isDragging) {
        // Cuando se suelta el mouse, hacer el seek al tiempo arrastrado
        onSeek(draggedTime);
        setIsDragging(false);
        setDraggedTime(0);
      }
    };

    if (isVolumeDragging || isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.userSelect = 'none'; // Prevenir selección de texto durante drag
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.userSelect = ''; // Restaurar selección de texto
    };
  }, [isVolumeDragging, isDragging, onVolumeChange, onSeek, draggedTime, duration]);

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

    // Si no estamos arrastrando, hacer seek inmediatamente
    if (!isDragging) {
      onSeek(newTime);
    }
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;

    setIsDragging(true);
    
    // Calcular tiempo inicial del drag
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    setDraggedTime(newTime);
    e.preventDefault();
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeRef.current) return;

    const rect = volumeRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(x / rect.width, 1));
    const newVolume = Math.round(percentage * 100);

    setIsMuted(false);
    onVolumeChange(newVolume);
  };

  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsVolumeDragging(true);
    handleVolumeClick(e);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      onVolumeChange(lastVolume);
    } else {
      setLastVolume(volume);
      setIsMuted(true);
      onVolumeChange(0);
    }
  };

  const toggleShuffle = () => {
    setIsShuffle(!isShuffle);
  };

  const toggleRepeat = () => {
    const modes: Array<"off" | "all" | "one"> = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  };

  // Usar el tiempo arrastrado si estamos arrastrando, sino usar el tiempo actual
  const displayTime = isDragging ? draggedTime : currentTime;
  const progressPercentage = duration > 0 ? (displayTime / duration) * 100 : 0;
  const displayVolume = isMuted ? 0 : volume;

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-center mb-2">
        <button
          className={`mx-2 transition-colors ${
            isShuffle ? "text-[#2196F3]" : "text-gray-500 hover:text-[#2196F3] dark:text-gray-400 dark:hover:text-[#2196F3]"
          }`}
          onClick={toggleShuffle}
          title="Shuffle"
        >
          <ShuffleIcon className="h-4 w-4" />
        </button>

        <button
          className="mx-2 text-gray-500 hover:text-[#2196F3] dark:text-gray-400 dark:hover:text-[#2196F3] transition-colors"
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
          className="mx-2 text-gray-500 hover:text-[#2196F3] dark:text-gray-400 dark:hover:text-[#2196F3] transition-colors"
          onClick={onSkipForward}
          title="Next"
        >
          <SkipForwardIcon className="h-5 w-5" />
        </button>

        <button
          className={`mx-2 transition-colors ${
            repeatMode !== "off"
              ? "text-[#2196F3]"
              : "text-gray-500 hover:text-[#2196F3] dark:text-gray-400 dark:hover:text-[#2196F3]"
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
        <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
          {formatTime(displayTime)}
        </span>

        <div
          ref={progressRef}
          className="flex-1 mx-3 h-3 bg-gray-200 dark:bg-gray-700 rounded relative cursor-pointer group py-1"
          onClick={handleProgressClick}
          onMouseDown={handleProgressMouseDown}
        >
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded transform -translate-y-1/2">
            <div
              className="absolute h-full bg-[#2196F3] rounded pointer-events-none"
              style={{ width: `${progressPercentage}%` }}
            />
            <div
              className={`absolute h-3 w-3 bg-[#2196F3] rounded-full shadow top-1/2 transform -translate-y-1/2 pointer-events-none transition-opacity ${
                isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              style={{
                left: `${progressPercentage}%`,
                transform: "translateX(-50%) translateY(-50%)",
              }}
            />
          </div>
        </div>

        <span className="text-xs text-gray-500 dark:text-gray-400 w-10">
          {formatTime(duration)}
        </span>

        <div className="ml-6 flex items-center">
          <button
            onClick={toggleMute}
            className="text-gray-500 dark:text-gray-400 hover:text-[#2196F3] dark:hover:text-[#2196F3] mr-2 transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeXIcon className="h-4 w-4" />
            ) : (
              <Volume2Icon className="h-4 w-4" />
            )}
          </button>
          <div
            ref={volumeRef}
            className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded relative cursor-pointer group py-1"
            onClick={handleVolumeClick}
            onMouseDown={handleVolumeMouseDown}
          >
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded transform -translate-y-1/2">
              <div
                className="absolute h-full bg-[#2196F3] rounded pointer-events-none"
                style={{ width: `${displayVolume}%` }}
              />
              <div
                className={`absolute h-3 w-3 bg-[#2196F3] rounded-full shadow top-1/2 transform -translate-y-1/2 pointer-events-none transition-opacity ${
                  isVolumeDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                style={{ left: `${displayVolume}%`, transform: "translateX(-50%) translateY(-50%)" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
