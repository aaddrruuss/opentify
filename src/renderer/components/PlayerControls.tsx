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
  onMuteToggle: (muted: boolean) => void;
  isMuted: boolean;
  repeatMode: "off" | "all" | "one";
  onRepeatModeChange: (mode: "off" | "all" | "one") => void;
  isShuffle: boolean;
  onShuffleToggle: (shuffle: boolean) => void;
  onSkipForward: () => void;
  onSkipBack: () => void;
  isDownloading?: boolean;
  isLoadingAudio?: boolean;
  currentTrack?: {
    id: string;
    title: string;
    artist: string;
    cover?: string;
    duration: string;
  } | null;
  playlistInfo?: {
    name: string;
    current: number;
    total: number;
  };
}

export function PlayerControls({
  isPlaying,
  onPlayPause,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  onMuteToggle,
  isMuted,
  repeatMode,
  onRepeatModeChange,
  isShuffle,
  onShuffleToggle,
  onSkipForward,
  onSkipBack,
  isDownloading = false,
  isLoadingAudio = false,
  currentTrack,
  playlistInfo,
}: PlayerControlsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);
  const [draggedTime, setDraggedTime] = useState(0);
  const [lastVolume, setLastVolume] = useState(volume);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Actualizar lastVolume cuando volume cambie externamente
  useEffect(() => {
    if (volume > 0 && !isMuted) {
      setLastVolume(volume);
    }
  }, [volume, isMuted]);

  // Efecto para manejar eventos globales de mouse
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Manejar dragging del volumen
      if (isVolumeDragging && volumeRef.current) {
        const rect = volumeRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const newVolume = Math.round(percentage * 100);

        if (isMuted && newVolume > 0) {
          onMuteToggle(false);
        }
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

    onMuteToggle(false);
    onVolumeChange(newVolume);
  };

  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsVolumeDragging(true);
    handleVolumeClick(e);
  };

  const toggleMute = () => {
    if (isMuted) {
      onMuteToggle(false);
      onVolumeChange(lastVolume);
    } else {
      setLastVolume(volume);
      onMuteToggle(true);
      onVolumeChange(0);
    }
  };

  const toggleShuffle = () => {
    onShuffleToggle(!isShuffle);
  };

  const toggleRepeat = () => {
    const modes: Array<"off" | "all" | "one"> = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    onRepeatModeChange(modes[nextIndex]);
  };

  // Usar el tiempo arrastrado si estamos arrastrando, sino usar el tiempo actual
  const displayTime = isDragging ? draggedTime : currentTime;
  const progressPercentage = duration > 0 ? (displayTime / duration) * 100 : 0;
  const displayVolume = isMuted ? 0 : volume;

  const isPlayButtonDisabled = isDownloading || isLoadingAudio;
  const areSkipButtonsDisabled = false; // Skip buttons are always enabled
  const areOtherControlsDisabled = isDownloading; // Other controls disabled only during download

  return (
    <div className="bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between w-full h-20 fixed bottom-0 left-0 right-0 z-40">
      {/* Columna izquierda - Información de la canción actual */}
      <div className="flex items-center space-x-3 w-1/3 min-w-0">
        {currentTrack && (
          <>
            <div className="relative flex-shrink-0">
              {currentTrack.cover ? (
                <img
                  src={currentTrack.cover}
                  alt={currentTrack.title}
                  className="w-14 h-14 rounded object-cover"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`absolute inset-0 w-14 h-14 bg-gray-300 dark:bg-gray-600 rounded flex items-center justify-center ${currentTrack.cover ? 'hidden' : 'flex'}`}>
                <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-black dark:text-white text-sm font-medium truncate">
                {currentTrack.title}
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-xs truncate">
                {currentTrack.artist}
                {playlistInfo && playlistInfo.total > 1 && (
                  <span> • {playlistInfo.current}/{playlistInfo.total} en "{playlistInfo.name}"</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Columna central - Controles principales y barra de progreso */}
      <div className="flex flex-col items-center w-1/3 max-w-lg">
        {/* Controles de reproducción */}
        <div className="flex items-center space-x-2 mb-2">
          <button
            className={`transition-colors hover:scale-105 ${
              isShuffle ? "text-[#2196F3]" : "text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"
            } ${areOtherControlsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={toggleShuffle}
            disabled={areOtherControlsDisabled}
            title="Shuffle"
          >
            <ShuffleIcon className="h-4 w-4" />
          </button>

          <button
            className={`text-gray-400 hover:text-white transition-colors hover:scale-105 ${
              areSkipButtonsDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={onSkipBack}
            disabled={areSkipButtonsDisabled}
            title="Previous"
          >
            <SkipBackIcon className="h-5 w-5" />
          </button>

          <button
            className={`p-2 rounded-full bg-black dark:bg-white text-white dark:text-black hover:scale-105 transition-all duration-200 ${
              isPlayButtonDisabled ? 'opacity-75 cursor-not-allowed' : 'hover:bg-gray-800 dark:hover:bg-gray-200'
            }`}
            onClick={onPlayPause}
            disabled={isPlayButtonDisabled}
            title={
              isDownloading ? "Descargando canción..." : 
              isLoadingAudio ? "Cargando audio..." : 
              (isPlaying ? "Pause" : "Play")
            }
          >
            {isDownloading || isLoadingAudio ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white dark:border-black border-t-transparent" />
            ) : isPlaying ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4 ml-0.5" />
            )}
          </button>

          <button
            className={`text-gray-400 hover:text-white transition-colors hover:scale-105 ${
              areSkipButtonsDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={onSkipForward}
            disabled={areSkipButtonsDisabled}
            title="Next"
          >
            <SkipForwardIcon className="h-5 w-5" />
          </button>

          <button
            className={`transition-colors hover:scale-105 ${
              repeatMode !== "off"
                ? "text-[#2196F3]"
                : "text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"
            } ${areOtherControlsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={toggleRepeat}
            disabled={areOtherControlsDisabled}
            title={`Repeat: ${repeatMode}`}
          >
            <div className="relative">
              <RepeatIcon className="h-4 w-4" />
              {repeatMode === "one" && (
                <span className="absolute -top-1 -right-1 text-xs font-bold bg-[#2196F3] text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px]">
                  1
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Barra de progreso */}
        <div className="flex items-center w-full space-x-2">
          <span className="text-xs text-gray-600 dark:text-gray-400 w-10 text-right">
            {formatTime(displayTime)}
          </span>

          <div
            ref={progressRef}
            className={`flex-1 h-3 bg-gray-300 dark:bg-gray-600 rounded-full relative group py-1 ${
              areOtherControlsDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
            onClick={!areOtherControlsDisabled ? handleProgressClick : undefined}
            onMouseDown={!areOtherControlsDisabled ? handleProgressMouseDown : undefined}
          >
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-300 dark:bg-gray-600 rounded-full transform -translate-y-1/2">
              <div
                className="absolute h-full bg-black dark:bg-white rounded-full transition-all group-hover:bg-[#2196F3]"
                style={{ width: `${progressPercentage}%` }}
              />
              {!isDownloading && (
                <div
                  className={`absolute h-3 w-3 bg-black dark:bg-white rounded-full shadow-lg top-1/2 transform -translate-y-1/2 transition-opacity group-hover:bg-[#2196F3] ${
                    isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  style={{
                    left: `${progressPercentage}%`,
                    transform: "translateX(-50%) translateY(-50%)",
                  }}
                />
              )}
            </div>
          </div>

          <span className="text-xs text-gray-600 dark:text-gray-400 w-10">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Columna derecha - Control de volumen */}
      <div className="flex items-center space-x-2 w-1/3 justify-end">
        <button
          onClick={toggleMute}
          className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors hover:scale-105"
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
          className="w-24 h-3 bg-gray-300 dark:bg-gray-600 rounded-full relative cursor-pointer group py-1"
          onClick={handleVolumeClick}
          onMouseDown={handleVolumeMouseDown}
        >
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-300 dark:bg-gray-600 rounded-full transform -translate-y-1/2">
            <div
              className="absolute h-full bg-black dark:bg-white rounded-full transition-all group-hover:bg-[#2196F3]"
              style={{ width: `${displayVolume}%` }}
            />
            <div
              className={`absolute h-3 w-3 bg-black dark:bg-white rounded-full shadow-lg top-1/2 transform -translate-y-1/2 transition-opacity group-hover:bg-[#2196F3] ${
                isVolumeDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              style={{ left: `${displayVolume}%`, transform: "translateX(-50%) translateY(-50%)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
