import React from 'react';
import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-4xl mx-auto flex items-center justify-between p-4">
        <h1 className="text-2xl font-semibold">Nelson Torres</h1>
        <nav>
          <ul className="flex space-x-6">
            <li><Link to="/" className="text-gray-400 hover:text-white">Home</Link></li>
            <li><Link to="/work" className="text-gray-400 hover:text-white">Work Experience</Link></li>
            <li><Link to="/projects" className="text-gray-400 hover:text-white">Personal Projects</Link></li>
            <li><Link to="/academic" className="text-gray-400 hover:text-white">Academic</Link></li>
            <li><Link to="/personal" className="text-gray-400 hover:text-white">Personal</Link></li>
          </ul>
        </nav>
      </div>
    </header>
);
}
