import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-gray-800 border-t border-gray-700">
      <div className="max-w-4xl mx-auto p-4 text-center text-gray-400">
        Contact: email@example.com | 
        <a href="https://linkedin.com/in/your-profile" className="hover:text-white">LinkedIn</a> | 
        <a href="https://github.com/nelsontorresjr330" className="hover:text-white">GitHub</a>
      </div>
    </footer>
  );
}
