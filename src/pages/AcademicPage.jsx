import React from 'react';

export default function AcademicPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-4">Academic Background</h2>
      <ul className="space-y-6">
        <li>
          <h3 className="text-xl font-semibold">M.S. in Computer Science</h3>
          <p className="text-gray-400">Vanderbilt University, May 2024</p>
          <p className="text-gray-400">3.74 GPA</p>
          <p className="mt-2">
            Notable Coursework : Artificial Intelligence, Machine Learning, Model-Based Development, Computer Networks, Parallel Programming, Web Based System Architecture
          </p>
          <p className="mt-2">
            Notable Projects : Civilization Simulation in Python (CS5260 - Introduction to Artificial Intelligence), Image Processor for Android in Java (CS5253 - Parallel Programming)
          </p>
        </li>
        <li>
          <h3 className="text-xl font-semibold">B.S. in Physics & Computer Engineering</h3>
          <p className="text-gray-400">Middle Tennessee State University, Dec 2022</p>
          <p className="text-gray-400">3.45 GPA</p>
          <p className="mt-2">Computer Engineering & Applied Physics Double Major, Minor in French.          
          </p>
          <p className="mt-2">
            Notable Coursework : Discrete Structures and Algorithms, Computer Architecture, Circuit Design, Microprocessor Design, Programming Language Design, Assembly and Computer Design
          </p>
          <p className="mt-2">
            Notable Projects : Working simulated model of an 8-bit computer using logic gates in Logisim (CSCI 3240 - Computer Systems) 
          </p>
        </li>
      </ul>
    </div>
  );
}
