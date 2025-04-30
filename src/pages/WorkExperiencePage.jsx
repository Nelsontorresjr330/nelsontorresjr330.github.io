import React from 'react';

export default function WorkExperiencePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-4">Work Experience</h2>
      <ul className="space-y-6">
        <li>
          <h3 className="text-xl font-semibold">Software Developer, XYZ Corp</h3>
          <p className="text-gray-400">Jan 2023 – Present</p>
          <p className="mt-2">
            Architected and built full-stack services with React, FastAPI, and AWS
            (Lambda, DynamoDB, CloudFront), serving 40k+ monthly users.
          </p>
        </li>
        {/* …additional entries… */}
      </ul>
    </div>
  );
}
