import jscc from 'rollup-plugin-jscc';

export default {
    input: 'src/public/sw.js',
    output: { 
        file: 'dist/server/public/sw.js',
        format: 'iife'
    },
    plugins: [
        jscc()
    ]
};