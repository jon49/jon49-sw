import { glob as Glob, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import crypto from 'crypto'
import { createReadStream, existsSync } from "node:fs"

function getHashOfFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1')
        const rs = createReadStream(path)
        rs.on('error', reject)
        rs.on('data', chunk => hash.update(chunk))
        rs.on('end', () => resolve(hash.digest('hex').slice(0, 8)))
    })
}

export async function addHash(filename: string) {
    let hash = await getHashOfFile(`./src/${filename}`)
    let ext = path.extname(filename)

    return insertString(filename, `.${hash}`, -ext.length)
}

function insertString(original: string, insert: string, index: number) {
    let result = original.slice(0, index) + insert + original.slice(index)
    return result
}

export async function glob(globString: string, targetDirectory: string) {
    let files: string[] = []
    for await (const file of Glob(globString, { cwd: targetDirectory })) {
        files.push(file)
    }
    return files
}

export async function findHashedFile(
    filename: string,
    ext: string,
    targetDirectory: string) {

    let parsed = path.parse(filename)
    for await (const file of Glob(`**/${parsed.dir}/${parsed.name}.*${ext}`, { cwd: targetDirectory })) {
        return file
    }
}

export function getHash(content: string) {
    return crypto.createHash('sha1').update(content).digest('hex').slice(0, 8)
}

export async function write(filename: string, text: string) {
    let directory = path.dirname(filename)
    if (!existsSync(directory)) {
        await mkdir(directory, { recursive: true })
    }
    await writeFile(filename, text, 'utf-8')
}

export function makeUrlPath(filename: string | undefined) {
    if (filename == undefined) {
        return
    }
    if (filename.startsWith("/")) {
        return filename
    }
    if (filename.startsWith("./")) {
        return filename.slice(1)
    }
    return `/${filename}`
}

