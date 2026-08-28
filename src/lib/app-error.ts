/**
 * Erreur métier porteuse d'un code stable (traduit à l'affichage) plutôt que
 * d'un message en dur — permet de restituer l'erreur dans la langue active
 * de l'utilisateur (voir messages/*.json, namespace "errors").
 */
export class AppError extends Error {
  code: string;
  values?: Record<string, string | number>;

  constructor(code: string, values?: Record<string, string | number>) {
    super(code);
    this.code = code;
    this.values = values;
    this.name = new.target.name;
  }
}
