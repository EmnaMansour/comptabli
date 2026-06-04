// ═══════════════════════════════════════════
// Comptabli – useSlideshow Hook
// ═══════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import type { AuthSlide } from '../types/auth.types';

export const AUTH_SLIDES: AuthSlide[] = [
  {
    title: 'Visualisez et suivez toutes vos transactions.',
    desc: 'Accédez à un aperçu clair de vos mouvements financiers à tout moment.',
    icon: '📊',
    label: 'Historique bancaire',
  },
  {
    title: 'Centralisez et organisez tous vos fichiers en un seul endroit.',
    desc: 'Téléchargez, consultez et gérez vos documents en toute simplicité.',
    icon: '📁',
    label: 'Gestion des documents',
  },
  {
    title: 'Planifiez, suivez et accomplissez vos missions efficacement.',
    desc: 'Gardez le contrôle sur vos priorités et respectez vos délais.',
    icon: '✅',
    label: 'Gestion des tâches',
  },
  {
    title: 'Automatisez la récupération des informations clés.',
    desc: 'Analysez vos factures et extrayez les données essentielles en quelques secondes.',
    icon: '🤖',
    label: 'Extraction des données',
  },
];

interface UseSlideshowReturn {
  currentSlide: number;
  slide: AuthSlide;
  goTo: (index: number) => void;
}

export function useSlideshow(intervalMs = 5000): UseSlideshowReturn {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setCurrentSlide((s) => (s + 1) % AUTH_SLIDES.length),
      intervalMs
    );
    return () => clearInterval(timer);
  }, [intervalMs]);

  const goTo = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  return {
    currentSlide,
    slide: AUTH_SLIDES[currentSlide],
    goTo,
  };
}
