import React from 'react';

export default function AcademicPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h2 className="text-3xl font-bold">Academic Background</h2>

        <div className="bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold">PhD in Computational and Data Sciences</h3>
        <p className="text-gray-400 mt-1">Middle Tennessee State University</p>
        <p className="mt-2">
          <strong>Notable Coursework:</strong> Advanced Concepts in Computational Science, Research Seminar in Computational Science
        </p>
        <p className="mt-2">
          <strong>Anticipated Field of Research:</strong> Artificial Intelligence, Machine Learning
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold">M.S. in Computer Science</h3>
        <p className="text-gray-400 mt-1">Vanderbilt University, May 2024 | GPA: 3.74</p>
        <p className="mt-2">
          <strong>Notable Coursework:</strong> Artificial Intelligence, Machine Learning, Model-Based Development, Computer Networks, Parallel Programming, Web-Based System Architecture
        </p>
        <p className="mt-2">
          <strong>Notable Projects:</strong> Civilization Simulation in Python (CS5260 – Intro to AI), Image Processor for Android in Java (CS5253 – Parallel Programming)
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold">B.S. in Physics &amp; Computer Engineering</h3>
        <p className="text-gray-400 mt-1">Middle Tennessee State University, Dec 2022 | GPA: 3.45</p>
        <p className="mt-2">
          Double Major in Computer Engineering &amp; Applied Physics; Minor in French.
        </p>
        <p className="mt-2">
          <strong>Notable Coursework:</strong> Discrete Structures & Algorithms, Computer Architecture, Circuit Design, Microprocessor Design, Programming Language Design, Assembly & Computer Design
        </p>
        <p className="mt-2">
          <strong>Notable Projects:</strong> Simulated 8-bit computer using logic gates in Logisim (CSCI 3240 – Computer Systems)
        </p>
      </div>
    </div>
  );
}
