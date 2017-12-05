import jscc from 'rollup-plugin-jscc';

export default {
    input: 'src/server.js',
    output: { 
        file: 'dist/server/server.js',
        format: 'cjs'
    },
    plugins: [
        jscc()
    ]
};