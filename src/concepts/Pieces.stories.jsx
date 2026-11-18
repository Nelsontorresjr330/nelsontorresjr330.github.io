import { ProjectArt } from './shared';

// The generated project illustrations, one per kind. Each concept tints them with a text color.
const KINDS = ['surface', 'timeseries', 'graph', 'dynamic', 'app', 'radiation'];

function Gallery() {
  return (
    <div className="grid grid-cols-2 gap-4 bg-white p-6 sm:grid-cols-3">
      {KINDS.map((k) => (
        <figure key={k} className="rounded-lg border border-slate-200 p-4 text-slate-800">
          <ProjectArt kind={k} className="h-24 w-full" />
          <figcaption className="mt-2 font-mono text-xs text-slate-500">{k}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export default { title: 'Pieces/Project art', component: Gallery };
export const AllKinds = {};
