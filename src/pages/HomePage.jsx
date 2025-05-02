import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="p-8 text-center">
      <h2 className="text-4xl font-bold mb-4">
        Motivated Full-Stack Developer currently working as an SDE2 with Amazon Robotics
      </h2>

      <Link to="/projects">
        <button
          className="mt-4 px-8 py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-500 transition"
        >
          View My Work
        </button>
      </Link>

      <section id="highlights" className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
        <Link
          to="/work"
          className="bg-gray-800 rounded-lg p-6 text-center shadow-md hover:bg-gray-700 transition"
        >
          <p className="text-4xl font-bold">3+</p>
          <p className="text-xl text-gray-400 mt-2">Years Work Experience</p>
        </Link>

        <Link
          to="/work"
          className="bg-gray-800 rounded-lg p-6 text-center shadow-md hover:bg-gray-700 transition"
        >
          <p className="text-4xl font-bold">React · Python · AWS</p>
          <p className="text-xl text-gray-400 mt-2">Top Technologies</p>
        </Link>

        <Link
          to="/academic"
          className="bg-gray-800 rounded-lg p-6 text-center shadow-md hover:bg-gray-700 transition"
        >
          <p className="text-4xl font-bold">M.Sc.</p>
          <p className="text-sm text-gray-400 mt-2">
            in Computer Science from Vanderbilt University
          </p>
        </Link>
      </section>

      {/* Documents Preview */}
      <section id="documents" className="mt-16 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Resume */}
          <div className="flex-1">
            <div className="border rounded-lg overflow-hidden shadow-md">
              <iframe
                src="/Resume.pdf"
                title="Resume"
                className="w-full h-64"
              />
            </div>
            <a
              href="/Resume.pdf"
              download
              className="mt-2 inline-block text-blue-400 hover:underline"
            >
              Download Resume
            </a>
          </div>

          {/* Academic Portfolio */}
          <div className="flex-1">
            <div className="border rounded-lg overflow-hidden shadow-md">
              <iframe
                src="/AcademicPortfolio.pdf"
                title="Academic Portfolio"
                className="w-full h-64"
              />
            </div>
            <a
              href="/AcademicPortfolio.pdf"
              download
              className="mt-2 inline-block text-blue-400 hover:underline"
            >
              Download Portfolio
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
