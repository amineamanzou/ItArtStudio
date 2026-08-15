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

export const services: Service[] = [
  {
    id: "observabilite",
    practice: "IT",
    title: "Observabilité et fiabilité",
    description: "Stratégie de télémétrie, diagnostic de systèmes et industrialisation OpenTelemetry pour rendre les signaux réellement exploitables."
  },
  {
    id: "architecture",
    practice: "IT",
    title: "Architecture, cloud et scaling",
    description: "Cadrage, revues de systèmes, arbitrages techniques et trajectoires de delivery adaptées aux contraintes du terrain."
  },
  {
    id: "ia-produit",
    practice: "IT",
    title: "IA, produit et prototypes",
    description: "Clarification du besoin, preuve de concept et passage d'une intuition à un produit testable, utile et exploitable."
  },
  {
    id: "formation",
    practice: "IT",
    title: "Formation et accompagnement",
    description: "Sessions ciblées, coaching technique et transfert de compétences pour faire progresser les équipes sans créer de dépendance."
  },
  {
    id: "design-3d",
    practice: "ART",
    title: "Design 3D et direction visuelle",
    description: "Conception de volumes, d'objets, d'univers et de rendus qui donnent une forme lisible et singulière au projet."
  },
  {
    id: "contenu-collection",
    practice: "ART",
    title: "Contenu et collection",
    description: "Conception de contenus audiovisuels, de pièces et de collections capsules, du concept jusqu'à une présentation cohérente."
  }
];

export const methodSteps: MethodStep[] = [
  {
    title: "Clarifier",
    description: "Comprendre le besoin, les contraintes et les décisions qui comptent avant d'ajouter de la complexité."
  },
  {
    title: "Construire",
    description: "Produire le cadrage, le prototype, le dispositif ou le livrable qui permet réellement d'avancer."
  },
  {
    title: "Mettre en valeur",
    description: "Soigner la lisibilité, la cohérence et la qualité perçue pour que le résultat soit compris et retenu."
  }
];
