import ifdef from './plugins/ifdef.js';

export default {
    input: 'src/public/sw.js',
    output: { 
        file: 'dist/server/public/sw.js',
        format: 'iife'
    },
    plugins: [
        ifdef({ifdef: 'WEB'})
    ]
};