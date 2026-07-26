import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "assets", "world-assets.manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const failures = [];
const warnings = [];

const fail = (message, details = {}) => failures.push({ message, details });
const warn = (message, details = {}) => warnings.push({ message, details });
const asArray = (value) => (Array.isArray(value) ? value : []);
const isHttpUrl = (value) => typeof value === "string" && /^https?:\/\//.test(value);
const isPositiveNumber = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const roundTenth = (value) => Math.round(value * 10) / 10;

const listFiles = (entryPath) => {
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
    fail("GLB file has an invalid magic header.", { filePath });
    return null;
  }

  const jsonLength = buffer.readUInt32LE(12);
  const chunkType = buffer.toString("utf8", 16, 20);
  if (chunkType !== "JSON") {
    fail("GLB file is missing its JSON chunk.", { filePath, chunkType });
    return null;
  }

  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).replace(/[\0\s]+$/u, ""));
};

const countGlbTriangles = (filePath) => {
  const gltf = readGlbJsonChunk(filePath);
  if (!gltf) {
    return 0;
  }

  let triangles = 0;
  for (const mesh of asArray(gltf.meshes)) {
    for (const primitive of asArray(mesh.primitives)) {
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

const analyzeLocalAsset = (assetId, localPath) => {
  const absolutePath = path.join(root, localPath);
  const files = listFiles(absolutePath);
  const glbFiles = files.filter((file) => file.endsWith(".glb"));
  const textureFiles = files.filter((file) => /\.(avif|jpe?g|png|webp)$/iu.test(file));
  const fileKb = roundTenth(files.reduce((total, file) => total + fs.statSync(file).size / 1024, 0));
  const triangles = glbFiles.reduce((total, file) => total + countGlbTriangles(file), 0);

  return {
    assetId,
    fileKb,
    triangles,
    modelFiles: glbFiles.length,
    textureFiles: textureFiles.length,
    files: files.length
  };
};

const roughlyEqual = (actual, declared) => Math.abs(actual - declared) <= Math.max(0.2, actual * 0.01);
const toPublicPath = (localPath) => (localPath.startsWith("public/") ? localPath.slice("public/".length) : localPath);

if (!Number.isInteger(manifest.version) || manifest.version < 1) {
  fail("Manifest version must be a positive integer.", { version: manifest.version });
}

if (manifest.strategy !== "asset-first") {
  fail("Manifest strategy must remain asset-first.", { strategy: manifest.strategy });
}

const allowedStatuses = new Set(asArray(manifest.statusModel));
for (const status of ["candidate", "accepted", "integrated", "rejected"]) {
  if (!allowedStatuses.has(status)) {
    fail("Manifest status model is missing a required status.", { status });
  }
}

const budgets = manifest.budgets ?? {};
for (const key of ["acceptedModelMaxKb", "acceptedTextureMaxKb", "heroLocationModelBudget", "rendererTextureCap"]) {
  if (!isPositiveNumber(budgets[key])) {
    fail("Manifest budget must be a positive number.", { key, value: budgets[key] });
  }
}

const sources = asArray(manifest.sources);
const sourceIds = new Set();
for (const source of sources) {
  if (!source.id || sourceIds.has(source.id)) {
    fail("Source ids must be present and unique.", { id: source.id });
  }
  sourceIds.add(source.id);
  if (!source.name) {
    fail("Source is missing a name.", { sourceId: source.id });
  }
  if (!isHttpUrl(source.sourceUrl)) {
    fail("Source is missing a valid sourceUrl.", { sourceId: source.id, sourceUrl: source.sourceUrl });
  }
  if (!["CC0-1.0", "CC-BY-4.0", "MIT"].includes(source.license)) {
    fail("Source license is not currently allowed for this project.", { sourceId: source.id, license: source.license });
  }
  if (source.license !== "CC0-1.0" && source.attributionRequired !== true) {
    fail("Non-CC0 sources must declare attributionRequired.", { sourceId: source.id, license: source.license });
  }
  if (source.commercialUse !== true) {
    fail("Source must explicitly allow commercial use.", { sourceId: source.id });
  }
  if (asArray(source.formats).length === 0) {
    fail("Source must declare available formats.", { sourceId: source.id });
  }
}

const assets = asArray(manifest.assets);
const assetIds = new Set();
const heroLocations = new Set(asArray(manifest.heroLocations));
const terrainRoles = new Set(asArray(manifest.terrainRoles));
const productionLicenseAssets = [];
const declaredRuntimeGlbs = new Set();

for (const asset of assets) {
  if (!asset.id || assetIds.has(asset.id)) {
    fail("Asset ids must be present and unique.", { id: asset.id });
  }
  assetIds.add(asset.id);

  if (!allowedStatuses.has(asset.status)) {
    fail("Asset has an unknown status.", { assetId: asset.id, status: asset.status });
  }
  if (!sourceIds.has(asset.sourceId)) {
    fail("Asset sourceId does not match a declared source.", { assetId: asset.id, sourceId: asset.sourceId });
  }
  if (!asset.kind) {
    fail("Asset must declare kind.", { assetId: asset.id });
  }
  if (!asset.target) {
    fail("Asset must declare target.", { assetId: asset.id });
  }
  if (!asset.terrainRole) {
    fail("Asset must declare terrainRole.", { assetId: asset.id });
  }
  if (!asset.narrativeRole || asset.narrativeRole.length < 24) {
    fail("Asset must declare a meaningful narrativeRole.", { assetId: asset.id });
  }
  if (!asset.preferredFormat) {
    fail("Asset must declare preferredFormat.", { assetId: asset.id });
  }
  if (!asset.nextAction || asset.nextAction.length < 24) {
    fail("Candidate assets must keep a concrete nextAction.", { assetId: asset.id });
  }
  if (!asset.budget || !isPositiveNumber(asset.budget.maxKb)) {
    fail("Asset must declare a positive maxKb budget.", { assetId: asset.id, budget: asset.budget });
  }

  const source = sources.find((item) => item.id === asset.sourceId);
  if (source?.license !== "CC0-1.0") {
    productionLicenseAssets.push({ assetId: asset.id, sourceId: asset.sourceId, license: source?.license });
  }

  if (asset.status === "accepted" || asset.status === "integrated") {
    let localAnalysis = null;
    if (!asset.localPath) {
      fail("Accepted or integrated assets must declare localPath.", { assetId: asset.id, status: asset.status });
    } else {
      const localPath = path.join(root, asset.localPath);
      if (!fs.existsSync(localPath)) {
        fail("Accepted or integrated asset localPath does not exist.", { assetId: asset.id, localPath: asset.localPath });
      } else {
        localAnalysis = analyzeLocalAsset(asset.id, asset.localPath);
      }
    }
    if (!isPositiveNumber(asset.fileKb)) {
      fail("Accepted or integrated assets must declare fileKb.", { assetId: asset.id, fileKb: asset.fileKb });
    }
    if (asset.kind.includes("model") && !isPositiveNumber(asset.triangles)) {
      fail("Accepted or integrated model assets must declare triangle count.", { assetId: asset.id, triangles: asset.triangles });
    }
    if (!asset.proceduralFallback || asset.proceduralFallback.length < 24) {
      fail("Accepted or integrated assets must declare a proceduralFallback.", {
        assetId: asset.id,
        proceduralFallback: asset.proceduralFallback
      });
    }
    if (!asset.publicPath || asset.publicPath.startsWith("/") || asset.publicPath.startsWith("public/")) {
      fail("Accepted or integrated assets must declare a GitHub Pages-safe publicPath.", {
        assetId: asset.id,
        publicPath: asset.publicPath
      });
    }
    if (asset.localPath && asset.publicPath && asset.publicPath !== toPublicPath(asset.localPath)) {
      fail("Accepted or integrated publicPath must match localPath without the public prefix.", {
        assetId: asset.id,
        localPath: asset.localPath,
        publicPath: asset.publicPath,
        expectedPublicPath: toPublicPath(asset.localPath)
      });
    }
    if (localAnalysis) {
      if (!roughlyEqual(localAnalysis.fileKb, asset.fileKb)) {
        fail("Accepted or integrated asset fileKb must match local files.", {
          assetId: asset.id,
          declared: asset.fileKb,
          actual: localAnalysis.fileKb
        });
      }
      if (asset.kind.includes("model")) {
        if (localAnalysis.modelFiles === 0) {
          fail("Accepted or integrated model assets must include at least one GLB file.", {
            assetId: asset.id,
            localPath: asset.localPath
          });
        }
        if (localAnalysis.triangles !== asset.triangles) {
          fail("Accepted or integrated model triangle count must match GLB contents.", {
            assetId: asset.id,
            declared: asset.triangles,
            actual: localAnalysis.triangles
          });
        }
        if (localAnalysis.fileKb > Math.min(asset.budget.maxKb, budgets.acceptedModelMaxKb)) {
          fail("Accepted model asset is over its file size budget.", {
            assetId: asset.id,
            actualKb: localAnalysis.fileKb,
            budgetKb: Math.min(asset.budget.maxKb, budgets.acceptedModelMaxKb)
          });
        }
        if (isPositiveNumber(asset.budget.targetTriangles) && localAnalysis.triangles > asset.budget.targetTriangles) {
          fail("Accepted model asset is over its triangle budget.", {
            assetId: asset.id,
            actualTriangles: localAnalysis.triangles,
            targetTriangles: asset.budget.targetTriangles
          });
        }
      }
      if (asset.kind === "texture-set" && localAnalysis.fileKb > Math.min(asset.budget.maxKb, budgets.acceptedTextureMaxKb)) {
        fail("Accepted texture asset is over its file size budget.", {
          assetId: asset.id,
          actualKb: localAnalysis.fileKb,
          budgetKb: Math.min(asset.budget.maxKb, budgets.acceptedTextureMaxKb)
        });
      }
      if (Array.isArray(asset.selectedFiles) && asset.selectedFiles.length !== localAnalysis.modelFiles) {
        fail("Accepted model selectedFiles must match the local GLB count.", {
          assetId: asset.id,
          selectedFiles: asset.selectedFiles.length,
          modelFiles: localAnalysis.modelFiles
        });
      }
      for (const glbFile of listFiles(path.join(root, asset.localPath)).filter((file) => file.endsWith(".glb"))) {
        declaredRuntimeGlbs.add(path.relative(root, glbFile));
      }
    }
    if (asset.status === "integrated" && !asset.qaProof) {
      fail("Integrated assets must declare a qaProof reference.", { assetId: asset.id });
    }
  }
}

const vendorModelsPath = path.join(root, "public", "assets", "models", "vendor");
if (fs.existsSync(vendorModelsPath)) {
  const orphanGlbs = listFiles(vendorModelsPath)
    .filter((file) => file.endsWith(".glb"))
    .map((file) => path.relative(root, file))
    .filter((file) => !declaredRuntimeGlbs.has(file));

  if (orphanGlbs.length > 0) {
    fail("Runtime vendor GLB files must be declared by accepted or integrated manifest entries.", { orphanGlbs });
  }
}

const candidateAssets = assets.filter((asset) => asset.status === "candidate");
if (candidateAssets.length < 14) {
  fail("The first asset-first pass must curate a broad candidate library.", { candidateCount: candidateAssets.length, required: 14 });
}

for (const role of terrainRoles) {
  const count = assets.filter((asset) => asset.terrainRole === role && asset.status !== "rejected").length;
  if (count === 0) {
    fail("Terrain role has no candidate asset.", { role });
  }
}

for (const zoneId of heroLocations) {
  const zoneAssets = assets.filter((asset) => asset.target === zoneId && asset.status !== "rejected");
  if (zoneAssets.length < 2) {
    fail("Hero location needs at least two curated candidate assets.", { zoneId, count: zoneAssets.length });
  }
}

const textureCandidates = assets.filter((asset) => asset.kind === "texture-set" && asset.status !== "rejected");
if (textureCandidates.length < 3) {
  fail("Asset-first library needs texture candidates before map expansion.", { textureCandidateCount: textureCandidates.length });
}

const ccByProductionAssets = productionLicenseAssets.filter((asset) => {
  const source = sources.find((item) => item.id === asset.sourceId);
  return source?.kind !== "pipeline-reference";
});
if (ccByProductionAssets.length > 0) {
  warn("Non-CC0 production candidates need explicit attribution UI before acceptance.", { assets: ccByProductionAssets });
}

const summary = {
  sources: sources.length,
  assets: assets.length,
  candidates: candidateAssets.length,
  textureCandidates: textureCandidates.length,
  heroLocations: [...heroLocations],
  terrainRoles: [...terrainRoles],
  warnings,
  failures
};

if (failures.length > 0) {
  console.error(JSON.stringify(summary, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(summary, null, 2));
}
