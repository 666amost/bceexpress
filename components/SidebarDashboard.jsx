import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTruck, faCreditCard } from '@fortawesome/free-solid-svg-icons';

const menuItems = [
  { key: 'awb', label: 'AWB', icon: faTruck, sub: [
    { key: 'input', label: 'Input AWB' },
    { key: 'pelunasan', label: 'Pelunasan Resi' },
  ] },
  { key: 'payment', label: 'Data Payment', icon: faCreditCard },
];

export default function SidebarDashboard({ selectedMenu, setSelectedMenu, selectedSubMenu, setSelectedSubMenu }) {
  return (
    <aside
      className="fixed top-0 left-0 h-screen w-full md:w-72 z-50 bg-white flex flex-col select-none border-r border-gray-200 shadow-xl p-4 md:p-6 transition-all duration-300 overflow-y-auto"
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-300">
        <span className="text-2xl font-extrabold tracking-widest text-black font-sans">Branch</span>
      </div>
      <nav className="flex-1 mt-4 px-2 md:px-4">
        <ul className="space-y-2">
          {menuItems.map(item => (
            <li key={item.key}>
              <button
                className={`w-full flex items-center gap-4 px-4 py-3 text-base font-medium rounded-lg transition-all duration-200
                  ${selectedMenu === item.key ? 'bg-gray-100 text-black shadow-sm' : 'hover:bg-gray-200 text-gray-800'}`}
                onClick={() => {
                  setSelectedMenu(item.key);
                  if (item.sub) setSelectedSubMenu(item.sub[0].key);
                  else setSelectedSubMenu(null);
                }}
              >
                <FontAwesomeIcon icon={item.icon} className="text-xl transition-transform duration-200 transform hover:scale-110 text-gray-800" />
                <span className="transition-colors duration-200">{item.label}</span>
              </button>
              {item.sub && selectedMenu === item.key && (
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
  );
} 