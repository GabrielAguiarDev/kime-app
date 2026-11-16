import { logoUrl } from '../supabase';

export function AcademyLogo({ path, name, size = 40 }: { path: string | null; name: string; size?: number }) {
  const url = logoUrl(path);
  const style = { width: size, height: size };
  if (url) return <img className="logo" src={url} alt="" style={style} loading="lazy" />;
  return (
    <span className="logo logo-fallback" style={style} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
