import React, { useState } from 'react';

const screenshots = [
  '/ProjectScreenshots/PayClearDashboard.png',
  '/ProjectScreenshots/ManagePayroll.png',
  '/ProjectScreenshots/PlaidLogin.png',
  '/ProjectScreenshots/PlaidDashboard.png'
];

export default function PersonalProjectsPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const prev = () =>
    setCurrentIndex((currentIndex - 1 + screenshots.length) % screenshots.length);
  const next = () =>
    setCurrentIndex((currentIndex + 1) % screenshots.length);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 relative">
      <h2 className="text-3xl font-bold">Personal Projects</h2>

      {/* Project Card */}
      <div className="bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold">PayClear Payroll &amp; Business Finance App</h3>
        <p className="mt-2">
          An AWS-powered all-in-one payroll and business finance web application integrating Stripe &amp; Plaid APIs built in React.
        </p>
        <a
          href="https://github.com/your-repo/payclear"
          className="text-blue-400 hover:underline mt-2 inline-block"
        >
          View on GitHub
        </a>
      </div>

      {/* Screenshot Carousel */}
      <div className="relative mt-4 flex justify-center">
        <div
          className="w-full sm:w-[80%] aspect-video overflow-hidden rounded-lg shadow-md cursor-pointer"
          onClick={() => setIsModalOpen(true)}
        >
          <img
            src={screenshots[currentIndex]}
            alt={`PayClear screenshot ${currentIndex + 1}`}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Prev */}
        <button
          onClick={prev}
          className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-gray-800 bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition"
        >
          ‹
        </button>

        {/* Next */}
        <button
          onClick={next}
          className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-gray-800 bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition"
        >
          ›
        </button>

        {/* Indicators */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {screenshots.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full ${
                idx === currentIndex ? 'bg-blue-400' : 'bg-gray-500'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-0 z-50 flex items-center justify-center">
          <div className="relative w-[90%] sm:w-[70%] max-h-[90vh]">
            {/* Close with centered circle */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-black bg-opacity-75 flex items-center justify-center rounded-full hover:bg-opacity-50 transition"
            >
              <span className="text-white text-2xl leading-none">×</span>
            </button>

            {/* Modal Prev */}
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white text-3xl p-2 hover:text-gray-300"
            >
              ‹
            </button>

            {/* Modal Next */}
            <button
              onClick={next}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white text-3xl p-2 hover:text-gray-300"
            >
              ›
            </button>

            {/* Enlarged Image */}
            <img
              src={screenshots[currentIndex]}
              alt={`PayClear screenshot ${currentIndex + 1}`}
              className="w-full h-auto object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
