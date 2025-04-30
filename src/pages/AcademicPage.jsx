import React from 'react';

export default function AcademicPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-4">Academic Background</h2>
      <ul className="space-y-6">
        <li>
          <h3 className="text-xl font-semibold">M.S. in Computer Science</h3>
          <p className="text-gray-400">State University, 2022</p>
          <p className="mt-2">
            Focus: Big Data Architectures & Machine Learning.
          </p>
        </li>
        <li>
          <h3 className="text-xl font-semibold">B.S. in Physics & Comp Engineering</h3>
          <p className="text-gray-400">Tech Institute, 2020</p>
          <p className="mt-2">Graduated with honors; specialized in software development.</p>
        </li>
      </ul>
    </div>
  );
}
