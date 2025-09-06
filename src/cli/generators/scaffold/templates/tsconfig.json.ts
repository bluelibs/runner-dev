export function tsconfig() {
  return {
    compilerOptions: {
      target: "ESNext",
      module: "Node16",
      moduleResolution: "node16",
      strict: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      outDir: "dist",
      rootDir: "src",
      skipLibCheck: true,
      resolveJsonModule: true,
      lib: ["ESNext"],
    },
    include: ["src"],
  } as const;
}
