import React from 'react'
import {
  HomeIcon,
  SearchIcon,
  LibraryIcon,
  PlusCircleIcon,
  HeartIcon,
  MoonIcon,
  SunIcon,
} from 'lucide-react'

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export function Sidebar({ currentView, setCurrentView, isDarkMode, toggleDarkMode }: SidebarProps) {
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
  return (
    <div className="w-64 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[#2196F3]">Music Player</h1>
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
      <div className="p-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
        <button 
          onClick={toggleDarkMode}
          className="flex items-center w-full text-sm text-gray-600 dark:text-gray-300 hover:text-[#2196F3] dark:hover:text-[#2196F3] transition-colors"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <SunIcon className="w-4 h-4 mr-2" /> : <MoonIcon className="w-4 h-4 mr-2" />}
          {isDarkMode ? "Light Mode" : "Dark Mode"}
        </button>
        <button className="text-sm text-gray-600 dark:text-gray-300 hover:text-[#2196F3] dark:hover:text-[#2196F3] transition-colors">
          Install App
        </button>
      </div>
    </div>
  )
}
