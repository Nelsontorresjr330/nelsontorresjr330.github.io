import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Header from './components/Header';
import Footer from './components/Footer';

import HomePage from './pages/HomePage';
import WorkExperiencePage from './pages/WorkExperiencePage';
import PersonalProjectsPage from './pages/PersonalProjectsPage';
import AcademicPage from './pages/AcademicPage';
import PersonalPage from './pages/PersonalPage';

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/work" element={<WorkExperiencePage />} />
            <Route path="/projects" element={<PersonalProjectsPage />} />
            <Route path="/academic" element={<AcademicPage />} />
            <Route path="/personal" element={<PersonalPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
