import { MotionLab } from './MotionLab';
import './motion-lab.css';

/**
 * Standalone experimental entry surface. Keep this import out of production
 * Inkubator screens until the motion grammar has passed reference review.
 */
export function MotionLabRoute() {
  return <MotionLab />;
}
