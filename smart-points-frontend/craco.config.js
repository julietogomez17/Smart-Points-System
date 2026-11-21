module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      const excludeBrokenSourceMaps = (rule) => {
        if (!rule || typeof rule !== "object") return;

        if (
          typeof rule.loader === "string" &&
          rule.loader.includes("source-map-loader")
        ) {
          const existingExclude = rule.exclude;

          rule.exclude = (filePath) => {
            const normalizedPath = filePath.replace(/\\/g, "/");

            if (
              normalizedPath.includes(
                "/node_modules/html5-qrcode/"
              )
            ) {
              return true;
            }

            if (typeof existingExclude === "function") {
              return existingExclude(filePath);
            }

            if (existingExclude instanceof RegExp) {
              return existingExclude.test(filePath);
            }

            if (Array.isArray(existingExclude)) {
              return existingExclude.some((pattern) =>
                pattern instanceof RegExp
                  ? pattern.test(filePath)
                  : typeof pattern === "string"
                    ? filePath.includes(pattern)
                    : false
              );
            }

            return false;
          };
        }

        if (Array.isArray(rule.oneOf)) {
          rule.oneOf.forEach(excludeBrokenSourceMaps);
        }

        if (Array.isArray(rule.rules)) {
          rule.rules.forEach(excludeBrokenSourceMaps);
        }
      };

      webpackConfig.module.rules.forEach(
        excludeBrokenSourceMaps
      );

      return webpackConfig;
    },
  },
};