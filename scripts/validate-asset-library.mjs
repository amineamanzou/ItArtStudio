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
const isTextureFile = (file) => /\.(avif|jpe?g|png|svg|webp)$/iu.test(file);

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

const validateGlbImageReferences = (filePath) => {
  const gltf = readGlbJsonChunk(filePath);
  if (!gltf) {
    return;
  }

  for (const image of asArray(gltf.images)) {
    const uri = image?.uri;
    if (typeof uri !== "string" || uri.startsWith("data:")) {
      continue;
    }

    if (uri.startsWith("/") || uri.startsWith("public/") || uri.split(/[\\/]/u).includes("..")) {
      fail("GLB image URI must stay relative to the model folder.", { filePath, uri });
      continue;
    }

    const imagePath = path.join(path.dirname(filePath), uri);
    if (!fs.existsSync(imagePath)) {
      fail("GLB image URI does not resolve to a local texture.", {
        filePath,
        uri,
        expectedPath: path.relative(root, imagePath)
      });
    }
  }
};

const analyzeLocalAsset = (assetId, localPath) => {
  const absolutePath = path.join(root, localPath);
  const files = listFiles(absolutePath);
  const glbFiles = files.filter((file) => file.endsWith(".glb"));
  const textureFiles = files.filter(isTextureFile);
  const fileKb = roundTenth(files.reduce((total, file) => total + fs.statSync(file).size / 1024, 0));
  const triangles = glbFiles.reduce((total, file) => total + countGlbTriangles(file), 0);
  glbFiles.forEach(validateGlbImageReferences);

  return {
    assetId,
    fileKb,
    triangles,
    modelFiles: glbFiles.length,
    textureFiles: textureFiles.length,
    modelFileNames: glbFiles.map((file) => path.basename(file)),
    textureFileNames: textureFiles.map((file) => path.basename(file)),
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
const heroLocationCuration = manifest.heroLocationCuration ?? {};
const terrainRoles = new Set(asArray(manifest.terrainRoles));
const mapExpansionKits = asArray(manifest.mapExpansionKits);
const corePromotion = manifest.corePromotion ?? null;
const terrainShell = manifest.terrainShell ?? null;
const assetUtilizationWave = manifest.assetUtilizationWave ?? null;
const assetDetailWave = manifest.assetDetailWave ?? null;
const productionLicenseAssets = [];
const declaredRuntimeGlbs = new Set();
const declaredRuntimeTextures = new Set();

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
        const localGlbFiles = listFiles(path.join(root, asset.localPath)).filter((file) => file.endsWith(".glb"));
        const localGlbNames = new Set(localGlbFiles.map((file) => path.basename(file)));
        for (const selectedFile of asArray(asset.selectedFiles)) {
          if (typeof selectedFile !== "string" || !localGlbNames.has(selectedFile)) {
            fail("Accepted model selectedFiles must name an existing local GLB.", {
              assetId: asset.id,
              selectedFile
            });
          }
        }
        for (const glbFile of localGlbFiles) {
          if (Array.isArray(asset.selectedFiles) && !asset.selectedFiles.includes(path.basename(glbFile))) {
            fail("Accepted local GLB must be listed in selectedFiles.", {
              assetId: asset.id,
              glbFile: path.relative(root, glbFile)
            });
          }
          declaredRuntimeGlbs.add(path.relative(root, glbFile));
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
  const orphanGlbs = listFiles(vendorModelsPath)
    .filter((file) => file.endsWith(".glb"))
    .map((file) => path.relative(root, file))
    .filter((file) => !declaredRuntimeGlbs.has(file));

  if (orphanGlbs.length > 0) {
    fail("Runtime vendor GLB files must be declared by accepted or integrated manifest entries.", { orphanGlbs });
  }
}

const localModelsPath = path.join(root, "public", "assets", "models", "local");
if (fs.existsSync(localModelsPath)) {
  const orphanGlbs = listFiles(localModelsPath)
    .filter((file) => file.endsWith(".glb"))
    .map((file) => path.relative(root, file))
    .filter((file) => !declaredRuntimeGlbs.has(file));

  if (orphanGlbs.length > 0) {
    fail("Runtime local GLB files must be declared by accepted or integrated manifest entries.", { orphanGlbs });
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
const acceptedRuntimeTextures = new Map(
  [...acceptedRuntimeAssets.values()].filter((asset) => asset.kind === "texture-set" && asset.target === "map").map((asset) => [asset.id, asset])
);
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
  fail("Core runtime promotion contract is required before premium anchors enter the public build.");
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
    fail("Core promotion must require the public core to include the premium anchors plus the existing foundation.", {
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
  if (corePromotion.qaGate !== "external-asset-core-premium-runtime") {
    fail("Core promotion must bind to the premium runtime QA gate.", { qaGate: corePromotion.qaGate });
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
  if (!Number.isInteger(assetUtilizationWave.minimumUniqueFiles) || assetUtilizationWave.minimumUniqueFiles < 70) {
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
  if (!Number.isInteger(assetDetailWave.minimumMapPlacements) || assetDetailWave.minimumMapPlacements < 146) {
    fail("Asset detail wave must raise the map placement floor after the utilization wave.", {
      minimumMapPlacements: assetDetailWave.minimumMapPlacements
    });
  }
  if (!Number.isInteger(assetDetailWave.minimumUniqueFiles) || assetDetailWave.minimumUniqueFiles < 80) {
    fail("Asset detail wave must raise the unique-file floor after adding three custom detail files.", {
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
  warnings,
  failures
};

if (failures.length > 0) {
  console.error(JSON.stringify(summary, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(summary, null, 2));
}
