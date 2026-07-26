module.exports = {
    webpack: {
        configure: (webpackConfig) => {
            webpackConfig.devtool = 'source-map'; // always enable source maps
            return webpackConfig;
        }
    }
};