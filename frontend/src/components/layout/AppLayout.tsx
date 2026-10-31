import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from '../common/Breadcrumbs';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="content-wrapper">
          <Breadcrumbs />
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
};
