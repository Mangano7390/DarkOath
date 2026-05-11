export type AppLocale = "fr" | "nl" | "en";

export const DEFAULT_LOCALE: AppLocale = (process.env.DEFAULT_LOCALE as AppLocale) ?? "fr";

type Dict = Record<string, Record<AppLocale, string>>;

const dict: Dict = {
  "nav.dashboard": { fr: "Tableau de bord", nl: "Dashboard", en: "Dashboard" },
  "nav.quotes": { fr: "Devis", nl: "Offertes", en: "Quotes" },
  "nav.tickets": { fr: "SAV", nl: "Service", en: "Service" },
  "nav.inbox": { fr: "Boîte de réception", nl: "Inbox", en: "Inbox" },
  "nav.catalog": { fr: "Catalogue", nl: "Catalogus", en: "Catalog" },
  "nav.insights": { fr: "Analyses", nl: "Inzichten", en: "Insights" },
  "nav.routes": { fr: "Tournées", nl: "Routes", en: "Routes" },
  "nav.stock": { fr: "Stock", nl: "Voorraad", en: "Stock" },
  "nav.signout": { fr: "Déconnexion", nl: "Afmelden", en: "Sign out" },
  "common.save": { fr: "Enregistrer", nl: "Opslaan", en: "Save" },
  "common.cancel": { fr: "Annuler", nl: "Annuleren", en: "Cancel" },
  "common.delete": { fr: "Supprimer", nl: "Verwijderen", en: "Delete" },
  "common.send": { fr: "Envoyer", nl: "Versturen", en: "Send" },
  "common.loading": { fr: "Chargement…", nl: "Laden…", en: "Loading…" },
};

export function t(key: string, locale: AppLocale = DEFAULT_LOCALE): string {
  return dict[key]?.[locale] ?? key;
}
