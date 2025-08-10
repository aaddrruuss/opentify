import React from 'react';
import { Track } from '../types';

interface NowPlayingProps {
  track: Track;
  isPlaying: boolean;
  isDownloading?: boolean;
}

export function NowPlaying({ track, isPlaying, isDownloading = false }: NowPlayingProps) {
  const getImageUrl = () => {
    console.log("NowPlaying track data:", track); // Debug log
    
    // Priorizar thumbnail sobre cover
    let imageUrl = track.thumbnail || track.cover;
    
    if (imageUrl) {
      console.log("NowPlaying using image URL:", imageUrl); // Debug log
      return imageUrl;
    }
    
    // Construir URL de YouTube si tenemos el ID
    if (track.id && track.id !== 'demo1') {
      const youtubeUrl = `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
      console.log("NowPlaying using YouTube URL:", youtubeUrl); // Debug log
      return youtubeUrl;
    }
    
    const fallbackUrl = 'https://via.placeholder.com/56x56/cccccc/666666?text=♪';
    console.log("NowPlaying using fallback URL:", fallbackUrl); // Debug log
    return fallbackUrl;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    const currentSrc = target.src;
    
    console.log("NowPlaying image error for:", currentSrc); // Debug log
    
    // Secuencia de fallbacks para YouTube
    if (currentSrc.includes('maxresdefault')) {
      target.src = `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
    } else if (currentSrc.includes('hqdefault')) {
      target.src = `https://img.youtube.com/vi/${track.id}/mqdefault.jpg`;
    } else if (currentSrc.includes('mqdefault')) {
      target.src = `https://img.youtube.com/vi/${track.id}/default.jpg`;
    } else {
      // Último fallback
      target.src = 'https://via.placeholder.com/56x56/cccccc/666666?text=♪';
    }
    
    console.log("NowPlaying fallback to:", target.src); // Debug log
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.log("NowPlaying image loaded successfully:", e.currentTarget.src); // Debug log
  };

  return (
    <div className="flex items-center p-4">
      <div className="w-14 h-14 mr-4 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden border dark:border-gray-600 relative">
        <img
          src={getImageUrl()}
          alt={`${track.title} cover`}
          className="w-full h-full object-cover"
          onError={handleImageError}
          onLoad={handleImageLoad}
          crossOrigin="anonymous"
        />
        {isDownloading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm truncate text-gray-900 dark:text-gray-100">
          {track.title}
          {isDownloading && (
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              (Descargando...)
            </span>
          )}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{track.artist}</p>
      </div>
      <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-[#2196F3] dark:hover:text-[#2196F3] flex-shrink-0 transition-colors">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      </button>
    </div>
  );
}
