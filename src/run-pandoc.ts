import { promises as fs } from 'fs';
import { exec as raw_exec } from 'child_process';
import yaml from 'js-yaml';

let exec = undefined;
async function get_exec() {
	if (exec) {return exec}
	const promisify = await (await import('util')).promisify
	exec = promisify(raw_exec);
	return exec
}

export async function json2html(object) {
	return convert(JSON.stringify(object), "json", "html")
}

export async function convert(document: string, formatFrom : string, formatTo: string) {
	/* 
	Transform pandoc-json formatted json to HTML by piping it through the 
	*/

	return new Promise<string>((resolve, reject) => {
		const child = raw_exec(`pandoc -f ${formatFrom} -t ${formatTo}`);
		child.stdin?.write((document) + '\n');
		child.stdin?.end();
		let response = '';

		// listen on child process stdout
		child.stdout?.on('data', (chunk) => {
			response += chunk;
		});
		child.stderr?.on('data', (chunk) => {
			console.error(chunk);
		});

		child.on('close', (code) => {
			if (code != 0) {
				console.error(code)
				reject();
			} else {
				resolve(response);
			}
		});
	});
}

/**
 *
 * @param array A list of pandoc elements.
 * @returns The list with strings collapsed to not be separated by spaces.
 *          This greatly reduces the number of elements necessary to parse.
 *          Pandoc maintainer JGM himself [would like](https://github.com/jgm/pandoc/issues/7579)
 *          to implement this there, but it's dangerous for compatibility/filters.
 */
function fold_spaces(array) {
	if (array.indexOf(null) > -1) {
		return array;
	}
	const r = array.reduceRight((accumulator, one_before) => {
		const [first, ...rest] = accumulator;
		if (one_before.t === 'Space' || one_before.t === 'SoftBreak') {
			one_before = { t: 'Str', c: ' ' };
		}
		if (first && first.t === 'Str' && one_before.t === 'Str') {
			return [{ t: 'Str', c: one_before.c + first.c }, ...rest];
		} else {
			const collapsed = collapse_spaces(one_before);
			return [collapsed, first, ...rest];
		}
	}, [])
	return r.filter((d) => d !== undefined);
}

function collapse_spaces(ast) {
	if (Array.isArray(ast)) {
		return fold_spaces(ast);
	}
	if (typeof ast !== 'object') {
		return ast;
	}

	const output = {};
	// eslint-disable-next-line prefer-const
	for (let [k, v] of Object.entries(ast)) {
		if (Array.isArray(v)) {
			v = fold_spaces(v);
		} else if (typeof v !== 'object') {
			//pass
		} else {
			v = collapse_spaces(v);
		}
		output[k] = v;
	}
	return output;
}

const formats = {
	'md': 'markdown',
	'ipynb': 'ipynb',
	'docx': 'docx'
} as const;

export type format = keyof typeof formats;

async function parse_path(path) {
	const extension = path.split('.').slice(-1)[0] as format
	if (extension === 'docx') {
		console.log(extension)
		// Not a single file, so can't pipe through stdin.
		const exec = await get_exec()
		if (path.match('/\$\!\"/')) {
			throw new Error("Can't handle paths with quotes in them.")
		}
		const command = `pandoc -t json "${path}" -f docx`;
		const { stdout } = await exec(command);
		return collapse_spaces(JSON.parse(stdout));
	
	}
	const text = await fs.readFile(path, 'utf-8');
	const converted = await convert(text, formats[extension], "json")
	return collapse_spaces(JSON.parse(converted));
}

interface MetaAttributes {
	created: string,
	edited: string,
	filename: string,
	title: string,
	date: string,
	author?: string,
} 

type Metadata = MetaAttributes & Record<string, any>;

async function yaml_metadata(path : string): Promise<Record<string, any>> {
	let attributes : Metadata;
	const statinfo = await fs.stat(path);
	attributes = {
		created: new Date(statinfo.ctimeMs).toISOString(),
		edited: new Date(statinfo.ctimeMs).toISOString(),
		filename: path.split("/").slice(-1)[0].replace(/.[^.]+$/, ''),
		title: '__placeholder',
		date: '__placeholder'
	}
	if (path.endsWith(".md")) {
		const raw = await fs.readFile(path, 'utf-8');
		const has_metadata = raw.slice(0, 4) === '---\n';
		if (!has_metadata) {
			return {};
		}
		const candidate1 = raw.slice(4).split('---')[0];
		// Rarely, three dots are used as an end delimiter.
		const candidate2 = raw.slice(4).split('...')[0];
		let candidate: string;
		if (candidate2.length < candidate1.length) {
			candidate = candidate2;
		} else {
			candidate = candidate1;
		}
		if (candidate === undefined || candidate.length >= raw.length - 5) {
			return {};
		}
		const meta = yaml.load(candidate)
		attributes = {...attributes, ...meta };
	}
	if (attributes.title === '__placeholder') {
		attributes.title = attributes.filename
	}
	if (attributes.date === '__placeholder') {
		attributes.date = attributes.created
	}
	return attributes;
}

export async function json_with_meta(path: string, cache_loc = undefined) {
	// Create a cache if none exists.
	let cache_path;
	if (cache_loc) {
		await fs.mkdir(cache_loc).catch((err) => {
			if (err.code !== 'EEXIST') {
				throw err;
			}
		});
		cache_path = `${cache_loc}/${path.replace('/', '--')}.json`;
		let mtime = new Date(0);
		await fs
			.stat(cache_path)
			.then((d) => (mtime = d.mtime))
			.catch(() => ({}));

		const doctime = await fs.stat(path).then((d) => d.mtime);
		if (mtime > doctime) {
			const f = await fs.readFile(cache_path, 'utf-8');
			return JSON.parse(f);
		}
	}
	const pandocced = parse_path(path);
	const metadata = yaml_metadata(path);

	const value = await Promise.all([pandocced, metadata])
	.then(([document, metadata]) => ({
		metadata,
		document
	}));

	if (cache_loc) {
		await fs.writeFile(cache_path, JSON.stringify(value, undefined, 2));
	}
	return value;
}
