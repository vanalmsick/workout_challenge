module.exports = {
    // react-scripts hardcodes `config: false` plus its own plugin list, and only
    // injects tailwind when a v3-style tailwind.config.js exists. Tailwind v4 has
    // neither, so hand PostCSS back to postcss.config.js.
    style: {
        postcss: {mode: 'file'}
    },
    // @reduxjs/toolkit pulls in ESM-only @standard-schema/utils, which CRA's jest
    // config refuses to transform.
    jest: {
        configure: (jestConfig) => {
            jestConfig.transformIgnorePatterns = jestConfig.transformIgnorePatterns.map((pattern) =>
                pattern.includes('node_modules') ? '[/\\\\]node_modules[/\\\\](?!@standard-schema).+\\.(js|mjs|jsx|ts|tsx)$' : pattern
            );
            return jestConfig;
        }
    },
    webpack: {
        configure: (webpackConfig) => {
            webpackConfig.devtool = 'source-map'; // always enable source maps
            return webpackConfig;
        }
    },
    // react-scripts 5.0.1 emits webpack-dev-server 4 options, but we override the
    // dev server to 5.x for the CVE fixes. Translate the two removed options.
    devServer: (config) => {
        const {onBeforeSetupMiddleware, onAfterSetupMiddleware, https, ...rest} = config;
        return {
            ...rest,
            server: https ? {type: 'https', options: https} : 'http',
            setupMiddlewares: (middlewares, devServer) => {
                onBeforeSetupMiddleware?.(devServer);
                onAfterSetupMiddleware?.(devServer);
                return middlewares;
            }
        };
    }
};