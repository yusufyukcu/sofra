// Metro yapılandırması — paylaşılan çekirdek paketi için monorepo ayarı.
//
// `packages/core` mobil projenin kökünün dışında durduğu için Metro'ya iki
// şey söylenmeli: dosyaları izle (watchFolders) ve `@sofra/core` adını o
// klasöre çöz (extraNodeModules). Böylece web ile mobil gerçekten aynı
// dosyayı okur; çekirdekte yapılan değişiklik mobilde anında yansır.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const coreRoot = path.resolve(workspaceRoot, "packages/core");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [coreRoot];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@sofra/core": coreRoot,
};

// Not: `nodeModulesPaths` ve `disableHierarchicalLookup` özellikle
// değiştirilmiyor. Çekirdeğin kendi bağımlılığı olmadığı için Expo'nun
// varsayılan çözümlemesi yeterli; `expo-doctor` da bu iki alanın
// ellenmemesini öneriyor.

module.exports = config;
