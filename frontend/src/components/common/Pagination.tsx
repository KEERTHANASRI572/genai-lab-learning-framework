import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        fontSize: '0.825rem',
        color: 'var(--text-muted)',
      }}
    >
      <div>
        Showing <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{startItem}</span> to{' '}
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{endItem}</span> of{' '}
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{totalItems}</span> results
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} /> Prev
        </Button>
        <span style={{ padding: '0 8px', color: 'var(--text-secondary)' }}>
          Page {currentPage} of {Math.max(1, totalPages)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages || totalPages === 0}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          Next <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
};
