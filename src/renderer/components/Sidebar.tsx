import React, { useEffect, useState } from 'react'
import {
  HomeIcon,
  SearchIcon,
  LibraryIcon,
  PlusCircleIcon,
  HeartIcon,
  Download,
  Settings as SettingsIcon,
  Heart,
} from 'lucide-react'
import { ImportManagerPopup } from './ImportManagerPopup';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: (darkMode: boolean) => void;
}

export function Sidebar({ 
  currentView, 
  setCurrentView,
  isDarkMode,
  onToggleDarkMode
}: SidebarProps) {
  const menuItems = [
    {
      id: 'home',
      label: 'Home',
      icon: HomeIcon,
    },
    {
      id: 'search',
      label: 'Search',
      icon: SearchIcon,
    },
    {
      id: 'library',
      label: 'Your Library',
      icon: LibraryIcon,
    },
    {
      id: 'playlists',
      label: 'Create Playlist',
      icon: PlusCircleIcon,
    },
    {
      id: 'liked',
      label: 'Liked Songs',
      icon: HeartIcon,
    },
  ]
  const [activeImports, setActiveImports] = useState(0);
  const [showImportManager, setShowImportManager] = useState(false);

  // Escuchar actualizaciones de importaciones
  useEffect(() => {
    const updateImportCount = async () => {
      try {
        if (window.importManagerAPI) {
          const tasks = await window.importManagerAPI.getTasks();
          setActiveImports(tasks.length);
        }
      } catch (error) {
        console.error("Error obteniendo tareas de importación:", error);
      }
    };

    updateImportCount();

    const handleImportUpdate = () => {
      updateImportCount();
    };

    if (window.electronAPI) {
      window.electronAPI.on('import-manager', handleImportUpdate);
      
      return () => {
        if (window.electronAPI) {
          window.electronAPI.removeListener('import-manager', handleImportUpdate);
        }
      };
    }
  }, []);

  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[#2196F3]">Opentify</h1>
      </div>
      <nav className="flex-1">
        <ul>
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <button
                  className={`flex items-center w-full px-6 py-3 text-left transition-colors ${currentView === item.id ? 'text-[#2196F3] bg-[#F5F5F5] dark:bg-gray-800 font-medium' : 'text-gray-600 dark:text-gray-300 hover:bg-[#F5F5F5] dark:hover:bg-gray-800'}`}
                  onClick={() => setCurrentView(item.id)}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Import Manager Button - Solo mostrar si hay importaciones activas */}
      {activeImports > 0 && (
        <div className="px-4 mb-4">
          <button
            onClick={() => setShowImportManager(true)}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group"
          >
            <Download className="h-5 w-5 animate-pulse" />
            <span className="flex-1">Importando playlists...</span>
            <span className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs font-semibold min-w-[1.5rem] text-center">
              {activeImports}
            </span>
          </button>
        </div>
      )}

      {/* Settings Button */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
        <button 
          onClick={() => setCurrentView('settings')}
          className={`flex items-center w-full text-sm transition-colors ${currentView === 'settings' ? 'text-[#2196F3] font-medium' : 'text-gray-600 dark:text-gray-300 hover:text-[#2196F3] dark:hover:text-[#2196F3]'}`}
        >
          <SettingsIcon className="w-4 h-4 mr-2" />
          Settings
        </button>
        
        {/* Donation Button */}
        <button
          onClick={async () => {
            try {
              if (window.electronAPI?.invoke) {
                await window.electronAPI.invoke('open-external-link', 'https://paypal.me/adrus11');
              }
            } catch (error) {
              console.error('Error opening donation link:', error);
            }
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900 rounded-md hover:from-yellow-500 hover:to-yellow-600 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <Heart className="h-4 w-4" />
          Donate
        </button>
      </div>
      
      {showImportManager && (
        <ImportManagerPopup 
          isOpen={showImportManager}
          onClose={() => setShowImportManager(false)}
        />
      )}
    </div>
  );
}
