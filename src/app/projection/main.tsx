import { createRoot } from 'react-dom/client';
import { usePresentation } from '../../features/presentation/usePresentation';
import { Slide } from '../../features/presentation/Slide';
import './projection.css';
function Projection(){const {snapshot}=usePresentation();return <Slide snapshot={snapshot}/>;}
createRoot(document.getElementById('root')!).render(<Projection/>);
