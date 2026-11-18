import '../src/index.css';

/** @type { import('@storybook/react-vite').Preview } */
const preview = {
  parameters: {
    layout: 'fullscreen',
    options: { storySort: { order: ['Concepts', ['A Notebook', 'B Lab', 'C Index'], 'Pieces'] } },
  },
};
export default preview;
