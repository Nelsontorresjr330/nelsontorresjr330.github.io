import content from '../content/portfolio';
import IndexConcept from './IndexConcept';

const phone = { viewport: { options: { phone: { name: 'Phone', styles: { width: '390px', height: '844px' } } } } };

export default { title: 'Concepts/C Index', component: IndexConcept, args: { content } };

export const FullPage = {};
export const Phone = { parameters: phone, globals: { viewport: { value: 'phone', isRotated: false } } };
