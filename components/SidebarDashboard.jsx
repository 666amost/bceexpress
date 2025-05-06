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
      className="fixed top-0 left-0 h-screen w-72 z-50 bg-gradient-to-b from-blue-900 via-navy-900 to-blue-800 flex flex-col select-none border-none shadow-xl"
      style={{ borderRadius: 0, margin: 0, padding: 0 }}
    >
      <div className="flex items-center justify-center p-6 border-b border-blue-800">
        <span className="text-2xl font-extrabold tracking-widest text-black font-sans">Branch</span>
      </div>
      <nav className="flex-1 mt-4 px-4">
        <ul className="space-y-2">
          {menuItems.map(item => (
            <li key={item.key}>
              <button
                className={`w-full flex items-center gap-4 px-4 py-3 text-base font-medium rounded-lg transition-all duration-200
                  ${selectedMenu === item.key ? 'bg-blue-200 text-black shadow-lg' : 'hover:bg-blue-100 text-black'}`}
                onClick={() => {
                  setSelectedMenu(item.key);
                  if (item.sub) setSelectedSubMenu(item.sub[0].key);
                  else setSelectedSubMenu(null);
                }}
              >
                <FontAwesomeIcon icon={item.icon} className="text-xl transition-transform duration-200 transform hover:scale-110 text-black" />
                <span className="transition-colors duration-200">{item.label}</span>
              </button>
              {item.sub && selectedMenu === item.key && (
                <ul className="ml-8 mt-2 space-y-1">
                  {item.sub.map(sub => (
                    <li key={sub.key}>
                      <button
                        className={`w-full text-left px-3 py-2 rounded transition-all duration-200
                          ${selectedSubMenu === sub.key ? 'bg-blue-300 text-black font-semibold' : 'hover:bg-blue-100 text-gray-900'}`}
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