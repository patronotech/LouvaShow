import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OperatorStartup } from '../startup/OperatorStartup';
createRoot(document.getElementById('root')!).render(<StrictMode><OperatorStartup /></StrictMode>);
