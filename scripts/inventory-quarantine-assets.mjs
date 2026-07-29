import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "assets", "quarantine", "inventory");
const inventoryJsonPath = path.join(outputDir, "kenney-terrain-priority-inventory.json");
const inventoryMdPath = path.join(outputDir, "kenney-terrain-priority-inventory.md");

const packs = [
  {
    id: "kenney-mini-forest",
    backlogId: "source-kenney-mini-forest-non-conic-vegetation",
    sourceUrl: "https://kenney.nl/assets/mini-forest",
    archive: "assets/quarantine/vendor/kenney/mini-forest/kenney_mini-forest_1.0.zip",
    base: "assets/quarantine/vendor/kenney/mini-forest/extracted",
    glbDir: "Models/GLB format",
    previewDir: "Previews",
    priorityRoles: ["vegetation", "relief", "bridge"]
  },
  {
    id: "kenney-modular-cave-kit",
    backlogId: "source-kenney-modular-cave-relief",
    sourceUrl: "https://kenney.nl/assets/modular-cave-kit",
    archive: "assets/quarantine/vendor/kenney/modular-cave-kit/kenney_modular-cave-kit_1.0.zip",
    base: "assets/quarantine/vendor/kenney/modular-cave-kit/extracted",
    glbDir: "Models/GLB format",
    previewDir: "Previews",
    priorityRoles: ["relief", "bridge"]
  }
];

const asRelative = (filePath) => path.relative(root, filePath).split(path.sep).join("/");
const readFile = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const fileKb = (filePath) => Math.round((fs.statSync(filePath).size / 1024) * 10) / 10;
const sha256 = (relativePath) => crypto.createHash("sha256").update(readFile(relativePath)).digest("hex");

const listFiles = (entryPath) => {
  if (!fs.existsSync(entryPath)) {
    return [];
  }
  const stat = fs.statSync(entryPath);
  if (stat.isFile()) {
    return [entryPath];
  }
  return fs.readdirSync(entryPath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = path.join(entryPath, entry.name);
    return entry.isDirectory() ? listFiles(childPath) : [childPath];
  });
};

const readGlbJsonChunk = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString("utf8", 0, 4) !== "glTF") {
    throw new Error(`Invalid GLB magic header: ${filePath}`);
  }
  const jsonLength = buffer.readUInt32LE(12);
  const chunkType = buffer.toString("utf8", 16, 20);
  if (chunkType !== "JSON") {
    throw new Error(`Missing GLB JSON chunk: ${filePath}`);
  }
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).replace(/[\0\s]+$/u, ""));
};

const countTriangles = (filePath) => {
  const gltf = readGlbJsonChunk(filePath);
  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if ((primitive.mode ?? 4) !== 4) {
        continue;
      }
      if (primitive.indices !== undefined) {
        triangles += (gltf.accessors?.[primitive.indices]?.count ?? 0) / 3;
      } else if (primitive.attributes?.POSITION !== undefined) {
        triangles += (gltf.accessors?.[primitive.attributes.POSITION]?.count ?? 0) / 3;
      }
    }
  }
  return Math.round(triangles);
};

const classifyMiniForest = (name) => {
  if (["tree", "tree-high", "plant"].includes(name)) {
    return {
      terrainRoles: ["vegetation"],
      decision: "candidate",
      reviewFocus: ["non-conic silhouette", "reads as vegetation at distance", "fits current low-poly vendor palette"]
    };
  }
  if (["rocks-high", "rocks-low", "rocks-ramp", "stones"].includes(name)) {
    return {
      terrainRoles: ["relief"],
      decision: "candidate",
      reviewFocus: ["authored relief silhouette", "no primitive block read", "useful near water or map edge"]
    };
  }
  if (name === "bridge") {
    return {
      terrainRoles: ["bridge"],
      decision: "candidate",
      reviewFocus: ["usable crossing", "not a flat plate", "compatible scale with current vehicle"]
    };
  }
  if (["patch-dirt", "patch-grass", "platform", "building-platform"].includes(name)) {
    return {
      terrainRoles: ["path"],
      decision: "hold",
      reviewFocus: ["flat plate risk", "may read as generated rectangle", "use texture layer first"]
    };
  }
  return {
    terrainRoles: [],
    decision: "reject-public-terrain",
    reviewFocus: ["not a terrain-first asset", "keep out of public terrain core"]
  };
};

const classifyModularCave = (name) => {
  if (["gate-rock", "gate-overhang", "stairs", "stairs-wide"].includes(name)) {
    return {
      terrainRoles: ["relief"],
      decision: "candidate",
      reviewFocus: ["authored elevation break", "not a primitive wall", "use away from hero bases first"]
    };
  }
  if (name === "ladder") {
    return {
      terrainRoles: ["bridge"],
      decision: "hold",
      reviewFocus: ["scale risk", "could become route punctuation later", "not terrain-first enough yet"]
    };
  }
  if (/^(template|corridor|room)/u.test(name)) {
    return {
      terrainRoles: ["relief"],
      decision: "reject-public-terrain",
      reviewFocus: ["wall or floor tile risk", "could read as primitive block/plate", "needs separate cave biome proof"]
    };
  }
  return {
    terrainRoles: [],
    decision: "hold",
    reviewFocus: ["inspect manually before any public use"]
  };
};

