import jscc from 'rollup-plugin-jscc';
import uglify from 'rollup-plugin-uglify';
import { minify } from 'uglify-es';

export default {
    input: 'src/public/sw.js',
    output: { 
        file: 'dist/server/public/sw.js',
        format: 'iife'
    },
    plugins: [
        jscc({
            values: {
                '_SERVICEWORKER': '1'
            }
        }),
        uglify({}, minify)
    ]
};