import React from 'react';
import { FileQuestion } from 'lucide-react';
import { Button } from '../common/Button';
import { useApp } from '../../context/AppContext';

export const NotFoundState: React.FC = () => {
  const { setCurrentView } = useApp();

  return (
    <div className="glass-panel empty-state" style={{ maxWidth: 540, margin: '60px auto' }}>
      <div className="empty-icon">
        <FileQuestion size={28} />
      </div>
      <h3 className="empty-title">Academic Resource Not Found</h3>
      <p className="empty-desc">
        The requested experiment module, laboratory, or portal route could not be found within the active institutional catalog.
      </p>
      <div style={{ marginTop: 16 }}>
        <Button variant="primary" size="sm" onClick={() => setCurrentView('student-dashboard')}>
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};
