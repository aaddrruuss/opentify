import React from 'react';
import { Sun, Moon, Volume2 } from 'lucide-react';

interface SettingsViewProps {
  isDarkMode: boolean;
  onToggleDarkMode: (darkMode: boolean) => void;
}

export function SettingsView({ isDarkMode, onToggleDarkMode }: SettingsViewProps) {
  const handleDarkModeToggle = () => {
    onToggleDarkMode(!isDarkMode);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Configuración
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Personaliza la apariencia de la aplicación
        </p>
      </div>

      {/* Apariencia */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              {isDarkMode ? (
                <Moon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <Sun className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Apariencia
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cambia entre tema claro y oscuro
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                {isDarkMode ? (
                  <Moon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Sun className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Modo Oscuro
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Activa o desactiva el tema oscuro
                  </p>
                </div>
              </div>
              
              {/* Switch */}
              <button
                onClick={handleDarkModeToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2196F3] focus:ring-offset-2 ${
                  isDarkMode 
                    ? 'bg-[#2196F3]' 
                    : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDarkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
