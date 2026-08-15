export interface Service {
  id: string;
  practice: "IT" | "ART";
  title: string;
  description: string;
}

export interface MethodStep {
  title: string;
  description: string;
}

export const company = {
  legalName: "IT Art Studio",
  legalForm: "Société à responsabilité limitée",
  capital: "1 000 €",
  address: "143 rue René Tachon, 69250 Curis-au-Mont-d'Or, France",
  siren: "915 019 129",
  rcs: "Lyon 915 019 129",
  vat: "FR79 915019129",
  email: "amine@itart.studio",
  directors: ["Carine Cléon-Amanzou", "Amine Amanzou"]
} as const;

export const navigation = [
  { label: "Expertises", href: "#expertises" },
  { label: "Approche", href: "#approche" },
  { label: "Contact", href: "#contact" }
] as const;

export const references = [
  "bioMérieux",
  "Axxès",
  "GCA Groupe Charles André",
  "KeyIA",
  "Enedis",
  "Ylio",
  "Odigo"
] as const;

export const services: Service[] = [
  {
    id: "observabilite",
    practice: "IT",
    title: "Observabilité et fiabilité",
    description: "Instrumenter applications et plateformes, corréler logs, métriques et traces, puis construire les tableaux de bord et les alertes utiles à l'exploitation."
  },
  {
    id: "architecture",
    practice: "IT",
    title: "Architecture, cloud et delivery",
    description: "Cartographier l'existant, trancher les choix structurants et livrer un schéma cible, des priorités et une trajectoire de mise en production."
  },
  {
    id: "ia-produit",
    practice: "IT",
    title: "IA et prototypes",
    description: "Formuler le cas d'usage, construire un prototype testable, définir son jeu d'évaluation et préparer son passage en production."
  },
  {
    id: "formation",
    practice: "IT",
    title: "Formation et accompagnement",
    description: "Travailler sur les systèmes et les cas d'usage de l'équipe, puis laisser des exemples, des supports et des pratiques qu'elle peut reprendre seule."
  },
  {
    id: "design-3d",
    practice: "ART",
    title: "Direction visuelle et design 3D",
    description: "Concevoir les volumes, les décors, les objets et les images fixes ou animées, puis diriger la lumière, la matière, le cadrage et le mouvement jusqu'au rendu final."
  },
  {
    id: "contenu-collection",
    practice: "ART",
    title: "Contenus et collections",
    description: "Construire une série cohérente — concept, silhouettes ou objets, images et formats de diffusion — puis préparer les éléments de présentation et de lancement."
  }
];

export const methodSteps: MethodStep[] = [
  {
    title: "Cadrer",
    description: "Analyser l'existant, le contexte d'usage, les contraintes et la décision à prendre. Sortie : un périmètre et des critères de réussite."
  },
  {
    title: "Produire",
    description: "Réaliser l'audit, l'architecture, le prototype, la direction ou la série d'images, avec des points de validation courts. Sortie : un livrable testable ou présentable."
  },
  {
    title: "Transmettre",
    description: "Livrer les fichiers, la documentation et les choix effectués. Sortie : un travail que le client peut exploiter, déployer ou faire évoluer."
  }
];
