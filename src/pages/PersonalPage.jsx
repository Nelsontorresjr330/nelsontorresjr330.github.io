import React, { useState } from 'react';

const photos = [
  '/PersonalImages/InTree.JPG',
  '/PersonalImages/OnBeach.JPG',
  '/PersonalImages/InJungle.JPG'
];

export default function PersonalPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const prevPhoto = () =>
    setCurrentIndex((currentIndex - 1 + photos.length) % photos.length);
  const nextPhoto = () =>
    setCurrentIndex((currentIndex + 1) % photos.length);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h2 className="text-3xl font-bold">About Me</h2>
      <div className="space-y-4">
        <p>
          Hi, I’m Nelson Torres — a software engineer passionate about crafting performant, user-friendly web applications.
        </p>
        <p>
          Beyond coding, my hobbies include : 3D printing / tinkering with electronics, travelling / spending time with friends & family and playing video games & sports, notably League of Legends and Soccer.
        </p>
      </div>

      <div className="relative mt-8 flex justify-center">
        <div className="w-[70%] aspect-square overflow-hidden rounded-lg shadow-md">
          <img
            src={photos[currentIndex]}
            alt="Nelson Torres"
            className="w-full h-full object-cover"
          />
        </div>

        <button
          onClick={prevPhoto}
          className="absolute top-1/2 left-[15%] transform -translate-y-1/2 bg-gray-800 bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition"
        >
          ‹
        </button>

        <button
          onClick={nextPhoto}
          className="absolute top-1/2 right-[15%] transform -translate-y-1/2 bg-gray-800 bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition"
        >
          ›
        </button>

        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {photos.map((_, idx) => (
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
    </div>
  );
}