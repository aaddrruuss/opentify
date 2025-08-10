import React from 'react'
import {
  HomeIcon,
  SearchIcon,
  LibraryIcon,
  PlusCircleIcon,
  HeartIcon,
} from 'lucide-react'

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
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
    <div className="w-64 h-full bg-white border-r border-gray-200 flex flex-col">
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
                  className={`flex items-center w-full px-6 py-3 text-left ${currentView === item.id ? 'text-[#2196F3] bg-[#F5F5F5] font-medium' : 'text-gray-600 hover:bg-[#F5F5F5]'}`}
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
      <div className="p-6 border-t border-gray-200">
        <button className="text-sm text-gray-600 hover:text-[#2196F3]">
          Install App
        </button>
      </div>
    </div>
  )
}
