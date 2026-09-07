import type {Preview} from '@storybook/react-vite';
import '../src/signal-system/tokens.css';

const preview: Preview = {
  parameters: {
    a11y: {
      test: 'error',
    },
    options: {
      storySort: {order: ['REKT Signal System']},
    },
  },
};

export default preview;
