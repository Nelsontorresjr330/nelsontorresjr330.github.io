import React from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';

import SiteHeader from './components/SiteHeader';
import LandingPage from './pages/LandingPage';
import ProfessionalPage from './pages/ProfessionalPage';
import AcademicPage from './pages/AcademicPage';
import PersonalPage from './pages/PersonalPage';
import LaplacianGLMPage from './pages/LaplacianGLMPage';
import { REDIRECTS } from './content/site';

// Every path here is public and may already be linked from elsewhere (the CSCI paper,
// emails, the old site). Never remove one; point it at its new home instead.
export const ROUTES = [
  { path: '/', element: <LandingPage /> },
  { path: '/professional', element: <ProfessionalPage /> },
  { path: '/academic', element: <AcademicPage /> },
  { path: '/personal', element: <PersonalPage /> },
  { path: '/research/laplacian-glm', element: <LaplacianGLMPage /> },
];

function NotFound() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-24">
      <h1 className="m-0 text-3xl font-bold text-ink">Page not found</h1>
      <p className="mt-3 text-muted">That page doesn’t exist. <Link to="/" className="text-aca-soft no-underline">Go to the home page</Link>.</p>
    </section>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-ground text-body">
      <SiteHeader />
      <main>
        <Routes>
          {ROUTES.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
          {Object.entries(REDIRECTS).map(([from, to]) => <Route key={from} path={from} element={<Navigate to={to} replace />} />)}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
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
