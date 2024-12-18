import crypto from "crypto";
import * as fs from "fs";
import zlib from "zlib";

const args = process.argv.slice(2);
const command = args[0];

enum Commands {
  Init = "init",
  CatFile = "cat-file",
  HashObject = "hash-object",
}

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
  case Commands.CatFile:
    const objectHash = args[2];
    const objectPath = `.git/objects/${objectHash.slice(
      0,
      2
    )}/${objectHash.slice(2)}`;
    const buffer = fs.readFileSync(objectPath);
    const decompressed = zlib.inflateSync(buffer as any);

    process.stdout.write(decompressed.toString().split("\0")[1]);
    break;
  case Commands.HashObject:
    const file = args[2];
    const fileContent = fs.readFileSync(file);
    const metaData = Buffer.from(`blob ${fileContent.length}\0`);

    const content = Buffer.concat([metaData, fileContent]);

    const hash = crypto.createHash("sha1").update(content).digest("hex");

    process.stdout.write(hash);
    const compressed = zlib.deflateSync(content);
    if (!fs.existsSync(`.git/objects/${hash.slice(0, 2)}`)) {
      fs.mkdirSync(`.git/objects/${hash.slice(0, 2)}`);
    }

    fs.writeFileSync(
      `.git/objects/${hash.slice(0, 2)}/${hash.slice(2)}`,
      compressed
    );
    break;
  default:
    throw new Error(`Unknown command ${command}`);
}
