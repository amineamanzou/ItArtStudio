export type ZoneKind = "tech" | "art" | "studio";

export type StudioZone = {
  id: string;
  label: string;
  shortLabel: string;
  kind: ZoneKind;
  position: [number, number];
  radius: number;
  title: string;
  summary: string;
  details: string;
  signals: string[];
  cta?: string;
};

export type WorldRoute = {
  id: string;
  from: string;
  to: string;
  kind: ZoneKind;
  via?: Array<[number, number]>;
};

export const zones: StudioZone[] = [
  {
    id: "studio-gate",
    label: "Studio Gate",
    shortLabel: "Gate",
    kind: "studio",
    position: [0, 0],
    radius: 2.2,
    title: "IT Art Studio",
    summary: "Une carte jouable pour explorer une agence tech creative.",
    details:
      "Le studio relie architecture technique, observabilite, IA, direction creative et objets visuels. Ici, chaque activite devient un lieu: on comprend en se deplacant.",
    signals: ["Studio commun", "Tech + art", "Exploration", "Contact"]
  },
  {
    id: "ai-lab",
    label: "AI Lab",
    shortLabel: "AI",
    kind: "tech",
    position: [-7, -3],
    radius: 1.8,
    title: "Innovation IA",
    summary: "Prototypes, agents, workflows et usage concret de l'IA.",
    details:
      "On transforme une intuition IA en systeme testable: cadrage, prototype, evaluation, instrumentation et passage a l'usage.",
    signals: ["Agents", "Prototypage", "Evaluation", "Workflow"]
  },
  {
    id: "observability-tower",
    label: "Observability Tower",
    shortLabel: "Obs",
    kind: "tech",
    position: [-8, 3],
    radius: 1.9,
    title: "Observabilite",
    summary: "Rendre les systemes lisibles avant de les transformer.",
    details:
      "Logs, traces, metriques et signaux produit servent a comprendre ce qui se passe vraiment. Le but: diagnostiquer vite et decider juste.",
    signals: ["OpenTelemetry", "Diagnostic", "Tracing", "Signal"]
  },
  {
    id: "architecture-bridge",
    label: "Architecture Bridge",
    shortLabel: "Arch",
    kind: "tech",
    position: [-3, 5.4],
    radius: 1.7,
    title: "Architecture",
    summary: "Faire tenir le produit, la dette et l'ambition dans un systeme coherent.",
    details:
      "On clarifie les frontieres, les flux, les invariants, les risques et les arbitrages qui permettent a une equipe d'avancer sans se raconter d'histoire.",
    signals: ["System design", "Arbitrage", "Delivery", "Robustesse"]
  },
  {
    id: "cloud-dock",
    label: "Cloud Dock",
    shortLabel: "Cloud",
    kind: "tech",
    position: [-2.6, -6],
    radius: 1.7,
    title: "Cloud & scaling",
    summary: "Deployer, operer, scaler sans perdre la maitrise.",
    details:
      "Infrastructure, CI/CD, reliability et couts sont traites comme un produit: clairs, observables, reproductibles.",
    signals: ["Cloud", "Scaling", "CI/CD", "Reliability"]
  },
  {
    id: "design-atelier",
    label: "Design Atelier",
    shortLabel: "Design",
    kind: "art",
    position: [6.9, -3.2],
    radius: 1.8,
    title: "Direction design",
    summary: "Donner une forme visible a une idee encore instable.",
    details:
      "On travaille l'image, la presence, la composition et les codes visuels pour qu'une marque, un objet ou une collection devienne tangible.",
    signals: ["Image", "Marque", "Direction", "Presence"]
  },
  {
    id: "three-d-foundry",
    label: "3D Foundry",
    shortLabel: "3D",
    kind: "art",
    position: [8, 2.6],
    radius: 1.8,
    title: "3D & volume",
    summary: "Explorer les volumes, scenes et objets qui donnent du relief.",
    details:
      "La 3D sert a prototyper une presence: produit, espace, matiere, lumiere, silhouette ou experience interactive.",
    signals: ["Volume", "Scene", "Objet", "Lumiere"]
  },
  {
    id: "fashion-room",
    label: "Fashion Room",
    shortLabel: "Mode",
    kind: "art",
    position: [3.4, 5.7],
    radius: 1.7,
    title: "Collection de mode",
    summary: "Travailler la matiere, la coupe et le desir d'un objet.",
    details:
      "La partie artistique porte la sensibilite: matiere, collection, narration, desirabilite et coherence de gamme.",
    signals: ["Matiere", "Collection", "Objet", "Desir"]
  },
  {
    id: "values-plaza",
    label: "Values Plaza",
    shortLabel: "Valeurs",
    kind: "studio",
    position: [0, 7.4],
    radius: 2,
    title: "Valeurs communes",
    summary: "Exigence, clarte, audace et transmission traversent les deux mondes.",
    details:
      "La frontiere IT / ART n'est pas un mur. C'est une place centrale: on cherche la justesse, la lisibilite, le soin et l'impact.",
    signals: ["Exigence", "Clarte", "Audace", "Transmission"]
  },
  {
    id: "contact-portal",
    label: "Contact Portal",
    shortLabel: "Mail",
    kind: "studio",
    position: [0, -8.2],
    radius: 1.9,
    title: "Contact",
    summary: "Entrer dans le studio avec un sujet, meme encore flou.",
    details:
      "Un diagnostic, une architecture a clarifier, une marque a rendre visible, une collection ou un prototype a faire exister: on peut commencer par une conversation.",
    signals: ["Diagnostic", "Projet", "Studio", "Conversation"],
    cta: "mailto:contact@itart.studio"
  }
];

export const defaultZone = zones[0];

export const worldRoutes: WorldRoute[] = [
  { id: "spine-contact-gate", from: "contact-portal", to: "studio-gate", kind: "studio" },
  { id: "spine-gate-values", from: "studio-gate", to: "values-plaza", kind: "studio", via: [[-0.7, 3.4]] },
  { id: "tech-gate-cloud", from: "studio-gate", to: "cloud-dock", kind: "tech", via: [[-1.6, -3.1]] },
  { id: "tech-cloud-ai", from: "cloud-dock", to: "ai-lab", kind: "tech", via: [[-5.6, -5.3]] },
  { id: "tech-ai-obs", from: "ai-lab", to: "observability-tower", kind: "tech", via: [[-9, -0.4]] },
  { id: "tech-obs-arch", from: "observability-tower", to: "architecture-bridge", kind: "tech", via: [[-6.2, 4.9]] },
  { id: "tech-arch-gate", from: "architecture-bridge", to: "studio-gate", kind: "tech", via: [[-2, 2.6]] },
  { id: "art-gate-design", from: "studio-gate", to: "design-atelier", kind: "art", via: [[3.1, -2.2]] },
  { id: "art-design-foundry", from: "design-atelier", to: "three-d-foundry", kind: "art", via: [[8.9, -0.6]] },
  { id: "art-foundry-fashion", from: "three-d-foundry", to: "fashion-room", kind: "art", via: [[6.5, 4.6]] },
  { id: "art-fashion-values", from: "fashion-room", to: "values-plaza", kind: "art", via: [[1.8, 6.8]] }
];
