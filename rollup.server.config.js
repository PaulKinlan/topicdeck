import ifdef from './plugins/ifdef.js';

export default {
    input: 'src/server.js',
    output: { 
        file: 'dist/server/server.js',
        format: 'cjs'
    },
    plugins: [
        ifdef({ifdef: 'NODE'})
    ]
};