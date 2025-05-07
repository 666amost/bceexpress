import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTruck, faCreditCard } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';

const menuItems = [
  { key: 'transaction', label: 'Transaction', icon: faTruck, sub: [
    { key: 'input_resi', label: 'Input Resi' },
    { key: 'search_manifest', label: 'Search Manifest' },
    { key: 'pelunasan', label: 'Pelunasan Resi' },
  ] },
  { key: 'payment', label: 'Data Payment', icon: faCreditCard },
];

export default function SidebarDashboard({ selectedMenu, setSelectedMenu, selectedSubMenu, setSelectedSubMenu }) {
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let touchStartX = 0;

    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const swipeDistance = touchEndX - touchStartX;

      if (touchStartX > 50 && swipeDistance > 50) {
        setIsOpen(true);
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const toggleSubmenu = (itemKey) => {
    if (openSubmenu === itemKey) {
      setOpenSubmenu(null);
    } else {
      setSelectedMenu(itemKey);
      setOpenSubmenu(itemKey);
      if (menuItems.find(item => item.key === itemKey)?.sub) {
        setSelectedSubMenu(menuItems.find(item => item.key === itemKey).sub[0].key);
      }
    }
  };

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden" 
          onClick={toggleSidebar}
        ></div>
      )}
      <aside
        className={`fixed top-0 left-0 h-screen w-full md:w-72 z-50 bg-white flex flex-col select-none border-r border-gray-200 shadow-xl p-4 md:p-6 transition-all duration-300 overflow-y-auto transform ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-300">
          <span className="text-2xl font-extrabold tracking-widest text-black font-sans">Branch</span>
          <button
            onClick={toggleSidebar}
            className="md:hidden text-white bg-blue-600 p-2 rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            <span className="sr-only">Toggle Sidebar</span>
          </button>
        </div>
        <nav className="flex-1 mt-4 px-2 md:px-4">
          <ul className="space-y-2">
            {menuItems.map(item => (
              <li key={item.key}>
                <button
                  className={`w-full flex items-center gap-4 px-4 py-3 text-base font-medium rounded-lg transition-all duration-200
                    ${selectedMenu === item.key ? 'bg-gray-100 text-black shadow-sm' : 'hover:bg-gray-200 text-gray-800'}`}
                  onClick={() => toggleSubmenu(item.key)}
                >
                  <FontAwesomeIcon icon={item.icon} className="text-xl transition-transform duration-200 transform hover:scale-110 text-gray-800" />
                  <span className="transition-colors duration-200">{item.label}</span>
                </button>
                {item.sub && openSubmenu === item.key && (
                  <ul className="ml-4 md:ml-8 mt-2 space-y-1 max-h-60 overflow-y-auto">
                    {item.sub.map(sub => (
                      <li key={sub.key}>
                        <button
                          className={`w-full text-left px-3 py-2 rounded transition-all duration-200
                            ${selectedSubMenu === sub.key ? 'bg-gray-100 text-black font-semibold' : 'hover:bg-gray-200 text-gray-800'}`}
                          onClick={() => setSelectedSubMenu(sub.key)}
                        >
                          {sub.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
} 