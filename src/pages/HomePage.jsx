import React from 'react';

export default function HomePage() {
  return (
    <div className="p-8 text-center">
      <h2 className="text-4xl font-bold mb-4">
        Motivated Full-Stack Developer currently working as an SDE2 with Amazon Robotics
      </h2>
      <button
        className="mt-4 px-8 py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-500 transition"
        onClick={() => document.getElementById('highlights')?.scrollIntoView({ behavior: 'smooth' })}
      >
        View my work
      </button>

      <section id="highlights" className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-6 text-center shadow-md">
          <p className="text-4xl font-bold">3+</p>
          <p className="text-xl text-gray-400 mt-2">Years Work Experience</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 text-center shadow-md">
          <p className="text-4xl font-bold">React · Python · AWS </p>
          <p className="text-xl text-gray-400 mt-2">Top Technologies</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 text-center shadow-md">
          <p className="text-4xl font-bold">M.Sc.</p>
          <p className="text-sm text-gray-400 mt-2">in Computer Science from Vanderbilt University</p>
        </div>
      </section>
    </div>
  );
}
