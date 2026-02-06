import { promises as fs } from "node:fs";
import * as path from "node:path";

async function copyDocs() {
  console.log("sync-docs: starting");
  const filesToCopy = [
    {
      src: path.join("..", "runner", "readmes", "AI.md"),
      dest: path.join("readmes", "runner-AI.md"),
    },
    {
      src: path.join("..", "runner", "readmes", "TUNNELS.md"),
      dest: path.join("readmes", "runner-tunnels.md"),
    },   
     {
      src: path.join("..", "runner", "readmes", "DURABLE_WORKFLOWS.md"),
      dest: path.join("readmes", "runner-durable-workflows.md"),
    },
    {
      src: path.join("..", "runner", "readmes", "FULL_GUIDE.md"),
      dest: path.join("readmes", "runner-full-guide.md"),
    },
  ];

  await fs.mkdir("readmes", { recursive: true });

  for (const file of filesToCopy) {
    console.log("sync-docs: attempting copy", file.src, "->", file.dest);
    try {
      await fs.copyFile(file.src, file.dest);
      console.log(`Copied ${file.src} to ${file.dest}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(`Failed to copy ${file.src}:`, err.message);
      } else {
        console.error(`Failed to copy ${file.src}:`, String(err));
      }
    }
  }
}

copyDocs();
