// ═══════════════════════════════════════════
// Comptabli – AuthLeftPanel Component
// Animated: particles, hexagons, shimmer, float
// ═══════════════════════════════════════════

import React from 'react';
import { useSlideshow, AUTH_SLIDES } from '../../hooks/useSlideshow';

// ── Mini Dashboard Mockup ──────────────────
const DashMock: React.FC = () => (
  <div className="dash-mock-inner">
    <div className="dash-row">
      <div className="dash-icon-box">📊</div>
      <div className="dash-lines">
        <div className="dash-line" style={{ width: '70%' }} />
        <div className="dash-line" style={{ width: '45%' }} />
      </div>
      <div style={{
        background: '#f97316', borderRadius: 6, fontSize: '0.6rem',
        color: 'white', padding: '2px 7px', fontWeight: 700, whiteSpace: 'nowrap',
      }}>+12%</div>
    </div>

    <div className="dash-bar-accent" style={{ marginTop: 4 }} />

    <div className="dash-blocks" style={{ marginTop: 6 }}>
      <div className="dash-block" />
      <div className="dash-block accent" />
      <div className="dash-block" style={{ height: 18 }} />
    </div>

    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, marginTop: 6,
      padding: '5px 6px', background: '#f8fafc', borderRadius: 6,
    }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>👤</div>
      <div style={{ flex: 1 }}>
        <div className="dash-line" style={{ width: '80%', height: 5 }} />
        <div className="dash-line" style={{ width: '50%', height: 4, marginTop: 3 }} />
      </div>
      <div style={{ background: '#dcfce7', borderRadius: 4, fontSize: '0.55rem', color: '#16a34a', padding: '1px 5px', fontWeight: 700 }}>80%</div>
    </div>

    <div className="dash-blocks" style={{ marginTop: 6 }}>
      <div className="dash-block orange" />
      <div className="dash-block" />
      <div className="dash-block accent" />
    </div>

    <div style={{ marginTop: 6, padding: '5px 6px', background: '#fff7ed', borderRadius: 6 }}>
      <div className="dash-line" style={{ width: '60%', height: 5 }} />
      <div className="dash-line" style={{ width: '40%', height: 4, marginTop: 3 }} />
    </div>
  </div>
);

// ── Component ──────────────────────────────
interface AuthLeftPanelProps {
  slideIndex?: number;
}

const AuthLeftPanel: React.FC<AuthLeftPanelProps> = ({ slideIndex }) => {
  const { currentSlide, slide, goTo } = useSlideshow();
  const active         = slideIndex !== undefined ? slideIndex : currentSlide;
  const displaySlide   = slideIndex !== undefined ? AUTH_SLIDES[slideIndex] : slide;

  return (
    <div className="auth-panel-left">
      {/* Particles */}
      <div className="auth-particle" />
      <div className="auth-particle" />
      <div className="auth-particle" />
      <div className="auth-particle" />
      <div className="auth-particle" />

      {/* Hexagons */}
      <div className="auth-hex auth-hex-1" />
      <div className="auth-hex auth-hex-2" />
      <div className="auth-hex auth-hex-3" />

      {/* Slide content */}

      {/* Slide content */}
      <div className="auth-slide-wrap">
        <h2 className="auth-slide-title">{displaySlide.title}</h2>

        <div className="auth-preview-card">
          <DashMock />
        </div>

        <p className="auth-slide-desc">{displaySlide.desc}</p>

        {/* Dots */}
        <div className="auth-dots">
          {AUTH_SLIDES.map((_, i) => (
            <button
              key={i}
              className={`auth-dot${i === active ? ' active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="auth-left-footer">
        <span>© 2026 · Comptabli</span>
        <span>Tous droits réservés</span>
      </div>
    </div>
  );
};

export default AuthLeftPanel;
