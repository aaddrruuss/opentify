import React, { useState } from 'react';
import { Upload, FileText, Search, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Track } from '../types/index';

interface ImportPlaylistProps {
  onImportComplete: (tracks: Track[], playlistName: string) => void;
  onCancel: () => void;
  onSearch: (query: string) => Promise<Track[]>;
}

interface SpotifyTrack {
  trackName: string;
  artistName: string;
  durationMs: number;
}

interface ImportedTrack extends SpotifyTrack {
  status: 'pending' | 'searching' | 'found' | 'not_found';
  matchedTrack?: Track;
  searchResults?: Track[];
}

export function ImportPlaylist({ onImportComplete, onCancel, onSearch }: ImportPlaylistProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [importedTracks, setImportedTracks] = useState<ImportedTrack[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessing, setCurrentProcessing] = useState(-1);
  const [showResults, setShowResults] = useState(false);

  const parseCsv = (csvText: string): SpotifyTrack[] => {
    const lines = csvText.split('\n');
    const tracks: SpotifyTrack[] = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        // Parse CSV line - handle quoted fields
        const fields = parseCsvLine(line);
        
        if (fields.length >= 6) {
          const trackName = fields[1]?.replace(/"/g, '').trim();
          const artistName = fields[3]?.replace(/"/g, '').trim();
          const durationMs = parseInt(fields[5]?.replace(/"/g, '').trim());
          
          // Descartar canciones con nombre "UNDEFINED" (canciones corruptas)
          if (trackName && artistName && !isNaN(durationMs) && 
              trackName.toUpperCase() !== 'UNDEFINED') {
            tracks.push({
              trackName,
              artistName,
              durationMs
            });
          } else if (trackName.toUpperCase() === 'UNDEFINED') {
            console.log(`⚠️ Descartando canción corrupta: "${trackName}"`);
          }
        }
      } catch (error) {
        console.warn(`Error parsing line ${i + 1}:`, error);
      }
    }
    
    return tracks;
  };

  const parseCsvLine = (line: string): string[] => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    fields.push(current);
    return fields;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      // Extract playlist name from filename
      const fileName = file.name.replace('.csv', '');
      setPlaylistName(fileName);
    }
  };

  const searchForImport = async (query: string): Promise<Track[]> => {
    try {
      // Hacer la búsqueda directamente usando el musicAPI
      const results = await window.musicAPI.searchMusic(query);
      return results;
    } catch (error) {
      console.error('Error en búsqueda para importación:', error);
      return [];
    }
  };

  const findBestMatch = (searchResults: Track[], targetDurationMs: number): Track | null => {
    if (searchResults.length === 0) return null;
    
    let bestMatch = searchResults[0];
    let smallestDifference = Infinity;
    
    for (const track of searchResults) {
      // Convertir duración de "MM:SS" a millisegundos
      const durationParts = track.duration.split(':');
      if (durationParts.length !== 2) continue;
      
      const minutes = parseInt(durationParts[0]) || 0;
      const seconds = parseInt(durationParts[1]) || 0;
      const trackDurationMs = (minutes * 60 + seconds) * 1000;
      
      const difference = Math.abs(trackDurationMs - targetDurationMs);
      
      if (difference < smallestDifference) {
        smallestDifference = difference;
        bestMatch = track;
      }
    }
    
    // Solo retornar si la diferencia es menor a 60 segundos (60000ms)
    // Esto es más permisivo para compensar diferencias en versiones
    return smallestDifference <= 60000 ? bestMatch : null;
  };

  const processImport = async () => {
    if (!csvFile) return;
    
    setIsProcessing(true);
    setShowResults(true);
    
    try {
      const csvText = await csvFile.text();
      const spotifyTracks = parseCsv(csvText);
      
      const tracksToProcess: ImportedTrack[] = spotifyTracks.map(track => ({
        ...track,
        status: 'pending'
      }));
      
      console.log(`🚀 IMPORTACIÓN ROBUSTA: Procesando ${tracksToProcess.length} canciones`);
      setImportedTracks(tracksToProcess);
      
      // Configuración más conservadora para reducir ancho de banda
      const batchSize = 2; // Reducir a 2 para menor consumo
      const batchDelay = 3000; // Aumentar delay a 3 segundos
      const searchTimeout = 15000; // Aumentar timeout a 15 segundos
      const maxRetries = 1; // Reducir reintentos para evitar spam
      
      for (let i = 0; i < tracksToProcess.length; i += batchSize) {
        const batch = tracksToProcess.slice(i, i + batchSize);
        const batchNum = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(tracksToProcess.length / batchSize);
        
        console.log(`📦 Lote ${batchNum}/${totalBatches} - Procesando ${batch.length} canciones (modo conservador)`);
        
        // Procesar secuencialmente para reducir carga de red
        for (const track of batch) {
          const globalIndex = i + batch.indexOf(track);
          setCurrentProcessing(globalIndex);
          
          track.status = 'searching';
          setImportedTracks([...tracksToProcess]);
          
          let retryCount = 0;
          let searchSuccessful = false;
          
          while (retryCount < maxRetries && !searchSuccessful) {
            try {
              // Query más limpia y simple
              const cleanTitle = track.trackName.replace(/[^\w\s]/g, '').trim();
              const mainArtist = track.artistName.split(',')[0].split('&')[0].split('feat')[0].trim();
              const searchQuery = `${mainArtist} ${cleanTitle}`.substring(0, 50);
              
              console.log(`🔍 [${globalIndex + 1}/${tracksToProcess.length}] "${searchQuery}"`);
              
              // Búsqueda con timeout y manejo de errores HTTP
              const searchPromise = window.musicAPI.searchMusic(searchQuery);
              const timeoutPromise = new Promise<Track[]>((_, reject) => 
                setTimeout(() => reject(new Error('Search timeout')), searchTimeout)
              );
              
              const searchResults = await Promise.race([searchPromise, timeoutPromise]);
              track.searchResults = searchResults;
              
              // Si llegamos aquí, la búsqueda fue exitosa
              searchSuccessful = true;
              
              // Buscar la mejor coincidencia
              const bestMatch = findBestMatchByDuration(searchResults, track.durationMs);
              
              if (bestMatch) {
                track.matchedTrack = {
                  ...bestMatch,
                  title: track.trackName,
                  artist: track.artistName
                };
                track.status = 'found';
                console.log(`✅ [${globalIndex + 1}/${tracksToProcess.length}] Encontrada`);
              } else {
                track.status = 'not_found';
                console.log(`⚠️ [${globalIndex + 1}/${tracksToProcess.length}] Sin coincidencia`);
              }
              
            } catch (error) {
              retryCount++;
              const errorMsg = error instanceof Error ? error.message : String(error);
              console.error(`💥 Error intento ${retryCount}: ${errorMsg}`);
              
              if (retryCount < maxRetries) {
                // Esperar más tiempo si es un error HTTP
                const waitTime = errorMsg.includes('403') ? 5000 : 2000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
              } else {
                track.status = 'not_found';
                console.error(`❌ Falló definitivamente: ${track.trackName}`);
              }
            }
          }
          
          setImportedTracks([...tracksToProcess]);
          
          // Pequeño delay entre canciones individuales
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Delay más largo entre lotes
        if (i + batchSize < tracksToProcess.length) {
          console.log(`⏸️ Pausa de ${batchDelay/1000}s para reducir carga de red...`);
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }
      
      const foundCount = tracksToProcess.filter(t => t.status === 'found').length;
      const notFoundCount = tracksToProcess.filter(t => t.status === 'not_found').length;
      console.log(`🏁 IMPORTACIÓN COMPLETADA: ${foundCount} encontradas, ${notFoundCount} no encontradas`);
      
    } catch (error) {
      console.error('Error crítico procesando CSV:', error);
    } finally {
      setIsProcessing(false);
      setCurrentProcessing(-1);
    }
  };

  // Algoritmo de matching MÁS PERMISIVO para acelerar
  const findBestMatchByDuration = (searchResults: Track[], targetDurationMs: number): Track | null => {
    if (searchResults.length === 0) return null;
    
    let bestMatch = searchResults[0];
    let smallestDifference = Infinity;
    
    for (const track of searchResults) {
      const durationParts = track.duration.split(':');
      if (durationParts.length !== 2) continue;
      
      const minutes = parseInt(durationParts[0]) || 0;
      const seconds = parseInt(durationParts[1]) || 0;
      const trackDurationMs = (minutes * 60 + seconds) * 1000;
      
      const difference = Math.abs(trackDurationMs - targetDurationMs);
      
      if (difference < smallestDifference) {
        smallestDifference = difference;
        bestMatch = track;
      }
    }
    
    // Ser MÁS PERMISIVO: aceptar hasta 5 minutos de diferencia para acelerar
    const maxDifference = 300000; // 5 minutos en ms
    return smallestDifference <= maxDifference ? bestMatch : null;
  };

  const handleImport = async () => {
    const successfulTracks = importedTracks
      .filter(track => track.status === 'found' && track.matchedTrack)
      .map(track => track.matchedTrack!);
    
    if (successfulTracks.length === 0) {
      console.log("No hay canciones para importar");
      return;
    }
    
    try {
      // Crear la playlist con persistencia
      console.log(`💾 Guardando playlist "${playlistName}" con ${successfulTracks.length} canciones...`);
      await window.playlistAPI.savePlaylist(playlistName, successfulTracks);
      console.log(`✅ Playlist "${playlistName}" guardada exitosamente`);
      
      onImportComplete(successfulTracks, playlistName);
    } catch (error) {
      console.error("Error guardando playlist:", error);
      // Aún así completar la importación aunque falle el guardado
      onImportComplete(successfulTracks, playlistName);
    }
  };

  const getStatusIcon = (status: ImportedTrack['status']) => {
    switch (status) {
      case 'searching':
        return <Search className="h-4 w-4 animate-spin text-blue-500" />;
      case 'found':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'not_found':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  const foundCount = importedTracks.filter(t => t.status === 'found').length;
  const totalCount = importedTracks.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Importar Playlist de Spotify
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!showResults && (
            <>
              {/* File Upload */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Archivo CSV de Spotify
                  </label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {csvFile ? (
                          <>
                            <FileText className="h-8 w-8 text-green-500 mb-2" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {csvFile.name}
                            </p>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-gray-400 mb-2" />
                            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                              <span className="font-semibold">Click para subir</span> o arrastra el archivo
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Archivos CSV de Spotify
                            </p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".csv"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>

                {/* Playlist Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre de la Playlist
                  </label>
                  <input
                    type="text"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2196F3] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Mi Playlist de Spotify"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  ¿Cómo obtener el CSV de Spotify?
                </h3>
                <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>1. Ve a tu cuenta de Spotify y solicita tus datos</li>
                  <li>2. Descarga el archivo CSV de tu playlist</li>
                  <li>3. Sube el archivo aquí para importar las canciones</li>
                </ol>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={processImport}
                  disabled={!csvFile || !playlistName.trim() || isProcessing}
                  className="flex-1 px-4 py-2 bg-[#2196F3] text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Procesando...' : 'Importar Playlist'}
                </button>
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}

          {/* Results */}
          {showResults && (
            <>
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Progreso: {foundCount}/{totalCount} canciones encontradas
                  </span>
                  {isProcessing && (
                    <span className="text-blue-500">
                      Buscando canción {currentProcessing + 1}/{totalCount}...
                    </span>
                  )}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-[#2196F3] h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${totalCount > 0 ? ((currentProcessing + 1) / totalCount) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Track List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {importedTracks.map((track, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      track.status === 'found'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : track.status === 'not_found'
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    {getStatusIcon(track.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {track.trackName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {track.artistName} • {Math.round(track.durationMs / 1000)}s
                      </p>
                      {track.matchedTrack && (
                        <p className="text-xs text-green-600 dark:text-green-400 truncate">
                          → {track.matchedTrack.title}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Final Actions */}
              {!isProcessing && (
                <div className="flex gap-3">
                  <button
                    onClick={handleImport}
                    disabled={foundCount === 0}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Importar {foundCount} canciones
                  </button>
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
