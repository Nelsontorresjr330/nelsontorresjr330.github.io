import React from 'react';

export default function WorkExperiencePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-4">Work Experience</h2>
      <ul className="space-y-6">
        <li>
          <h3 className="text-xl font-semibold">Software Developer 2, Amazon Robotics</h3>
          <p className="text-gray-400">Jun 2024 – Present</p>
          <p className="text-gray-400">Nashville, TN</p>
          <p className="mt-2">
          Working on developing a proprietary SCADA system for Amazon Warehouses.
          Work invlolves data ETLs, PLC programming, Python, AWS, SQL and usage of internal Amazon Development Tools for CI/CD & Source Control.
          Designated as team SCRUM master.
          </p>
        </li>
        <li>
          <h3 className="text-xl font-semibold">Software Developer, IPro Systems</h3>
          <p className="text-gray-400">Oct 2022 – Jun 2024</p>
          <p className="text-gray-400">Hendersonville, TN</p>
          <p className="mt-2">
          Develop and debug backend APIs and frontend UI/UX changes.
          Worked primarily with Apache Spark, Python, Docker, Java, SQL, FastAPI, Node.JS and AWS.
          Notable projects : AWS Redshift DDL, Massive ETL of Tenant from legacy systems, Development of mission critical billing processes.
          </p>
        </li>
        <li>
          <h3 className="text-xl font-semibold">Controls Engineer Intern, Automation Nth</h3>
          <p className="text-gray-400">Jun 2022 – Oct 2022</p>
          <p className="text-gray-400">Smyrna, TN</p>
          <p className="mt-2">
          Went through the NTH University program as an Intern to prepare working as a Controls Engineer for the organization
          Programming PLCs, Desiging schematics & electrical diagrams via AutoCAD, Constructing & wiring panels.
          </p>
        </li>
      </ul>
    </div>
  );
}
