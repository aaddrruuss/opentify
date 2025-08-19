import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  
  const menuItems = [
    {
      id: 'home',
      label: t('nav.main_menu'),
      icon: HomeIcon,
    },
    {
      id: 'search',
      label: t('nav.search'),
      icon: SearchIcon,
    },
    {
      id: 'playlists',
      label: t('nav.your_library'),
      icon: LibraryIcon,
    },
    {
      id: 'liked',
      label: t('nav.liked_songs'),
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
    <div className="w-64 bg-white dark:bg-black flex flex-col h-full border-r border-gray-200 dark:border-gray-800">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold text-black dark:text-white">{t('app.title')}</h1>
      </div>
      <nav className="flex-1 px-3">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <button
                  className={`flex items-center w-full px-3 py-2 text-left transition-colors rounded-md ${
                    currentView === item.id 
                      ? 'text-black dark:text-white bg-gray-200 dark:bg-gray-800 font-medium' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                  onClick={() => setCurrentView(item.id)}
                >
                  <Icon className="w-6 h-6 mr-3" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Import Manager Button - Solo mostrar si hay importaciones activas */}
      {activeImports > 0 && (
        <div className="px-6 mb-4">
          <button
            onClick={() => setShowImportManager(true)}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-blue-400 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors group"
          >
            <Download className="h-5 w-5 animate-pulse" />
            <span className="flex-1">{t('import.importing_playlists')}</span>
            <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs font-semibold min-w-[1.5rem] text-center">
              {activeImports}
            </span>
          </button>
        </div>
      )}

      {/* Settings and Donation Buttons */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-800 space-y-3 pb-24">
        <button 
          onClick={() => setCurrentView('settings')}
          className="flex items-center w-full text-sm transition-colors justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-black dark:hover:text-white"
        >
          <SettingsIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span className="font-medium">{t('nav.settings')}</span>
        </button>

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
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-400 to-blue-500 text-white rounded-md hover:from-blue-500 hover:to-blue-600 transition-all duration-200 font-medium text-sm transform hover:scale-105"
        >
          <Heart className="h-4 w-4" />
          {t('nav.support_opentify')}
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
