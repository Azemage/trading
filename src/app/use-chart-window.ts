"use client";

import { useState } from "react";

/**
 * Fenêtre glissante sur un tableau de points de graphique : n'affiche que
 * les `windowSize` derniers points par défaut, avec deux flèches pour
 * paginer vers l'historique plus ancien (← ) ou revenir vers les points
 * les plus récents (→). Les données passées en prop sont figées pour la
 * durée de vie du composant (rendues côté serveur à chaque chargement de
 * page), donc l'état initial suffit — pas besoin de resynchroniser en cours
 * de route.
 */
export function useChartWindow<T>(data: T[], windowSize = 10) {
  const maxStart = Math.max(0, data.length - windowSize);
  const [start, setStart] = useState(maxStart);

  const visible = data.slice(start, start + windowSize);
  const canGoBack = start > 0;
  const canGoForward = start < maxStart;

  return {
    visible,
    canGoBack,
    canGoForward,
    goBack: () => setStart((s) => Math.max(0, s - windowSize)),
    goForward: () => setStart((s) => Math.min(maxStart, s + windowSize)),
    rangeStart: start + 1,
    rangeEnd: Math.min(start + windowSize, data.length),
    total: data.length,
  };
}
