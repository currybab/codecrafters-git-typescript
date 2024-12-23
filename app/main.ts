import crypto, { hash } from "crypto";
import * as fs from "fs";
import zlib from "zlib";

const args = process.argv.slice(2);
const command = args[0];

enum Commands {
  Init = "init",
  CatFile = "cat-file",
  HashObject = "hash-object",
  LsTree = "ls-tree",
  WriteTree = "write-tree",
  CommitTree = "commit-tree",
}

const hexToBytes = (hex: string): string => {
  const bytes = new Uint8Array(20);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return String.fromCharCode(...bytes);
};

const readFileSync = (objectHash: string): string => {
  const objectPath = `.git/objects/${objectHash.slice(0, 2)}/${objectHash.slice(
    2
  )}`;
  const buffer = fs.readFileSync(objectPath);
  const decompressed = zlib.inflateSync(buffer as any);
  return decompressed.toString();
};

const hashBuffer = (
  buffer: Buffer,
  type: "blob" | "tree" | "commit" = "blob"
): { hash: string; content: any } => {
  const metaData: any = Buffer.from(`${type} ${buffer.length}\0`);

  const content: any = Buffer.concat([metaData, buffer]);
  const hash = crypto.createHash("sha1").update(content).digest("hex");
  return { hash, content };
};

const writeFileSync = (hash: string, content: any): void => {
  const compressed: any = zlib.deflateSync(content);
  if (!fs.existsSync(`.git/objects/${hash.slice(0, 2)}`)) {
    fs.mkdirSync(`.git/objects/${hash.slice(0, 2)}`);
  }

  fs.writeFileSync(
    `.git/objects/${hash.slice(0, 2)}/${hash.slice(2)}`,
    compressed
  );
};

const recursiveReadDir = (dir: string): string => {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  const result: { mode: number; name: string; hash: string }[] = [];
  for (const file of files) {
    if (file.name === ".git") {
      continue;
    }
    if (file.isDirectory()) {
      const treeHash = recursiveReadDir(`${dir}/${file.name}`);
      result.push({
        mode: 40000,
        name: file.name,
        hash: treeHash,
      });
    } else {
      // 100644 (regular file)
      // 100755 (executable file)
      // 120000 (symbolic link)
      if (file.isSymbolicLink()) {
        continue;
      }

      let executable: boolean;
      try {
        fs.accessSync(`${dir}/${file}`, fs.constants.X_OK);
        executable = true;
      } catch {
        executable = false;
      }
      result.push({
        mode: executable ? 100755 : 100644,
        name: file.name,
        hash: hashBuffer(fs.readFileSync(`${dir}/${file.name}`)).hash,
      });
    }
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  const content = Buffer.concat(
    result.map(({ mode, name, hash }) =>
      Buffer.concat([
        Buffer.from(`${mode} ${name}\0`) as any,
        Buffer.from(hash, "hex") as any,
      ])
    ) as any[]
  );

  const { hash: treeHash, content: treeContent } = hashBuffer(content, "tree");
  writeFileSync(treeHash, treeContent);
  return treeHash;
};

switch (command) {
  case Commands.Init:
    // You can use print statements as follows for debugging, they'll be visible when running tests.
    console.error("Logs from your program will appear here!");

    // Uncomment this block to pass the first stage
    fs.mkdirSync(".git", { recursive: true });
    fs.mkdirSync(".git/objects", { recursive: true });
    fs.mkdirSync(".git/refs", { recursive: true });
    fs.writeFileSync(".git/HEAD", "ref: refs/heads/main\n");
    console.log("Initialized git directory");
    break;
  case Commands.CatFile: {
    const objectHash = args[2];
    const fileContent = readFileSync(objectHash);

    process.stdout.write(fileContent.split("\0")[1]);
    break;
  }
  case Commands.HashObject: {
    const file = args[2];
    const fileContent = fs.readFileSync(file);
    const { hash, content } = hashBuffer(fileContent);
    process.stdout.write(hash);
    writeFileSync(hash, content);
    break;
  }
  case Commands.LsTree: {
    const treeHash = args[2];
    const treeContent = readFileSync(treeHash);
    const fileNames = treeContent
      .split("\0")
      .slice(1, -1)
      .map((str) => str.split(" ")[1]);
    for (const fileName of fileNames) {
      process.stdout.write(`${fileName}\n`);
    }
    break;
  }
  case Commands.WriteTree: {
    const hash = recursiveReadDir(".");
    process.stdout.write(hash);
    break;
  }
  case Commands.CommitTree: {
    const treeHash = args[1];
    const parentHash = args[3];
    const message = args[5];

    const currentTime = Math.floor(Date.now() / 1000);
    const commitContent = Buffer.concat([
      Buffer.from(`tree ${treeHash}\n`),
      parentHash ? Buffer.from(`parent ${parentHash}\n`) : Buffer.alloc(0),
      Buffer.from(
        `author Jun Park <pj2417@gmail.com> ${currentTime} +0900\n`
      ) as any,
      Buffer.from(
        `committer Jun Park <pj2417@gmail.com> ${currentTime} +0900\n\n`
      ) as any,
      Buffer.from(`${message}\n`) as any,
    ]) as any;
    const { hash, content } = hashBuffer(commitContent, "commit");
    writeFileSync(hash, content);
    process.stdout.write(hash);
    break;
  }
  default:
    throw new Error(`Unknown command ${command}`);
}
