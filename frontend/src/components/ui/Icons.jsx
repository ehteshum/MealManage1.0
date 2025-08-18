import React from 'react';

export function EditIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
    </svg>
  );
}

export function TrashIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M9 3h6a1 1 0 011 1v1h3a1 1 0 110 2h-1v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7H5a1 1 0 110-2h3V4a1 1 0 011-1zm1 2v0h4V5h-4zm-1 4a1 1 0 112 0v8a1 1 0 11-2 0V9zm6 0a1 1 0 112 0v8a1 1 0 11-2 0V9z" />
    </svg>
  );
}
