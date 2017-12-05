import jscc from 'rollup-plugin-jscc';

export default {
    input: 'src/public/scripts/client.js',
    output: { 
        file: 'dist/server/public/scripts/client.js',
        format: 'iife'
    },
    plugins: [
        jscc()
    ]
};