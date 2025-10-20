import React from 'react';

export default function PublicationsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h2 className="text-3xl font-bold">Publications</h2>

      <div className="bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold">
          Observation of magnet-induced star-like radiation of a plasma created from cancer cells in a laser trap
        </h3>
        <p className="text-gray-400 mt-1">
          <strong>Journal:</strong> European Biophysics Journal, 2024 Apr;53(3):123-131
        </p>
        <p className="text-gray-400 mt-1">
          <strong>Authors:</strong> D Erenso, L Tran, I Abualrob, M Bushra, J Hengstenberg, E Muhammed, I Endale, N Endale, E Endale, S Mayhut, <strong>N Torres</strong>, P Sheffield, C Vazquez, H Crogman, C Nichols, T Dang, E E Hach 3rd
        </p>
        <p className="text-gray-400 mt-1">
          <strong>Institution:</strong> Middle Tennessee State University, Department of Physics
        </p>
        
        <div className="mt-4">
          <h4 className="text-lg font-semibold mb-2">Summary</h4>
          <p className="text-gray-300 leading-relaxed">
            This research presents a novel plasma phenomenon with significant implications for cancer research and treatment. Through the interaction of magnetic beads with cancer cells in a laser trap, we observed the formation of dark bubbles that emit intense star-like radiation when they explode. <strong>My key contributions included modeling and fitting the experimental data, as well as collecting crucial data points for analysis.</strong> I performed the computational analysis primarily using MATLAB with additional Python-based data processing, which was essential for quantifying the radiation intensity variations based on laser power output. This work opens new avenues for understanding plasma formation in biological systems and could revolutionize approaches to cancer treatment through innovative laser-based therapeutic techniques.
          </p>
        </div>

        <div className="mt-6">
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/38451329/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline inline-block"
          >
            View Publication on PubMed →
          </a>
        </div>
      </div>
    </div>
  );
}
