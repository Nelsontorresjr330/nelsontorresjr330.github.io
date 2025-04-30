import React from 'react';

export default function HomePage() {
  return (
    <div className="p-8 text-center">
      <h2 className="text-5xl font-bold mb-4">
        Building scalable, user-centric web apps with React, FastAPI & AWS.
      </h2>
      <button
        className="mt-4 px-8 py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-500 transition"
        onClick={() => document.getElementById('highlights')?.scrollIntoView({ behavior: 'smooth' })}
      >
        View my work
      </button>

      <section id="highlights" className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-6 text-center shadow-md">
          <p className="text-4xl font-bold">5+</p>
          <p className="text-sm text-gray-400 mt-2">Years Experience</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 text-center shadow-md">
          <p className="text-4xl font-bold">React · Python · AWS · Docker</p>
          <p className="text-sm text-gray-400 mt-2">Top Technologies</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 text-center shadow-md">
          <p className="text-4xl font-bold">10+</p>
          <p className="text-sm text-gray-400 mt-2">Production Deployments</p>
        </div>
      </section>
    </div>
  );
}
