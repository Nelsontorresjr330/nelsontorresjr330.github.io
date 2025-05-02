import React from 'react';

export default function PersonalProjectsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h2 className="text-3xl font-bold">Personal Projects</h2>
      <div className="bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold">PayClear Payroll App</h3>
        <p className="mt-2">
          An AWS-powered payroll web application integrating Stripe & Plaid APIs.
        </p>
        <a href="https://github.com/your-repo/payclear" className="text-blue-400 hover:underline mt-2 inline-block">
          View on GitHub
        </a>
      </div>
    </div>
  );
}
