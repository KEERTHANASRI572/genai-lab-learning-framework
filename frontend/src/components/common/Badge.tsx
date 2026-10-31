import React from 'react';
import { LearningLevel } from '../../types/academic';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';
  level?: LearningLevel;
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  level,
  className = '',
  dot,
}) => {
  const badgeClass = level ? `badge-level-${level}` : `badge-${variant}`;

  return (
    <span className={`badge ${badgeClass} ${className}`}>
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            display: 'inline-block',
          }}
        />
      )}
      {children}
    </span>
  );
};
