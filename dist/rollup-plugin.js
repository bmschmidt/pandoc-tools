import { json_with_meta, json2html } from './run-pandoc.js';
const fileRegex = /\.(md|ipynb|docx)$/;
/*
    Reads Markdown files by wrapping them as a big variable you can import.
*/
export default function pandoc_plugin(options) {
    let { cache_loc, format } = options;
    if (cache_loc === undefined) {
        cache_loc = null;
    }
    if (format === undefined) {
        format = 'json';
    }
    return {
        name: 'pandoc',
        async transform(src, id) {
            if (fileRegex.test(id)) {
                const data = await json_with_meta(id);
                if (format === 'html') {
                    data.html = await json2html(data.document);
                }
                return {
                    code: `export default ${JSON.stringify(data)};`,
                    map: { mappings: '' }
                };
            }
        }
    };
}
