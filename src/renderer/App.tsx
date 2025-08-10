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
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Recuperar preferencia de modo oscuro del localStorage
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    // Aplicar clase de modo oscuro al documento
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Guardar preferencia en localStorage
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

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
  }, [volume]);

  const handlePlayPause = async () => {
    if (!currentTrack) return;

    try {
      if (isPlaying) {
        musicService.pause();
        setIsPlaying(false);
      } else {
        // Si hay una canción pausada, reanudar; si no, reproducir desde el inicio
        if (musicService.getCurrentTrack()?.id === currentTrack.id && musicService.getCurrentTime() > 0) {
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
    
    // Limpiar la query para mostrar (quitar "audio" automático para la visualización)
    const displayQuery = query.replace(/ audio$/, '').trim();
    setSearchQuery(displayQuery);
    
    try {
      console.log("Buscando con query:", query); // Debug: mostrar query real
      const results = await window.musicAPI.searchMusic(query);
      console.log("Resultados obtenidos:", results.length); // Debug: mostrar cantidad de resultados
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

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
      />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-[#F5F5F5] dark:bg-gray-800 p-6 transition-colors">
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
          <div className="flex flex-col bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 transition-colors">
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