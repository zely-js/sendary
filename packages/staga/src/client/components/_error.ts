import React from 'react';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  height: '100vh',
  textAlign: 'center',
  flexDirection: 'column',
};

export interface ErrorProps {
  status?: number | string;
  message?: string;
  detail?: string;
}

const defaultProps: ErrorProps = {
  status: 404,
  message: 'Page not found',
  detail: undefined,
};

export const DefaultError = ({ status, message, detail }: ErrorProps = defaultProps) => {
  status = status ?? defaultProps.status;
  message = message ?? defaultProps.message;

  console.error(`[status: ${status}] ${message} (detail: ${detail})`);

  return React.createElement('div', { style: containerStyle }, [
    React.createElement('h1', { key: 'status' }, String(status)),
    React.createElement('p', { key: 'message' }, message),
  ]);
};
