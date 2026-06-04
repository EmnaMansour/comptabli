/** Logo officiel Comptabli (`public/comptabli-logo.png`). */
const LOGO_SRC = '/comptabli-logo.png';

type AppLogoProps = {
  variant?: 'header' | 'sidebar' | 'networking' | 'auth';
  className?: string;
};

export default function AppLogo({ variant = 'header', className = '' }: AppLogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="Comptabli"
      className={`app-logo app-logo--${variant} ${className}`.trim()}
      decoding="async"
    />
  );
}