const classify = (packId, name) => (packId === "kenney-mini-forest" ? classifyMiniForest(name) : classifyModularCave(name));

fs.mkdirSync(outputDir, { recursive: true });

const generatedAt = new Date().toISOString();
const packInventories = packs.map((pack) => {
  const basePath = path.join(root, pack.base);
  const glbPath = path.join(basePath, pack.glbDir);
  const previewPath = path.join(basePath, pack.previewDir);
  const archivePath = path.join(root, pack.archive);
  const glbFiles = listFiles(glbPath).filter((file) => file.endsWith(".glb")).sort();
  const previewNames = new Set(listFiles(previewPath).filter((file) => file.endsWith(".png")).map((file) => path.basename(file)));
  const licensePath = path.join(basePath, "License.txt");

  const models = glbFiles.map((file) => {
    const name = path.basename(file, ".glb");
    const classification = classify(pack.id, name);
    const previewFile = `${name}.png`;
    return {
      name,
      file: asRelative(file),
      preview: previewNames.has(previewFile) ? asRelative(path.join(previewPath, previewFile)) : null,
      fileKb: fileKb(file),
      triangles: countTriangles(file),
      ...classification
    };
  });

  return {
    id: pack.id,
    backlogId: pack.backlogId,
    sourceUrl: pack.sourceUrl,
    license: "CC0-1.0",
    licenseFile: fs.existsSync(licensePath) ? asRelative(licensePath) : null,
    archive: asRelative(archivePath),
    archiveKb: fileKb(archivePath),
    archiveSha256: sha256(pack.archive),
    extractedRoot: pack.base,
    glbCount: models.length,
    previewCount: previewNames.size,
    totalGlbKb: Math.round(models.reduce((total, model) => total + model.fileKb, 0) * 10) / 10,
    totalTriangles: models.reduce((total, model) => total + model.triangles, 0),
    decisions: {
      candidate: models.filter((model) => model.decision === "candidate").length,
      hold: models.filter((model) => model.decision === "hold").length,
      rejectPublicTerrain: models.filter((model) => model.decision === "reject-public-terrain").length
    },
    models
  };
});

const inventory = {
  generatedAt,
  policy: "Quarantine inventory only. Files listed here are not public runtime assets until copied into public/assets, declared as accepted/integrated, budgeted, and proven by QA.",
  packs: packInventories,
  totals: {
    packs: packInventories.length,
    glbCount: packInventories.reduce((total, pack) => total + pack.glbCount, 0),
    candidateCount: packInventories.reduce((total, pack) => total + pack.decisions.candidate, 0),
    holdCount: packInventories.reduce((total, pack) => total + pack.decisions.hold, 0),
    rejectPublicTerrainCount: packInventories.reduce((total, pack) => total + pack.decisions.rejectPublicTerrain, 0),
    totalGlbKb: Math.round(packInventories.reduce((total, pack) => total + pack.totalGlbKb, 0) * 10) / 10,
    totalTriangles: packInventories.reduce((total, pack) => total + pack.totalTriangles, 0)
  }
};

const markdown = [
  "# Kenney Terrain Priority Inventory",
  "",
  `Generated: ${generatedAt}`,
  "",
  "This is a quarantine inventory only. Nothing listed here is allowed in the public runtime until it is copied into `public/assets`, declared in `world-assets.manifest.json`, budgeted, and proven by QA.",
  "",
  "## Summary",
  "",
  `- Packs: ${inventory.totals.packs}`,
  `- GLB files: ${inventory.totals.glbCount}`,
  `- Candidate terrain assets: ${inventory.totals.candidateCount}`,
  `- Held for manual review: ${inventory.totals.holdCount}`,
  `- Rejected for public terrain: ${inventory.totals.rejectPublicTerrainCount}`,
  `- Total GLB weight: ${inventory.totals.totalGlbKb} KB`,
  `- Total GLB triangles: ${inventory.totals.totalTriangles}`,
  "",
  ...packInventories.flatMap((pack) => [
    `## ${pack.id}`,
    "",
    `- Backlog: \`${pack.backlogId}\``,
    `- Source: ${pack.sourceUrl}`,
    `- License: ${pack.license}`,
    `- Archive SHA-256: \`${pack.archiveSha256}\``,
    `- GLB files: ${pack.glbCount}`,
    `- Candidates/Hold/Reject: ${pack.decisions.candidate}/${pack.decisions.hold}/${pack.decisions.rejectPublicTerrain}`,
    "",
    "| Decision | Name | Roles | KB | Triangles | Review Focus |",
    "|---|---|---:|---:|---:|---|",
    ...pack.models.map((model) =>
      `| ${model.decision} | ${model.name} | ${model.terrainRoles.join(", ") || "n/a"} | ${model.fileKb} | ${model.triangles} | ${model.reviewFocus.join("; ")} |`
    ),
    ""
  ])
].join("\n");

fs.writeFileSync(inventoryJsonPath, `${JSON.stringify(inventory, null, 2)}\n`);
fs.writeFileSync(inventoryMdPath, `${markdown}\n`);

console.log(
  JSON.stringify(
    {
      inventory: asRelative(inventoryJsonPath),
      report: asRelative(inventoryMdPath),
      totals: inventory.totals
    },
    null,
    2
  )
);
