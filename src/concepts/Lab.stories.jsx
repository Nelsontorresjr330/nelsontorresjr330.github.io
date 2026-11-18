import content from '../content/portfolio';
import LabConcept from './LabConcept';

const phone = { viewport: { options: { phone: { name: 'Phone', styles: { width: '390px', height: '844px' } } } } };

export default { title: 'Concepts/B Lab', component: LabConcept, args: { content } };

export const AllWork = { args: { initialFilter: 'all' } };
export const AcademicOnly = { args: { initialFilter: 'academic' } };
export const PersonalOnly = { args: { initialFilter: 'personal' } };
export const Phone = { parameters: phone, globals: { viewport: { value: 'phone', isRotated: false } } };
