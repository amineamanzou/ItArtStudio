import fs from "node:fs";
import crypto from "node:crypto";
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
const isTextureFile = (file) => /\.(avif|jpe?g|png|svg|webp)$/iu.test(file);
const isModelFile = (file) => /\.(glb|gltf)$/iu.test(file);

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

const readModelJson = (filePath) => {
  if (filePath.endsWith(".glb")) {
    return readGlbJsonChunk(filePath);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const countModelTriangles = (filePath) => {
  const gltf = readModelJson(filePath);
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

const validateModelExternalReferences = (filePath) => {
  const gltf = readModelJson(filePath);
  if (!gltf) {
    return;
  }

  const validateUri = (uri, kind) => {
    if (typeof uri !== "string" || uri.startsWith("data:")) {
      return;
    }

    if (uri.startsWith("/") || uri.startsWith("public/") || uri.split(/[\\/]/u).includes("..")) {
      fail(`Model ${kind} URI must stay relative to the model folder.`, { filePath, uri });
      return;
    }

    const referencedPath = path.join(path.dirname(filePath), uri);
    if (!fs.existsSync(referencedPath)) {
      fail(`Model ${kind} URI does not resolve to a local file.`, {
        filePath,
        uri,
        expectedPath: path.relative(root, referencedPath)
      });
    }
  };

  for (const image of asArray(gltf.images)) {
    validateUri(image?.uri, "image");
  }
  for (const buffer of asArray(gltf.buffers)) {
    validateUri(buffer?.uri, "buffer");
  }
};

const analyzeLocalAsset = (assetId, localPath) => {
  const absolutePath = path.join(root, localPath);
  const files = listFiles(absolutePath);
  const modelFiles = files.filter(isModelFile);
  const textureFiles = files.filter(isTextureFile);
  const fileKb = roundTenth(files.reduce((total, file) => total + fs.statSync(file).size / 1024, 0));
  const triangles = modelFiles.reduce((total, file) => total + countModelTriangles(file), 0);
  modelFiles.forEach(validateModelExternalReferences);

  return {
    assetId,
    fileKb,
    triangles,
    modelFiles: modelFiles.length,
    textureFiles: textureFiles.length,
    modelFileNames: modelFiles.map((file) => path.basename(file)),
    textureFileNames: textureFiles.map((file) => path.basename(file)),
    files: files.length
  };
};

const roughlyEqual = (actual, declared) => Math.abs(actual - declared) <= Math.max(0.2, actual * 0.01);
const toPublicPath = (localPath) => (localPath.startsWith("public/") ? localPath.slice("public/".length) : localPath);
const hashFileSha256 = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

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
const heroLocationCuration = manifest.heroLocationCuration ?? {};
const terrainRoles = new Set(asArray(manifest.terrainRoles));
const mapExpansionKits = asArray(manifest.mapExpansionKits);
const terrainAssetSourcingBacklog = asArray(manifest.terrainAssetSourcingBacklog);
const corePromotion = manifest.corePromotion ?? null;
const publicTerrainCore = manifest.publicTerrainCore ?? null;
const terrainShell = manifest.terrainShell ?? null;
const assetUtilizationWave = manifest.assetUtilizationWave ?? null;
const assetDetailWave = manifest.assetDetailWave ?? null;
const terrainTransitionWave = manifest.terrainTransitionWave ?? null;
const productionLicenseAssets = [];
const declaredRuntimeModels = new Set();
const declaredRuntimeTextures = new Set();

const allowedSourcingBacklogStatuses = new Set(["research", "candidate", "accepted", "rejected"]);
const terrainSourcingBacklogIds = new Set();
for (const item of terrainAssetSourcingBacklog) {
  if (!item.id || terrainSourcingBacklogIds.has(item.id)) {
    fail("Terrain asset sourcing backlog ids must be present and unique.", { id: item.id });
  }
  terrainSourcingBacklogIds.add(item.id);

  if (!allowedSourcingBacklogStatuses.has(item.status)) {
    fail("Terrain asset sourcing backlog item has an unknown status.", { id: item.id, status: item.status });
  }
  if (!sourceIds.has(item.sourceId)) {
    fail("Terrain asset sourcing backlog item sourceId must match a declared source.", {
      id: item.id,
      sourceId: item.sourceId
    });
  }
  if (!isHttpUrl(item.sourceUrl)) {
    fail("Terrain asset sourcing backlog item must declare a valid sourceUrl.", { id: item.id, sourceUrl: item.sourceUrl });
  }
  for (const key of ["assetPageUrl", "downloadUrl", "licenseUrl"]) {
    if (!isHttpUrl(item[key])) {
      fail("Terrain asset sourcing backlog item must declare a valid URL field.", { id: item.id, key, value: item[key] });
    }
  }
  if (!["CC0-1.0", "CC-BY-4.0", "MIT"].includes(item.license)) {
    fail("Terrain asset sourcing backlog item uses a disallowed license.", { id: item.id, license: item.license });
  }
  const source = sources.find((sourceItem) => sourceItem.id === item.sourceId);
  if (source && item.license !== source.license) {
    fail("Terrain asset sourcing backlog license must match its declared source.", {
      id: item.id,
      sourceId: item.sourceId,
      backlogLicense: item.license,
      sourceLicense: source.license
    });
  }
  if (item.license !== "CC0-1.0") {
    fail("Terrain asset sourcing backlog must stay CC0 until attribution UI exists.", { id: item.id, license: item.license });
  }
  if (item.commercialUse !== true) {
    fail("Terrain asset sourcing backlog item must explicitly allow commercial use.", { id: item.id });
  }
  if (item.attributionRequired !== false) {
    fail("Terrain asset sourcing backlog item must remain attribution-free until attribution UI exists.", {
      id: item.id,
      attributionRequired: item.attributionRequired
    });
  }
  if (typeof item.retrievedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(item.retrievedAt)) {
    fail("Terrain asset sourcing backlog item must declare a YYYY-MM-DD retrievedAt date.", {
      id: item.id,
      retrievedAt: item.retrievedAt
    });
  }
  if (asArray(item.terrainRoles).length === 0) {
    fail("Terrain asset sourcing backlog item must target at least one terrain role.", { id: item.id });
  }
  for (const role of asArray(item.terrainRoles)) {
    if (!terrainRoles.has(role)) {
      fail("Terrain asset sourcing backlog item targets an unknown terrain role.", {
        id: item.id,
        role,
        terrainRoles: [...terrainRoles].sort()
      });
    }
  }
  if (asArray(item.assetClasses).length === 0) {
    fail("Terrain asset sourcing backlog item must declare assetClasses.", { id: item.id });
  }
  if (asArray(item.formats).length === 0) {
    fail("Terrain asset sourcing backlog item must declare formats.", { id: item.id });
  }
  if (!Number.isInteger(item.priority) || item.priority < 1 || item.priority > 5) {
    fail("Terrain asset sourcing backlog priority must be an integer from 1 to 5.", {
      id: item.id,
      priority: item.priority
    });
  }
  if (!item.targetUse || item.targetUse.length < 48) {
    fail("Terrain asset sourcing backlog item must describe a concrete targetUse.", { id: item.id });
  }
  if (!item.targetLayer || item.targetLayer.length < 12) {
    fail("Terrain asset sourcing backlog item must bind to a concrete targetLayer.", { id: item.id, targetLayer: item.targetLayer });
  }
  if (!item.acceptanceGate || item.acceptanceGate.length < 48) {
    fail("Terrain asset sourcing backlog item must define a concrete acceptanceGate.", { id: item.id });
  }
  if (asArray(item.rejectIf).length < 3) {
    fail("Terrain asset sourcing backlog item must declare at least three rejectIf conditions.", {
      id: item.id,
      rejectIf: item.rejectIf
    });
  }
  if (!item.fallbackPolicy || item.fallbackPolicy.length < 48) {
    fail("Terrain asset sourcing backlog item must define a public fallbackPolicy.", { id: item.id });
  }
  if (/(draw|generate|generated|procedural).*(cone|disk|disc|sphere|rectangle|plate|halo|marker|blob|primitive|pattern)/iu.test(item.fallbackPolicy)) {
    fail("Terrain asset sourcing backlog fallbackPolicy cannot permit generated placeholder substitutes.", {
      id: item.id,
      fallbackPolicy: item.fallbackPolicy
    });
  }
  if (!item.nextAction || item.nextAction.length < 48) {
    fail("Terrain asset sourcing backlog item must keep a concrete nextAction.", { id: item.id });
  }
  if (!item.qaGate) {
    fail("Terrain asset sourcing backlog item must bind to a QA gate.", { id: item.id });
  }
  const budget = item.budget ?? {};
  if (!isPositiveNumber(budget.maxKb)) {
    fail("Terrain asset sourcing backlog item must declare a positive maxKb budget.", { id: item.id, budget });
  }
  if (!isPositiveNumber(budget.targetFiles)) {
    fail("Terrain asset sourcing backlog item must declare a positive targetFiles budget.", { id: item.id, budget });
  }
  if (asArray(item.formats).some((format) => ["glTF", "GLB", "FBX", "OBJ", "Blend"].includes(format))) {
    if (!isPositiveNumber(budget.targetTriangles)) {
      fail("Terrain model sourcing backlog item must declare a targetTriangles budget.", { id: item.id, budget });
    }
  }
  if (asArray(item.formats).includes("textures") && !isPositiveNumber(budget.targetResolution)) {
    fail("Terrain texture sourcing backlog item must declare a targetResolution budget.", { id: item.id, budget });
  }

  if (["candidate", "accepted"].includes(item.status)) {
    if (typeof item.downloadedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(item.downloadedAt)) {
      fail("Candidate terrain sourcing backlog item must declare a YYYY-MM-DD downloadedAt date.", {
        id: item.id,
        downloadedAt: item.downloadedAt
      });
    }
    if (typeof item.archiveSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.archiveSha256)) {
      fail("Candidate terrain sourcing backlog item must declare a SHA-256 archive hash.", {
        id: item.id,
        archiveSha256: item.archiveSha256
      });
    }
    if (typeof item.quarantineInventory !== "string" || !fs.existsSync(path.join(root, item.quarantineInventory))) {
      fail("Candidate terrain sourcing backlog item must point to an existing quarantineInventory.", {
        id: item.id,
        quarantineInventory: item.quarantineInventory
      });
    }
    if (typeof item.quarantinePath !== "string" || !fs.existsSync(path.join(root, item.quarantinePath))) {
      fail("Candidate terrain sourcing backlog item must point to an existing quarantinePath.", {
        id: item.id,
        quarantinePath: item.quarantinePath
      });
    }
    if (asArray(item.candidateFiles).length === 0) {
      fail("Candidate terrain sourcing backlog item must list candidateFiles.", { id: item.id });
    }
    let inventoryPack = null;
    if (typeof item.quarantineInventory === "string" && fs.existsSync(path.join(root, item.quarantineInventory))) {
      try {
        const quarantineInventory = JSON.parse(fs.readFileSync(path.join(root, item.quarantineInventory), "utf8"));
        inventoryPack = asArray(quarantineInventory.packs).find((pack) => pack.backlogId === item.id);
        if (!inventoryPack) {
          fail("Candidate terrain sourcing backlog item must have a matching pack in quarantineInventory.", {
            id: item.id,
            quarantineInventory: item.quarantineInventory
          });
        } else {
          if (inventoryPack.archiveSha256 !== item.archiveSha256) {
            fail("Candidate terrain sourcing backlog archiveSha256 must match quarantineInventory.", {
              id: item.id,
              manifestSha256: item.archiveSha256,
              inventorySha256: inventoryPack.archiveSha256
            });
          }
          const inventoryCandidateFiles = new Set(
            asArray(inventoryPack.models)
              .filter((model) => model.decision === "candidate")
              .map((model) => `${model.name}.glb`)
          );
          for (const file of asArray(item.candidateFiles)) {
            if (!inventoryCandidateFiles.has(file)) {
              fail("Candidate terrain sourcing backlog file must be marked candidate in quarantineInventory.", {
                id: item.id,
                file,
                inventoryCandidates: [...inventoryCandidateFiles].sort()
              });
            }
          }
        }
      } catch (error) {
        fail("Candidate terrain sourcing backlog quarantineInventory must be valid JSON.", {
          id: item.id,
          quarantineInventory: item.quarantineInventory,
          error: String(error)
        });
      }
    }
    for (const file of asArray(item.candidateFiles)) {
      if (typeof file !== "string" || !isModelFile(file)) {
        fail("Candidate terrain sourcing backlog candidateFiles must be GLB/glTF names.", { id: item.id, file });
        continue;
      }
      const candidateFilePath = path.join(root, item.quarantinePath ?? "", file);
      if (!fs.existsSync(candidateFilePath)) {
        fail("Candidate terrain sourcing backlog file does not exist in quarantinePath.", {
          id: item.id,
          file,
          quarantinePath: item.quarantinePath
        });
      }
    }
  }
}

if (terrainAssetSourcingBacklog.length < 5) {
  fail("Terrain-first work must keep a broad sourcing backlog before enlarging the map.", {
    count: terrainAssetSourcingBacklog.length,
    required: 5
  });
}

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
          fail("Accepted or integrated model assets must include at least one GLB or glTF file.", {
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
      if (asset.kind === "texture-set") {
        if (localAnalysis.textureFiles === 0) {
          fail("Accepted texture assets must include at least one runtime texture file.", {
            assetId: asset.id,
            localPath: asset.localPath
          });
        }
        if (!isPositiveNumber(asset.budget.targetResolution)) {
          fail("Accepted texture assets must declare a targetResolution budget.", {
            assetId: asset.id,
            budget: asset.budget
          });
        }
      }
      if (asset.kind.includes("model")) {
        if (Array.isArray(asset.selectedFiles) && asset.selectedFiles.length !== localAnalysis.modelFiles) {
          fail("Accepted model selectedFiles must match the local GLB count.", {
            assetId: asset.id,
            selectedFiles: asset.selectedFiles.length,
            modelFiles: localAnalysis.modelFiles
          });
        }
        const localModelFiles = listFiles(path.join(root, asset.localPath)).filter(isModelFile);
        const localModelNames = new Set(localModelFiles.map((file) => path.basename(file)));
        for (const selectedFile of asArray(asset.selectedFiles)) {
          if (typeof selectedFile !== "string" || !localModelNames.has(selectedFile)) {
            fail("Accepted model selectedFiles must name an existing local GLB or glTF.", {
              assetId: asset.id,
              selectedFile
            });
          }
        }
        for (const modelFile of localModelFiles) {
          if (Array.isArray(asset.selectedFiles) && !asset.selectedFiles.includes(path.basename(modelFile))) {
            fail("Accepted local model file must be listed in selectedFiles.", {
              assetId: asset.id,
              modelFile: path.relative(root, modelFile)
            });
          }
          declaredRuntimeModels.add(path.relative(root, modelFile));
        }
      }
      if (asset.kind === "texture-set") {
        if (Array.isArray(asset.selectedFiles) && asset.selectedFiles.length !== localAnalysis.textureFiles) {
          fail("Accepted texture selectedFiles must match the local texture count.", {
            assetId: asset.id,
            selectedFiles: asset.selectedFiles.length,
            textureFiles: localAnalysis.textureFiles
          });
        }
        const localTextureFiles = listFiles(path.join(root, asset.localPath)).filter(isTextureFile);
        const localTextureNames = new Set(localTextureFiles.map((file) => path.basename(file)));
        for (const selectedFile of asArray(asset.selectedFiles)) {
          if (typeof selectedFile !== "string" || !localTextureNames.has(selectedFile)) {
            fail("Accepted texture selectedFiles must name an existing local texture.", {
              assetId: asset.id,
              selectedFile
            });
          }
        }
        for (const textureFile of localTextureFiles) {
          if (Array.isArray(asset.selectedFiles) && !asset.selectedFiles.includes(path.basename(textureFile))) {
            fail("Accepted local texture must be listed in selectedFiles.", {
              assetId: asset.id,
              textureFile: path.relative(root, textureFile)
            });
          }
          declaredRuntimeTextures.add(path.relative(root, textureFile));
        }
      }
    }
    if (asset.status === "integrated" && !asset.qaProof) {
      fail("Integrated assets must declare a qaProof reference.", { assetId: asset.id });
    }
  }
}

const vendorModelsPath = path.join(root, "public", "assets", "models", "vendor");
if (fs.existsSync(vendorModelsPath)) {
  const orphanModels = listFiles(vendorModelsPath)
    .filter(isModelFile)
    .map((file) => path.relative(root, file))
    .filter((file) => !declaredRuntimeModels.has(file));

  if (orphanModels.length > 0) {
    fail("Runtime vendor model files must be declared by accepted or integrated manifest entries.", { orphanModels });
  }
}

const localModelsPath = path.join(root, "public", "assets", "models", "local");
if (fs.existsSync(localModelsPath)) {
  const orphanModels = listFiles(localModelsPath)
    .filter(isModelFile)
    .map((file) => path.relative(root, file))
    .filter((file) => !declaredRuntimeModels.has(file));

  if (orphanModels.length > 0) {
    fail("Runtime local model files must be declared by accepted or integrated manifest entries.", { orphanModels });
  }
}

const runtimeTexturesPath = path.join(root, "public", "assets", "textures", "map");
if (fs.existsSync(runtimeTexturesPath)) {
  const orphanTextures = listFiles(runtimeTexturesPath)
    .filter(isTextureFile)
    .map((file) => path.relative(root, file))
    .filter((file) => !declaredRuntimeTextures.has(file));

  if (orphanTextures.length > 0) {
    fail("Runtime map texture files must be declared by accepted or integrated manifest entries.", { orphanTextures });
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

  const curation = heroLocationCuration[zoneId];
  if (!curation) {
    fail("Hero location must declare a curation contract.", { zoneId });
    continue;
  }
  if (!curation.visualSignature || curation.visualSignature.length < 72) {
    fail("Hero location curation needs a concrete visualSignature.", { zoneId, visualSignature: curation.visualSignature });
  }
  if (!Number.isInteger(curation.minRuntimePlacements) || curation.minRuntimePlacements < 6) {
    fail("Hero location curation must require enough runtime placements to be visually legible.", {
      zoneId,
      minRuntimePlacements: curation.minRuntimePlacements
    });
  }
  if (asArray(curation.requiredVisualRoles).length < 6) {
    fail("Hero location curation must define at least six visual roles.", {
      zoneId,
      requiredVisualRoles: curation.requiredVisualRoles
    });
  }
  if (!curation.nextCustomAsset || curation.nextCustomAsset.length < 48) {
    fail("Hero location curation must name the next custom or sourced asset gap.", {
      zoneId,
      nextCustomAsset: curation.nextCustomAsset
    });
  }
  for (const assetId of asArray(curation.requiredAssetIds)) {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset || (asset.status !== "accepted" && asset.status !== "integrated")) {
      fail("Hero location curation requiredAssetIds must point to accepted or integrated assets.", {
        zoneId,
        assetId,
        status: asset?.status
      });
    }
  }
}

const textureCandidates = assets.filter((asset) => asset.kind === "texture-set" && asset.status !== "rejected");
if (textureCandidates.length < 3) {
  fail("Asset-first library needs texture candidates before map expansion.", { textureCandidateCount: textureCandidates.length });
}

const acceptedMapTextureRoles = new Set(
  assets
    .filter((asset) => (asset.status === "accepted" || asset.status === "integrated") && asset.kind === "texture-set" && asset.target === "map")
    .map((asset) => asset.terrainRole)
);
for (const role of ["road", "water", "relief", "vegetation"]) {
  if (!acceptedMapTextureRoles.has(role)) {
    fail("Map expansion requires accepted runtime texture coverage for core terrain roles.", {
      role,
      acceptedMapTextureRoles: [...acceptedMapTextureRoles].sort()
    });
  }
}

const acceptedRuntimeAssets = new Map(
  assets.filter((asset) => asset.status === "accepted" || asset.status === "integrated").map((asset) => [asset.id, asset])
);
const generatedRuntimeAssets = [...acceptedRuntimeAssets.values()].filter(
  (asset) => asset.sourceId === "itart-signature-kit" || String(asset.publicPath ?? "").includes("local/itart-signature-kit")
);
if (generatedRuntimeAssets.length > 0) {
  fail("Generated local IT Art Studio GLB assets are not allowed in accepted runtime anymore.", {
    assetIds: generatedRuntimeAssets.map((asset) => asset.id)
  });
}
const acceptedRuntimeTextures = new Map(
  [...acceptedRuntimeAssets.values()].filter((asset) => asset.kind === "texture-set" && asset.target === "map").map((asset) => [asset.id, asset])
);

if (!publicTerrainCore) {
  fail("Public terrain core contract is required for the asset-only public runtime.");
} else {
  const acceptedRuntimeModelAssets = [...acceptedRuntimeAssets.values()].filter((asset) => asset.kind.includes("model"));
  const allowedPublicTerrainAssetIds = new Set([
    ...asArray(publicTerrainCore.requiredAssetIds),
    publicTerrainCore.requiredPlayerAssetId
  ]);
  const modelAssetsBySelectedFile = new Map();
  for (const modelAsset of acceptedRuntimeModelAssets) {
    for (const selectedFile of asArray(modelAsset.selectedFiles)) {
      if (typeof selectedFile !== "string") {
        continue;
      }
      modelAssetsBySelectedFile.set(selectedFile, [...(modelAssetsBySelectedFile.get(selectedFile) ?? []), modelAsset]);
    }
  }

  for (const assetId of allowedPublicTerrainAssetIds) {
    const asset = acceptedRuntimeAssets.get(assetId);
    if (!asset || !asset.kind.includes("model")) {
      fail("Public terrain core required model assets must point to accepted or integrated model assets.", {
        assetId,
        status: asset?.status,
        kind: asset?.kind
      });
      continue;
    }

    const source = sources.find((item) => item.id === asset.sourceId);
    if (source?.license !== "CC0-1.0") {
      fail("Public terrain core required model assets must use a CC0 source.", {
        assetId,
        sourceId: asset.sourceId,
        license: source?.license
      });
    }
  }

  const forbiddenPublicTerrainFiles = new Set(asArray(publicTerrainCore.forbiddenFiles));
  for (const requiredFile of asArray(publicTerrainCore.requiredFiles)) {
    if (typeof requiredFile !== "string" || requiredFile.length === 0 || !isModelFile(requiredFile)) {
      fail("Public terrain core required model files must be non-empty GLB/glTF filenames.", { requiredFile });
      continue;
    }
    if (requiredFile.includes("/") || requiredFile.includes("\\") || requiredFile.split(/[\\/]/u).includes("..")) {
      fail("Public terrain core required model files must be bare filenames, not paths.", { requiredFile });
      continue;
    }
    if (forbiddenPublicTerrainFiles.has(requiredFile)) {
      fail("Public terrain core cannot require a model file that is also forbidden.", { requiredFile });
      continue;
    }

    const candidateAssets = asArray(modelAssetsBySelectedFile.get(requiredFile)).filter((asset) =>
      allowedPublicTerrainAssetIds.has(asset.id)
    );
    if (candidateAssets.length === 0) {
      fail("Public terrain core required model file must belong to a required accepted/integrated asset.", {
        requiredFile,
        allowedAssetIds: [...allowedPublicTerrainAssetIds].filter(Boolean).sort()
      });
      continue;
    }

    for (const asset of candidateAssets) {
      if (!asset.publicPath?.startsWith("assets/models/vendor/")) {
        fail("Public terrain core required model files must come from downloaded vendor assets.", {
          requiredFile,
          assetId: asset.id,
          publicPath: asset.publicPath
        });
      }
      const localModelPath = path.join(root, "public", asset.publicPath ?? "", requiredFile);
      if (!fs.existsSync(localModelPath)) {
        fail("Public terrain core required model file does not exist locally.", {
          requiredFile,
          assetId: asset.id,
          expectedPath: path.relative(root, localModelPath)
        });
      }
    }
  }

  for (const requiredPlacementId of asArray(publicTerrainCore.requiredPlacementIds)) {
    if (typeof requiredPlacementId !== "string" || !requiredPlacementId.startsWith("terrain-core:")) {
      fail("Public terrain core requiredPlacementIds must be stable terrain-core placement ids.", { requiredPlacementId });
    }
  }

  for (const boardwalkFile of asArray(publicTerrainCore.requiredBoardwalkFiles)) {
    if (!asArray(publicTerrainCore.requiredFiles).includes(boardwalkFile)) {
      fail("Public terrain core boardwalk files must also be required model files.", { boardwalkFile });
    }
    if (!/^path_wood(?:Corner)?\.glb$/u.test(boardwalkFile)) {
      fail("Public terrain core boardwalk files must stay limited to Kenney path_wood GLB assets.", { boardwalkFile });
    }
  }

  for (const boardwalkPlacementId of asArray(publicTerrainCore.requiredBoardwalkPlacementIds)) {
    if (!asArray(publicTerrainCore.requiredPlacementIds).includes(boardwalkPlacementId)) {
      fail("Public terrain core boardwalk placements must also be required terrain placements.", { boardwalkPlacementId });
    }
    if (!boardwalkPlacementId.startsWith("terrain-core:path-boardwalk-")) {
      fail("Public terrain core boardwalk placements must use the path-boardwalk namespace.", { boardwalkPlacementId });
    }
  }

  if (
    !Number.isInteger(publicTerrainCore.minimumVisibleBoardwalkPlacements) ||
    publicTerrainCore.minimumVisibleBoardwalkPlacements < 1
  ) {
    fail("Public terrain core boardwalk proof must require at least one visible placement.", {
      minimumVisibleBoardwalkPlacements: publicTerrainCore.minimumVisibleBoardwalkPlacements
    });
  }

  for (const shorelineReliefFile of asArray(publicTerrainCore.requiredShorelineReliefFiles)) {
    if (!asArray(publicTerrainCore.requiredFiles).includes(shorelineReliefFile)) {
      fail("Public terrain core shoreline relief files must also be required model files.", { shorelineReliefFile });
    }
    if (!/^(?:cliff_[a-zA-Z]+_rock|rock_(?:large[A-Z]|smallFlat[A-Z]))\.glb$/u.test(shorelineReliefFile)) {
      fail("Public terrain core shoreline relief files must stay limited to Kenney natural cliff/rock GLB assets.", {
        shorelineReliefFile
      });
    }
  }

  for (const shorelineReliefPlacementId of asArray(publicTerrainCore.requiredShorelineReliefPlacementIds)) {
    if (!asArray(publicTerrainCore.requiredPlacementIds).includes(shorelineReliefPlacementId)) {
      fail("Public terrain core shoreline relief placements must also be required terrain placements.", {
        shorelineReliefPlacementId
      });
    }
    if (!shorelineReliefPlacementId.startsWith("terrain-core:shoreline-")) {
      fail("Public terrain core shoreline relief placements must use the shoreline namespace.", {
        shorelineReliefPlacementId
      });
    }
  }

  if (
    !Number.isInteger(publicTerrainCore.minimumVisibleShorelineReliefPlacements) ||
    publicTerrainCore.minimumVisibleShorelineReliefPlacements < 1
  ) {
    fail("Public terrain core shoreline relief proof must require at least one visible placement.", {
      minimumVisibleShorelineReliefPlacements: publicTerrainCore.minimumVisibleShorelineReliefPlacements
    });
  }

  for (const outerBandProof of asArray(publicTerrainCore.requiredOuterBandProofs)) {
    if (typeof outerBandProof?.id !== "string" || outerBandProof.id.length === 0) {
      fail("Public terrain core outer band proof must have a stable id.", { outerBandProof });
    }
    if (!Number.isFinite(outerBandProof?.position?.x) || !Number.isFinite(outerBandProof?.position?.z)) {
      fail("Public terrain core outer band proof must define numeric x/z position.", { outerBandProof });
    }
    const placementIds = asArray(outerBandProof?.requiredPlacementIds);
    if (placementIds.length < 2) {
      fail("Public terrain core outer band proof must require at least two placements.", { outerBandProof });
    }
    for (const placementId of placementIds) {
      if (!asArray(publicTerrainCore.requiredPlacementIds).includes(placementId)) {
        fail("Public terrain core outer band proof placements must also be required terrain placements.", {
          outerBandProofId: outerBandProof?.id,
          placementId
        });
      }
    }
    if (!Number.isInteger(outerBandProof?.minimumVisiblePlacements) || outerBandProof.minimumVisiblePlacements < 1) {
      fail("Public terrain core outer band proof must require visible placements.", { outerBandProof });
    }
  }

  const textureAssetsByPublicFile = new Map();
  for (const textureAsset of acceptedRuntimeTextures.values()) {
    for (const selectedFile of asArray(textureAsset.selectedFiles)) {
      if (typeof selectedFile !== "string" || !textureAsset.publicPath) {
        continue;
      }
      textureAssetsByPublicFile.set(path.posix.join(textureAsset.publicPath, selectedFile), textureAsset);
    }
  }

  const requiredTerrainTextureFiles = asArray(publicTerrainCore.requiredTerrainTextureFiles);
  const requiredTerrainMaterialRoles = asArray(publicTerrainCore.requiredTerrainMaterialRoles);
  if (requiredTerrainTextureFiles.length < requiredTerrainMaterialRoles.length) {
    fail("Public terrain core must bind a downloaded texture file to every required material role.", {
      requiredTerrainTextureFiles,
      requiredTerrainMaterialRoles
    });
  }

  for (const texturePath of requiredTerrainTextureFiles) {
    if (typeof texturePath !== "string" || texturePath.length === 0) {
      fail("Public terrain core required texture files must be non-empty strings.", { texturePath });
      continue;
    }
    if (texturePath.startsWith("/") || texturePath.startsWith("public/") || texturePath.split(/[\\/]/u).includes("..")) {
      fail("Public terrain core texture paths must be GitHub Pages-safe public paths.", { texturePath });
      continue;
    }
    if (!texturePath.startsWith("assets/textures/vendor/")) {
      fail("Public terrain core textures must come from downloaded vendor assets, not authored map placeholders.", {
        texturePath
      });
    }
    if (!isTextureFile(texturePath) || /\.svg$/iu.test(texturePath)) {
      fail("Public terrain core textures must be downloaded raster texture files.", { texturePath });
    }

    const localTexturePath = path.join(root, "public", texturePath);
    if (!fs.existsSync(localTexturePath)) {
      fail("Public terrain core required texture file does not exist locally.", {
        texturePath,
        expectedPath: path.relative(root, localTexturePath)
      });
      continue;
    }

    const textureAsset = textureAssetsByPublicFile.get(texturePath);
    if (!textureAsset) {
      fail("Public terrain core required texture file must be declared by an accepted or integrated texture asset.", {
        texturePath
      });
      continue;
    }

    const source = sources.find((item) => item.id === textureAsset.sourceId);
    if (source?.license !== "CC0-1.0") {
      fail("Public terrain core required texture must use a CC0 source.", {
        texturePath,
        assetId: textureAsset.id,
        sourceId: textureAsset.sourceId,
        license: source?.license
      });
    }
    for (const key of ["assetPageUrl", "downloadUrl", "licenseUrl"]) {
      if (!isHttpUrl(textureAsset[key])) {
        fail("Public terrain core required texture asset must declare provenance URLs.", {
          texturePath,
          assetId: textureAsset.id,
          key,
          value: textureAsset[key]
        });
      }
    }
    if (!textureAsset.retrievedAt || !/^\d{4}-\d{2}-\d{2}$/u.test(textureAsset.retrievedAt)) {
      fail("Public terrain core required texture asset must declare a retrieval date.", {
        texturePath,
        assetId: textureAsset.id,
        retrievedAt: textureAsset.retrievedAt
      });
    }
    if (!/^[a-f0-9]{64}$/u.test(textureAsset.sha256 ?? "")) {
      fail("Public terrain core required texture asset must declare a sha256 hash.", {
        texturePath,
        assetId: textureAsset.id,
        sha256: textureAsset.sha256
      });
    } else {
      const actualSha256 = hashFileSha256(localTexturePath);
      if (actualSha256 !== textureAsset.sha256) {
        fail("Public terrain core required texture sha256 must match the local file.", {
          texturePath,
          assetId: textureAsset.id,
          declared: textureAsset.sha256,
          actual: actualSha256
        });
      }
    }
    if (textureAsset.status !== "integrated" || !textureAsset.qaProof) {
      fail("Public terrain core required texture assets must be integrated with QA proof.", {
        texturePath,
        assetId: textureAsset.id,
        status: textureAsset.status,
        qaProof: textureAsset.qaProof
      });
    }
  }
}

const mapExpansionKitIds = new Set();
const mapExpansionKitRoles = new Set();
let mapExpansionRuntimePlacementBudget = 0;
let mapExpansionUniqueFileBudget = 0;

if (mapExpansionKits.length < 4) {
  fail("Map expansion requires explicit asset kits before enlarging the map.", {
    kitCount: mapExpansionKits.length,
    required: 4
  });
}

for (const kit of mapExpansionKits) {
  if (!kit.id || mapExpansionKitIds.has(kit.id)) {
    fail("Map expansion kit ids must be present and unique.", { kitId: kit.id });
  }
  mapExpansionKitIds.add(kit.id);

  if (kit.phase !== "map-expansion") {
    fail("Map expansion kits must declare phase map-expansion.", { kitId: kit.id, phase: kit.phase });
  }
  if (!kit.purpose || kit.purpose.length < 72) {
    fail("Map expansion kits need a concrete visual purpose.", { kitId: kit.id, purpose: kit.purpose });
  }
  if (!kit.fallback || kit.fallback.length < 48) {
    fail("Map expansion kits must declare a runtime fallback.", { kitId: kit.id, fallback: kit.fallback });
  }
  if (!/^Public fallback /u.test(kit.fallback)) {
    fail("Map expansion kit fallback must define the public fallback first.", { kitId: kit.id, fallback: kit.fallback });
  }
  if (/procedural/iu.test(kit.fallback) && !/(legacy|QA-only)/u.test(kit.fallback)) {
    fail("Map expansion kit fallback may mention procedural systems only when confined to legacy or QA-only modes.", {
      kitId: kit.id,
      fallback: kit.fallback
    });
  }
  if (!kit.nextAction || kit.nextAction.length < 48) {
    fail("Map expansion kits must declare a concrete nextAction.", { kitId: kit.id, nextAction: kit.nextAction });
  }

  const requiredRoles = asArray(kit.requiredTerrainRoles);
  if (requiredRoles.length === 0) {
    fail("Map expansion kits must declare required terrain roles.", { kitId: kit.id });
  }
  for (const role of requiredRoles) {
    mapExpansionKitRoles.add(role);
    if (!terrainRoles.has(role)) {
      fail("Map expansion kit references an unknown terrain role.", {
        kitId: kit.id,
        role,
        terrainRoles: [...terrainRoles].sort()
      });
    }
  }

  const acceptedAssetIds = asArray(kit.acceptedAssetIds);
  if (acceptedAssetIds.length === 0) {
    fail("Map expansion kits must bind to accepted model assets.", { kitId: kit.id });
  }
  const acceptedKitAssets = acceptedAssetIds.map((assetId) => acceptedRuntimeAssets.get(assetId));
  for (const [index, asset] of acceptedKitAssets.entries()) {
    if (!asset) {
      fail("Map expansion kit acceptedAssetIds must point to accepted or integrated assets.", {
        kitId: kit.id,
        assetId: acceptedAssetIds[index]
      });
    } else if (!asset.kind.includes("model")) {
      fail("Map expansion kit acceptedAssetIds must point to model assets.", {
        kitId: kit.id,
        assetId: asset.id,
        kind: asset.kind
      });
    }
  }
  for (const role of requiredRoles) {
    if (!acceptedKitAssets.some((asset) => asset?.terrainRole === role)) {
      fail("Map expansion kit must include an accepted model asset for each required terrain role.", {
        kitId: kit.id,
        role,
        acceptedAssetIds
      });
    }
  }

  const textureAssetIds = asArray(kit.textureAssetIds);
  if (textureAssetIds.length === 0) {
    fail("Map expansion kits must bind to accepted map textures.", { kitId: kit.id });
  }
  for (const textureId of textureAssetIds) {
    if (!acceptedRuntimeTextures.has(textureId)) {
      fail("Map expansion kit textureAssetIds must point to accepted map texture assets.", {
        kitId: kit.id,
        textureId
      });
    }
  }

  if (!Number.isInteger(kit.minimumRuntimePlacements) || kit.minimumRuntimePlacements < 1) {
    fail("Map expansion kits must declare a positive minimumRuntimePlacements.", {
      kitId: kit.id,
      minimumRuntimePlacements: kit.minimumRuntimePlacements
    });
  } else {
    mapExpansionRuntimePlacementBudget += kit.minimumRuntimePlacements;
  }
  if (!Number.isInteger(kit.minimumUniqueFiles) || kit.minimumUniqueFiles < 1) {
    fail("Map expansion kits must declare a positive minimumUniqueFiles.", {
      kitId: kit.id,
      minimumUniqueFiles: kit.minimumUniqueFiles
    });
  } else {
    mapExpansionUniqueFileBudget = Math.max(mapExpansionUniqueFileBudget, kit.minimumUniqueFiles);
  }
  if (!isPositiveNumber(kit.minimumCoverage?.width) || !isPositiveNumber(kit.minimumCoverage?.depth)) {
    fail("Map expansion kits must declare positive minimumCoverage width/depth.", {
      kitId: kit.id,
      minimumCoverage: kit.minimumCoverage
    });
  }
  if (!isPositiveNumber(kit.noiseBudget?.maxClusterDensity) || !isPositiveNumber(kit.noiseBudget?.maxContextShare)) {
    fail("Map expansion kits must declare a positive noiseBudget.", {
      kitId: kit.id,
      noiseBudget: kit.noiseBudget
    });
  }

  if (Array.isArray(kit.requiredHeroLocations)) {
    for (const zoneId of heroLocations) {
      if (!kit.requiredHeroLocations.includes(zoneId)) {
        fail("Hero-location map expansion kit must cover every required hero location.", {
          kitId: kit.id,
          missingHeroLocation: zoneId,
          requiredHeroLocations: kit.requiredHeroLocations
        });
      }
      const minPerHeroLocation = kit.minPerHeroLocation?.[zoneId];
      if (!Number.isInteger(minPerHeroLocation) || minPerHeroLocation < 3) {
        fail("Hero-location map expansion kit must declare minPerHeroLocation for each hero location.", {
          kitId: kit.id,
          zoneId,
          minPerHeroLocation
        });
      }
    }
  }
}

for (const requiredRole of ["road", "water", "relief", "vegetation", "route-edge", "bridge", "hero-location"]) {
  if (!mapExpansionKitRoles.has(requiredRole)) {
    fail("Map expansion kits must cover every core visual terrain role.", {
      requiredRole,
      mapExpansionKitRoles: [...mapExpansionKitRoles].sort()
    });
  }
}

if (!corePromotion) {
  fail("Core runtime promotion contract is required before vendor anchors enter the public build.");
} else {
  const promotedAsset = acceptedRuntimeAssets.get(corePromotion.assetId);
  const requiredFiles = asArray(corePromotion.requiredFiles);
  const requiredPlacementIds = asArray(corePromotion.requiredPlacementIds);
  const requiredHeroRoles = corePromotion.requiredHeroRoles ?? {};

  if (corePromotion.phase !== "core-runtime-promotion") {
    fail("Core promotion must declare phase core-runtime-promotion.", { phase: corePromotion.phase });
  }
  if (!corePromotion.id || corePromotion.id.length < 8) {
    fail("Core promotion must declare a stable id.", { id: corePromotion.id });
  }
  if (!corePromotion.purpose || corePromotion.purpose.length < 96) {
    fail("Core promotion must explain the visual purpose and QA contract.", { purpose: corePromotion.purpose });
  }
  if (!corePromotion.fallback || corePromotion.fallback.length < 72) {
    fail("Core promotion must declare a demotion fallback.", { fallback: corePromotion.fallback });
  }
  if (!corePromotion.nextAction || corePromotion.nextAction.length < 72) {
    fail("Core promotion must declare the next asset-first action.", { nextAction: corePromotion.nextAction });
  }
  if (!promotedAsset) {
    fail("Core promotion assetId must point to an accepted or integrated asset.", { assetId: corePromotion.assetId });
  } else {
    if (!promotedAsset.kind.includes("model") || promotedAsset.target !== "map" || promotedAsset.terrainRole !== "hero-location") {
      fail("Core promotion asset must be a map hero-location model collection.", {
        assetId: promotedAsset.id,
        kind: promotedAsset.kind,
        target: promotedAsset.target,
        terrainRole: promotedAsset.terrainRole
      });
    }
    for (const file of requiredFiles) {
      if (!asArray(promotedAsset.selectedFiles).includes(file)) {
        fail("Core promotion requiredFiles must exist in the promoted asset selectedFiles.", {
          assetId: promotedAsset.id,
          file,
          selectedFiles: promotedAsset.selectedFiles
        });
      }
    }
  }
  if (requiredFiles.length !== heroLocations.size || new Set(requiredFiles).size !== requiredFiles.length) {
    fail("Core promotion must declare exactly one unique premium file per hero location.", {
      requiredFiles,
      heroLocations: [...heroLocations]
    });
  }
  if (requiredPlacementIds.length !== heroLocations.size || new Set(requiredPlacementIds).size !== requiredPlacementIds.length) {
    fail("Core promotion must declare exactly one unique placement per hero location.", {
      requiredPlacementIds,
      heroLocations: [...heroLocations]
    });
  }
  for (const zoneId of heroLocations) {
    const roles = asArray(requiredHeroRoles[zoneId]);
    if (roles.length !== 1) {
      fail("Core promotion must declare one required premium hero role per hero location.", {
        zoneId,
        roles
      });
    }
    const placementPrefix = `hero:${zoneId}:`;
    if (!requiredPlacementIds.some((placementId) => typeof placementId === "string" && placementId.startsWith(placementPrefix))) {
      fail("Core promotion requiredPlacementIds must include each hero location.", {
        zoneId,
        requiredPlacementIds
      });
    }
  }
  if (!Number.isInteger(corePromotion.minimumCorePlacements) || corePromotion.minimumCorePlacements < 18) {
    fail("Core promotion must require the public core to include the vendor anchors plus the existing foundation.", {
      minimumCorePlacements: corePromotion.minimumCorePlacements
    });
  }
  if (!Number.isInteger(corePromotion.minimumHeroLocationPlacements) || corePromotion.minimumHeroLocationPlacements < 12) {
    fail("Core promotion must require enough hero-location placements to make the three places legible.", {
      minimumHeroLocationPlacements: corePromotion.minimumHeroLocationPlacements
    });
  }
  if (!Number.isInteger(corePromotion.minimumUniqueFiles) || corePromotion.minimumUniqueFiles < 18) {
    fail("Core promotion must require a broad enough unique-file core layer.", {
      minimumUniqueFiles: corePromotion.minimumUniqueFiles
    });
  }
  if (!isPositiveNumber(corePromotion.minimumCoverage?.width) || !isPositiveNumber(corePromotion.minimumCoverage?.depth)) {
    fail("Core promotion must declare positive minimumCoverage width/depth.", {
      minimumCoverage: corePromotion.minimumCoverage
    });
  }
  if (
    !Number.isInteger(corePromotion.maximumHeroClusterDensity) ||
    corePromotion.maximumHeroClusterDensity < 3 ||
    corePromotion.maximumHeroClusterDensity > 4
  ) {
    fail("Core promotion must declare a tight maximumHeroClusterDensity.", {
      maximumHeroClusterDensity: corePromotion.maximumHeroClusterDensity
    });
  }
  if (corePromotion.qaGate !== "external-asset-core-vendor-anchor-runtime") {
    fail("Core promotion must bind to the vendor-anchor runtime QA gate.", { qaGate: corePromotion.qaGate });
  }
}

if (!terrainShell) {
  fail("Terrain shell contract is required before scaling the map beyond the first compact layout.");
} else {
  if (terrainShell.phase !== "map-shell-expansion") {
    fail("Terrain shell must declare phase map-shell-expansion.", { phase: terrainShell.phase });
  }
  if (!terrainShell.id || terrainShell.id.length < 8) {
    fail("Terrain shell must declare a stable id.", { id: terrainShell.id });
  }
  if (!terrainShell.purpose || terrainShell.purpose.length < 120) {
    fail("Terrain shell must explain the sparse expansion purpose.", { purpose: terrainShell.purpose });
  }
  if (!terrainShell.fallback || terrainShell.fallback.length < 72) {
    fail("Terrain shell must declare a rollback fallback.", { fallback: terrainShell.fallback });
  }
  if (!terrainShell.nextAction || terrainShell.nextAction.length < 96) {
    fail("Terrain shell must declare the next terrain-first action.", { nextAction: terrainShell.nextAction });
  }
  if (!Number.isInteger(terrainShell.worldSize) || terrainShell.worldSize < 96) {
    fail("Terrain shell must declare the larger worldSize target.", { worldSize: terrainShell.worldSize });
  }
  if (!Number.isInteger(terrainShell.minimumInnerRoamExtent) || terrainShell.minimumInnerRoamExtent < 40) {
    fail("Terrain shell must declare a larger inner roam extent.", {
      minimumInnerRoamExtent: terrainShell.minimumInnerRoamExtent
    });
  }
  if (!isPositiveNumber(terrainShell.minimumGroundRadius) || terrainShell.minimumGroundRadius < 50) {
    fail("Terrain shell must declare a larger ground radius.", {
      minimumGroundRadius: terrainShell.minimumGroundRadius
    });
  }
  for (const band of ["north", "south", "west", "east"]) {
    if (!asArray(terrainShell.requiredOuterBands).includes(band)) {
      fail("Terrain shell must cover every outer band.", {
        band,
        requiredOuterBands: terrainShell.requiredOuterBands
      });
    }
  }
  for (const key of ["minimumWaterRegions", "minimumRampRegions", "minimumTerrainFeatures", "minimumMapPlacements", "minimumContextPlacements"]) {
    if (!Number.isInteger(terrainShell[key]) || terrainShell[key] < 1) {
      fail("Terrain shell minimum must be a positive integer.", { key, value: terrainShell[key] });
    }
  }
  if (!isPositiveNumber(terrainShell.minimumMapCoverage?.width) || !isPositiveNumber(terrainShell.minimumMapCoverage?.depth)) {
    fail("Terrain shell must declare positive minimumMapCoverage width/depth.", {
      minimumMapCoverage: terrainShell.minimumMapCoverage
    });
  }
  for (const role of ["route", "water", "relief", "vegetation"]) {
    if (!Number.isInteger(terrainShell.minimumRolePlacements?.[role]) || terrainShell.minimumRolePlacements[role] < 1) {
      fail("Terrain shell must declare role placement minimums.", {
        role,
        minimumRolePlacements: terrainShell.minimumRolePlacements
      });
    }
  }
  if (!Number.isInteger(terrainShell.maximumNonHeroClusterDensity) || terrainShell.maximumNonHeroClusterDensity < 1 || terrainShell.maximumNonHeroClusterDensity > 3) {
    fail("Terrain shell must keep sparse non-hero cluster density.", {
      maximumNonHeroClusterDensity: terrainShell.maximumNonHeroClusterDensity
    });
  }
  if (!Number.isInteger(terrainShell.maximumRendererTriangles) || terrainShell.maximumRendererTriangles > budgets.rendererTriangleCap) {
    fail("Terrain shell renderer triangle ceiling must stay inside the global renderer cap.", {
      maximumRendererTriangles: terrainShell.maximumRendererTriangles,
      rendererTriangleCap: budgets.rendererTriangleCap
    });
  }
}

if (!assetUtilizationWave) {
  fail("Asset utilization wave contract is required before adding another inspection placement wave.");
} else {
  const requiredFiles = asArray(assetUtilizationWave.requiredFiles);
  const requiredPlacementIds = asArray(assetUtilizationWave.requiredPlacementIds);
  const acceptedSelectedFiles = new Map(
    [...acceptedRuntimeAssets.values()]
      .filter((asset) => asset.kind.includes("model"))
      .flatMap((asset) => asArray(asset.selectedFiles).map((file) => [file, asset.id]))
  );

  if (assetUtilizationWave.phase !== "asset-library-utilization") {
    fail("Asset utilization wave must declare phase asset-library-utilization.", { phase: assetUtilizationWave.phase });
  }
  if (!assetUtilizationWave.id || assetUtilizationWave.id.length < 8) {
    fail("Asset utilization wave must declare a stable id.", { id: assetUtilizationWave.id });
  }
  if (!assetUtilizationWave.purpose || assetUtilizationWave.purpose.length < 120) {
    fail("Asset utilization wave must explain why this placement wave reduces library waste.", {
      purpose: assetUtilizationWave.purpose
    });
  }
  if (!assetUtilizationWave.fallback || assetUtilizationWave.fallback.length < 96) {
    fail("Asset utilization wave must declare a rollback fallback.", { fallback: assetUtilizationWave.fallback });
  }
  if (!assetUtilizationWave.nextAction || assetUtilizationWave.nextAction.length < 96) {
    fail("Asset utilization wave must declare the next curation action.", { nextAction: assetUtilizationWave.nextAction });
  }
  if (requiredFiles.length < 10 || new Set(requiredFiles).size !== requiredFiles.length) {
    fail("Asset utilization wave must require a broad unique-file set.", { requiredFiles });
  }
  if (requiredPlacementIds.length !== requiredFiles.length || new Set(requiredPlacementIds).size !== requiredPlacementIds.length) {
    fail("Asset utilization wave must bind one unique placement per required file.", {
      requiredFiles,
      requiredPlacementIds
    });
  }
  for (const file of requiredFiles) {
    if (!acceptedSelectedFiles.has(file)) {
      fail("Asset utilization wave requiredFiles must be selected by an accepted model asset.", {
        file,
        acceptedModelAssets: [...new Set(acceptedSelectedFiles.values())].sort()
      });
    }
  }
  if (!Number.isInteger(assetUtilizationWave.minimumMapPlacements) || assetUtilizationWave.minimumMapPlacements < 140) {
    fail("Asset utilization wave must raise the map placement floor beyond the terrain shell baseline.", {
      minimumMapPlacements: assetUtilizationWave.minimumMapPlacements
    });
  }
  if (!Number.isInteger(assetUtilizationWave.minimumUniqueFiles) || assetUtilizationWave.minimumUniqueFiles < 68) {
    fail("Asset utilization wave must raise the unique-file floor beyond the previous map composition.", {
      minimumUniqueFiles: assetUtilizationWave.minimumUniqueFiles
    });
  }
  if (
    !Number.isInteger(assetUtilizationWave.maximumRendererTriangles) ||
    assetUtilizationWave.maximumRendererTriangles > budgets.rendererTriangleCap
  ) {
    fail("Asset utilization wave maximumRendererTriangles must stay inside the global renderer cap.", {
      maximumRendererTriangles: assetUtilizationWave.maximumRendererTriangles,
      rendererTriangleCap: budgets.rendererTriangleCap
    });
  }
  if (assetUtilizationWave.qaGate !== "asset-utilization-wave") {
    fail("Asset utilization wave must bind to the asset-utilization-wave QA gate.", { qaGate: assetUtilizationWave.qaGate });
  }
}

if (!assetDetailWave) {
  fail("Asset detail wave contract is required before adding another hero-location detail wave.");
} else {
  const requiredFiles = asArray(assetDetailWave.requiredFiles);
  const requiredPlacementIds = asArray(assetDetailWave.requiredPlacementIds);
  const requiredHeroRoles = assetDetailWave.requiredHeroRoles ?? {};
  const detailAsset = acceptedRuntimeAssets.get(assetDetailWave.assetId);

  if (assetDetailWave.phase !== "hero-location-detail") {
    fail("Asset detail wave must declare phase hero-location-detail.", { phase: assetDetailWave.phase });
  }
  if (!assetDetailWave.id || assetDetailWave.id.length < 8) {
    fail("Asset detail wave must declare a stable id.", { id: assetDetailWave.id });
  }
  if (!assetDetailWave.purpose || assetDetailWave.purpose.length < 120) {
    fail("Asset detail wave must explain why the new details improve recognition without clutter.", {
      purpose: assetDetailWave.purpose
    });
  }
  if (!detailAsset || !detailAsset.kind.includes("model")) {
    fail("Asset detail wave assetId must point to an accepted model asset.", {
      assetId: assetDetailWave.assetId,
      status: detailAsset?.status,
      kind: detailAsset?.kind
    });
  }
  if (!assetDetailWave.fallback || assetDetailWave.fallback.length < 96) {
    fail("Asset detail wave must declare a rollback fallback.", { fallback: assetDetailWave.fallback });
  }
  if (!assetDetailWave.nextAction || assetDetailWave.nextAction.length < 96) {
    fail("Asset detail wave must declare the next curation action.", { nextAction: assetDetailWave.nextAction });
  }
  if (requiredFiles.length !== heroLocations.size || new Set(requiredFiles).size !== requiredFiles.length) {
    fail("Asset detail wave must require one unique file per hero location.", {
      requiredFiles,
      heroLocations: [...heroLocations]
    });
  }
  if (requiredPlacementIds.length !== requiredFiles.length || new Set(requiredPlacementIds).size !== requiredPlacementIds.length) {
    fail("Asset detail wave must bind one unique placement per required file.", {
      requiredFiles,
      requiredPlacementIds
    });
  }
  const selectedFiles = new Set(asArray(detailAsset?.selectedFiles));
  for (const file of requiredFiles) {
    if (!selectedFiles.has(file)) {
      fail("Asset detail wave requiredFiles must be selected by the detail model asset.", {
        file,
        assetId: assetDetailWave.assetId,
        selectedFiles: [...selectedFiles].sort()
      });
    }
  }
  for (const zoneId of heroLocations) {
    const roles = asArray(requiredHeroRoles[zoneId]);
    if (roles.length !== 1) {
      fail("Asset detail wave must declare exactly one required hero role per hero location.", {
        zoneId,
        roles
      });
    }
    const curationRoles = new Set(asArray(heroLocationCuration[zoneId]?.requiredVisualRoles));
    for (const role of roles) {
      if (!curationRoles.has(role)) {
        fail("Asset detail wave hero roles must be included in heroLocationCuration.requiredVisualRoles.", {
          zoneId,
          role,
          curationRoles: [...curationRoles].sort()
        });
      }
    }
  }
  if (!Number.isInteger(assetDetailWave.minimumMapPlacements) || assetDetailWave.minimumMapPlacements < 128) {
    fail("Asset detail wave must raise the map placement floor after the utilization wave.", {
      minimumMapPlacements: assetDetailWave.minimumMapPlacements
    });
  }
  if (!Number.isInteger(assetDetailWave.minimumUniqueFiles) || assetDetailWave.minimumUniqueFiles < 68) {
    fail("Asset detail wave must keep enough unique downloaded files after removing generated local details.", {
      minimumUniqueFiles: assetDetailWave.minimumUniqueFiles
    });
  }
  if (!Number.isInteger(assetDetailWave.maximumRendererTriangles) || assetDetailWave.maximumRendererTriangles > budgets.rendererTriangleCap) {
    fail("Asset detail wave maximumRendererTriangles must stay inside the global renderer cap.", {
      maximumRendererTriangles: assetDetailWave.maximumRendererTriangles,
      rendererTriangleCap: budgets.rendererTriangleCap
    });
  }
  if (assetDetailWave.qaGate !== "asset-detail-wave") {
    fail("Asset detail wave must bind to the asset-detail-wave QA gate.", { qaGate: assetDetailWave.qaGate });
  }
}

if (!terrainTransitionWave) {
  fail("Terrain transition wave contract is required before the next sparse map expansion.");
} else {
  const requiredFiles = asArray(terrainTransitionWave.requiredFiles);
  const requiredPlacementIds = asArray(terrainTransitionWave.requiredPlacementIds);
  const terrainAsset = acceptedRuntimeAssets.get(terrainTransitionWave.assetId);

  if (terrainTransitionWave.phase !== "terrain-transition-library") {
    fail("Terrain transition wave must declare phase terrain-transition-library.", { phase: terrainTransitionWave.phase });
  }
  if (!terrainTransitionWave.id || terrainTransitionWave.id.length < 8) {
    fail("Terrain transition wave must declare a stable id.", { id: terrainTransitionWave.id });
  }
  if (!terrainTransitionWave.purpose || terrainTransitionWave.purpose.length < 120) {
    fail("Terrain transition wave must explain its asset-first map purpose.", {
      purpose: terrainTransitionWave.purpose
    });
  }
  if (!terrainAsset || !terrainAsset.kind.includes("model")) {
    fail("Terrain transition wave assetId must point to an accepted model asset.", {
      assetId: terrainTransitionWave.assetId,
      status: terrainAsset?.status,
      kind: terrainAsset?.kind
    });
  } else {
    if (terrainAsset.sourceId === "itart-signature-kit" || terrainAsset.terrainRole !== "bridge") {
      fail("Terrain transition wave must use a downloaded bridge/path model collection, not generated local GLB.", {
        assetId: terrainAsset.id,
        sourceId: terrainAsset.sourceId,
        terrainRole: terrainAsset.terrainRole
      });
    }
    const selectedFiles = new Set(asArray(terrainAsset.selectedFiles));
    for (const file of requiredFiles) {
      if (!selectedFiles.has(file)) {
        fail("Terrain transition wave requiredFiles must be selected by the terrain model asset.", {
          file,
          assetId: terrainTransitionWave.assetId,
          selectedFiles: [...selectedFiles].sort()
        });
      }
    }
  }
  if (requiredFiles.length < 6 || new Set(requiredFiles).size !== requiredFiles.length) {
    fail("Terrain transition wave must require at least six unique terrain files.", { requiredFiles });
  }
  if (requiredPlacementIds.length !== requiredFiles.length || new Set(requiredPlacementIds).size !== requiredPlacementIds.length) {
    fail("Terrain transition wave must bind one unique placement per required file.", {
      requiredFiles,
      requiredPlacementIds
    });
  }
  if (!terrainTransitionWave.fallback || terrainTransitionWave.fallback.length < 96) {
    fail("Terrain transition wave must declare a rollback fallback.", { fallback: terrainTransitionWave.fallback });
  }
  if (!terrainTransitionWave.nextAction || terrainTransitionWave.nextAction.length < 96) {
    fail("Terrain transition wave must declare the next terrain curation action.", { nextAction: terrainTransitionWave.nextAction });
  }
  if (!Number.isInteger(terrainTransitionWave.minimumMapPlacements) || terrainTransitionWave.minimumMapPlacements < 128) {
    fail("Terrain transition wave must preserve a broad vendor-only map placement proof.", {
      minimumMapPlacements: terrainTransitionWave.minimumMapPlacements
    });
  }
  if (!Number.isInteger(terrainTransitionWave.minimumUniqueFiles) || terrainTransitionWave.minimumUniqueFiles < 68) {
    fail("Terrain transition wave must preserve enough unique downloaded files after removing generated local terrain.", {
      minimumUniqueFiles: terrainTransitionWave.minimumUniqueFiles
    });
  }
  if (!Number.isInteger(terrainTransitionWave.maximumRendererTriangles) || terrainTransitionWave.maximumRendererTriangles > budgets.rendererTriangleCap) {
    fail("Terrain transition wave maximumRendererTriangles must stay inside the global renderer cap.", {
      maximumRendererTriangles: terrainTransitionWave.maximumRendererTriangles,
      rendererTriangleCap: budgets.rendererTriangleCap
    });
  }
  if (terrainTransitionWave.qaGate !== "terrain-transition-wave") {
    fail("Terrain transition wave must bind to the terrain-transition-wave QA gate.", { qaGate: terrainTransitionWave.qaGate });
  }
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
  acceptedMapTextureRoles: [...acceptedMapTextureRoles].sort(),
  heroLocationCuration: Object.fromEntries(
    [...heroLocations].map((zoneId) => [
      zoneId,
      {
        minRuntimePlacements: heroLocationCuration[zoneId]?.minRuntimePlacements ?? 0,
        requiredVisualRoles: asArray(heroLocationCuration[zoneId]?.requiredVisualRoles).length,
        requiredAssetIds: asArray(heroLocationCuration[zoneId]?.requiredAssetIds).length
      }
    ])
  ),
  heroLocations: [...heroLocations],
  terrainRoles: [...terrainRoles],
  terrainAssetSourcingBacklog: {
    count: terrainAssetSourcingBacklog.length,
    roles: [...new Set(terrainAssetSourcingBacklog.flatMap((item) => asArray(item.terrainRoles)))].sort(),
    priorities: Object.fromEntries(
      terrainAssetSourcingBacklog.map((item) => [
        item.id,
        {
          priority: item.priority,
          status: item.status,
          sourceId: item.sourceId,
          qaGate: item.qaGate
        }
      ])
    )
  },
  mapExpansionKits: {
    count: mapExpansionKits.length,
    roles: [...mapExpansionKitRoles].sort(),
    minimumRuntimePlacements: mapExpansionRuntimePlacementBudget,
    minimumUniqueFiles: mapExpansionUniqueFileBudget
  },
  corePromotion: corePromotion
    ? {
        id: corePromotion.id,
        assetId: corePromotion.assetId,
        requiredFiles: asArray(corePromotion.requiredFiles).length,
        requiredPlacementIds: asArray(corePromotion.requiredPlacementIds).length,
        qaGate: corePromotion.qaGate
      }
    : null,
  terrainShell: terrainShell
    ? {
        id: terrainShell.id,
        worldSize: terrainShell.worldSize,
        minimumMapCoverage: terrainShell.minimumMapCoverage,
        minimumMapPlacements: terrainShell.minimumMapPlacements,
        minimumRolePlacements: terrainShell.minimumRolePlacements
      }
    : null,
  assetUtilizationWave: assetUtilizationWave
    ? {
        id: assetUtilizationWave.id,
        requiredFiles: asArray(assetUtilizationWave.requiredFiles).length,
        requiredPlacementIds: asArray(assetUtilizationWave.requiredPlacementIds).length,
        minimumMapPlacements: assetUtilizationWave.minimumMapPlacements,
        minimumUniqueFiles: assetUtilizationWave.minimumUniqueFiles,
        qaGate: assetUtilizationWave.qaGate
      }
    : null,
  assetDetailWave: assetDetailWave
    ? {
        id: assetDetailWave.id,
        assetId: assetDetailWave.assetId,
        requiredFiles: asArray(assetDetailWave.requiredFiles).length,
        requiredPlacementIds: asArray(assetDetailWave.requiredPlacementIds).length,
        minimumMapPlacements: assetDetailWave.minimumMapPlacements,
        minimumUniqueFiles: assetDetailWave.minimumUniqueFiles,
        qaGate: assetDetailWave.qaGate
      }
    : null,
  terrainTransitionWave: terrainTransitionWave
    ? {
        id: terrainTransitionWave.id,
        assetId: terrainTransitionWave.assetId,
        requiredFiles: asArray(terrainTransitionWave.requiredFiles).length,
        requiredPlacementIds: asArray(terrainTransitionWave.requiredPlacementIds).length,
        minimumMapPlacements: terrainTransitionWave.minimumMapPlacements,
        minimumUniqueFiles: terrainTransitionWave.minimumUniqueFiles,
        qaGate: terrainTransitionWave.qaGate
      }
    : null,
  warnings,
  failures
};

if (failures.length > 0) {
  console.error(JSON.stringify(summary, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(summary, null, 2));
}
