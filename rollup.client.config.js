import jscc from 'rollup-plugin-jscc';
import uglify from 'rollup-plugin-uglify';
import { minify } from 'uglify-es';

export default {
    input: 'src/public/scripts/client.js',
    output: { 
        file: 'dist/server/public/scripts/client.js',
        format: 'iife'
    },
    plugins: [
        jscc(),
        uglify({}, minify)
    ]
};