import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { NowPlaying } from './components/NowPlaying';
import { MusicLibrary } from './components/MusicLibrary';
import { PlayerControls } from './components/PlayerControls';
import { musicService } from './services/musicService';
import { Track } from './types';

export function App() {
  const [currentView, setCurrentView] = useState('home');
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);

  useEffect(() => {
    // Configurar listeners del servicio de música
    musicService.onTimeUpdate((time) => {
      setCurrentTime(time);
      setDuration(musicService.getDuration());
    });

    musicService.onEnded(() => {
      setIsPlaying(false);
      // Aquí podrías implementar reproducción automática de la siguiente canción
    });

    // Establecer volumen inicial
    musicService.setVolume(volume);
  }, []);

  const handlePlayPause = async () => {
    if (!currentTrack) return;

    try {
      if (isPlaying) {
        musicService.pause();
        setIsPlaying(false);
      } else {
        if (currentTime > 0) {
          musicService.resume();
        } else {
          await musicService.play(currentTrack);
        }
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error al reproducir/pausar:', error);
      setIsPlaying(false);
    }
  };

  const handleTrackSelect = async (track: Track) => {
    try {
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(0);
      await musicService.play(track);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error al seleccionar pista:', error);
      setIsPlaying(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsLoading(true);
    setSearchQuery(query);
    
    try {
      const results = await window.musicAPI.searchMusic(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error en búsqueda:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeek = (time: number) => {
    musicService.seek(time);
    setCurrentTime(time);
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    musicService.setVolume(newVolume);
  };

  const handleSkipForward = () => {
    // Implementar lógica para siguiente canción
    console.log('Siguiente canción');
  };

  const handleSkipBack = () => {
    // Implementar lógica para canción anterior
    if (currentTime > 3) {
      handleSeek(0);
    } else {
      console.log('Canción anterior');
    }
  };

  return (
    <div className="flex h-screen w-full bg-white text-gray-800">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
          <MusicLibrary
            onTrackSelect={handleTrackSelect}
            currentView={currentView}
            searchResults={searchResults}
            onSearch={handleSearch}
            isLoading={isLoading}
            searchQuery={searchQuery}
          />
        </main>
        
        {currentTrack && (
          <div className="flex flex-col bg-white border-t border-gray-200">
            <NowPlaying
              track={currentTrack}
              isPlaying={isPlaying}
            />
            <PlayerControls
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
              volume={volume}
              onVolumeChange={handleVolumeChange}
              onSkipForward={handleSkipForward}
              onSkipBack={handleSkipBack}
            />
          </div>
        )}
      </div>
    </div>
  );
}