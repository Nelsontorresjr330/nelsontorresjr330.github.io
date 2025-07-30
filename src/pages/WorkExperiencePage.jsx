import React from 'react';

export default function WorkExperiencePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h2 className="text-3xl font-bold">Work Experience</h2>

        <div className="bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold">Senior Software Developer (SDE3), Amazon</h3>
        <p className="text-gray-400 mt-1">Jun 2025 – Present | Nashville, TN</p>
        <p className="mt-2">
          Working on developing an AI/ML Computer Vision based Ergonomics Evaluator for Amazon Associates.
          Work involves data Java, AWS, AI/ML Frameworks (Python) and Computer Vision technologies.
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold">Software Developer 2, Amazon Robotics</h3>
        <p className="text-gray-400 mt-1">Jun 2024 – Jun 2025 | Nashville, TN</p>
        <p className="mt-2">
          Working on developing a proprietary SCADA system for Amazon Warehouses.
          Work involves data ETLs, PLC programming, Python, AWS, SQL and usage of internal Amazon Development Tools for CI/CD & Source Control.
          Designated as team SCRUM master.
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold">Software Developer, IPro Systems</h3>
        <p className="text-gray-400 mt-1">Oct 2022 – Jun 2024 | Hendersonville, TN</p>
        <p className="mt-2">
          Developed and debugged backend APIs and frontend UI/UX changes.
          Worked primarily with Apache Spark, Python, Docker, Java, SQL, FastAPI, Node.js and AWS.
          Notable projects: AWS Redshift DDL, massive ETL migrations from legacy systems, and mission-critical billing processes.
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold">Controls Engineer Intern, Automation Nth</h3>
        <p className="text-gray-400 mt-1">Jun 2022 – Oct 2022 | Smyrna, TN</p>
        <p className="mt-2">
          Completed the NTH University intern program preparing for a Controls Engineer role.
          Programmed PLCs, designed schematics & electrical diagrams in AutoCAD, and constructed & wired control panels.
        </p>
      </div>
    </div>
  );
}
