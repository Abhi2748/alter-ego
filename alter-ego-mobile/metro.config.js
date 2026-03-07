const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/** @type {import("expo/metro-config").MetroConfig} */
const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true,
});

// victory-native's "react-native" field points to src/ which is incomplete in the published package.
// Force resolution to dist/ so all hooks (e.g. useLinePath) resolve correctly.
const victoryNativeDist = path.resolve(
  __dirname,
  "node_modules/victory-native/dist/index.js"
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "victory-native") {
    return { type: "sourceFile", filePath: victoryNativeDist };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
});
