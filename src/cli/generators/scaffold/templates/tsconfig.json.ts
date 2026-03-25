export function tsconfig() {
  return {
    compilerOptions: {
      target: "ESNext",
      module: "CommonJS",
      moduleResolution: "node",
      strict: true,
      types: ["node"],
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
    exclude: ["src/**/*.test.ts"],
  } as const;
}
