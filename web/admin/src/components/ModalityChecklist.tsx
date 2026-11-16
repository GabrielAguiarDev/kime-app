import type { Modality } from '../api';

interface Props {
  modalities: Modality[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function ModalityChecklist({ modalities, selected, onChange }: Props) {
  if (modalities.length === 0) return <p className="muted">Esta academia não tem modalidades cadastradas.</p>;
  return (
    <fieldset className="checklist">
      <legend>Modalidades</legend>
      {modalities.map(m => (
        <label key={m.id} className="check">
          <input
            type="checkbox"
            checked={selected.includes(m.id)}
            onChange={e => onChange(e.target.checked ? [...selected, m.id] : selected.filter(id => id !== m.id))}
          />
          {m.name}
        </label>
      ))}
    </fieldset>
  );
}
