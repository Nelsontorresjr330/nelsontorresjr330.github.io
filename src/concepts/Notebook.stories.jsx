import content from '../content/portfolio';
import NotebookConcept from './NotebookConcept';

// Three directions for the portfolio overhaul. All render the same content
// (src/content/portfolio.js), so they differ only in layout and feel.
// Use the toolbar's viewport menu, or the "Phone" stories, to check small screens.

const phone = { viewport: { options: { phone: { name: 'Phone', styles: { width: '390px', height: '844px' } } } } };
const phoneGlobals = { viewport: { value: 'phone', isRotated: false } };

const meta = { title: 'Concepts/A Notebook', component: NotebookConcept, args: { content } };
export default meta;

export const Academic = { args: { initialArea: 'academic' } };
export const Professional = { args: { initialArea: 'professional' } };
export const Personal = { args: { initialArea: 'personal' } };
export const Phone = { args: { initialArea: 'academic' }, parameters: phone, globals: phoneGlobals };
