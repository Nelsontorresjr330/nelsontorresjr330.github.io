import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Header from './components/Header';
import Footer from './components/Footer';

import HomePage from './pages/HomePage';
import WorkExperiencePage from './pages/WorkExperiencePage';
import PersonalProjectsPage from './pages/PersonalProjectsPage';
import AcademicPage from './pages/AcademicPage';
import PersonalPage from './pages/PersonalPage';
import LaplacianGLMPage from './pages/LaplacianGLMPage';
import PublicationsPage from './pages/PublicationsPage';

// Every path here is public and may already be linked from elsewhere (the CSCI paper,
// emails). Never remove one; point it at its new home instead.
export const ROUTES = [
  { path: '/', element: <HomePage /> },
  { path: '/work', element: <WorkExperiencePage /> },
  { path: '/projects', element: <PersonalProjectsPage /> },
  { path: '/academic', element: <AcademicPage /> },
  { path: '/publications', element: <PublicationsPage /> },
  { path: '/personal', element: <PersonalPage /> },
  { path: '/research/laplacian-glm', element: <LaplacianGLMPage /> },
];

export function AppShell() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100">
      <Header />
      <main className="flex-grow">
        <Routes>
          {ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
