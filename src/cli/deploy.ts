import { c, alignRows, divider } from "./format";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { DeploymentManager, loadDeploymentConfig } from "./deployment-utils";

export async function main(argv: string[]): Promise<void> {
  const subcommand = argv[3]; // argv[0] = node, argv[1] = cli.js, argv[2] = deploy

  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    showHelp();
    return;
  }

  if (subcommand === "init") {
    await initDeployConfig();
    return;
  }

  if (subcommand === "run") {
    await runDeployment();
    return;
  }

  // eslint-disable-next-line no-console
  console.error(`Unknown deploy command: ${subcommand}`);
  process.exit(1);
}

function showHelp(): void {
  const title = c.title("runner-dev deploy");
  const usage = alignRows(
    [
      [c.cmd("runner-dev deploy init"), "Initialize deployment configuration"],
      [c.cmd("runner-dev deploy run"), "Deploy application to configured servers"],
    ],
    { gap: 3, indent: 2 }
  );

  const description = `
Deploy your Runner application to remote servers using PM2, SSH, and NVM.
This command helps you:
- Set up Node.js environment via NVM
- Upload and sync your code via SSH
- Install dependencies
- Manage PM2 processes for multiple microservices
- Support scaled deployment across multiple nodes
`;

  // eslint-disable-next-line no-console
  console.log(
    [
      "",
      title,
      divider(),
      c.bold("Usage"),
      usage,
      "",
      c.bold("Description"),
      description,
      "",
    ].join("\n")
  );
}

async function initDeployConfig(): Promise<void> {
  const configPath = path.join(process.cwd(), "runner-dev.deploy.ts");
  
  // Check if config already exists
  try {
    await fs.access(configPath);
    // eslint-disable-next-line no-console
    console.log(`${c.yellow("Configuration already exists:")} ${configPath}`);
    // eslint-disable-next-line no-console
    console.log("Use --force to overwrite or edit the file manually.");
    return;
  } catch {
    // File doesn't exist, proceed with creation
  }

  const defaultConfig = `import { defineDeploymentConfig, defineServices, PathPresets, PM2Presets } from '@bluelibs/runner-dev';

// Type-safe deployment configuration with full TypeScript support
// Benefits:
// - Full IntelliSense and autocompletion in your IDE
// - Type checking to catch configuration errors early
// - Helper functions and presets for common configurations
// - Self-documenting code with TypeScript interfaces
export default defineDeploymentConfig({
  // Default settings applied to all environments
  defaults: {
    nodeVersion: "20", // Node.js version to install via NVM
    buildCommand: "npm run build", // Command to build the application
    installCommand: "npm ci --production", // Command to install dependencies
    pm2Config: PM2Presets.single() // Use predefined PM2 configuration
  },

  // Environment-specific configurations
  environments: {
    // Production environment example
    production: {
      // SSH connection details
      ssh: {
        host: "your-server.com",
        username: "deploy",
        // You can use keyFile or password (keyFile recommended)
        keyFile: "~/.ssh/id_rsa",
        // password: "your-password",
        port: 22
      },

      // Deployment paths on the server (using preset for convenience)
      paths: PathPresets.standard("my-app"),

      // Services to deploy (supports multiple microservices)
      services: defineServices([
        {
          name: "api",
          script: "dist/main.js", // Entry point relative to project root
          port: 3000,
          env: {
            PORT: 3000,
            NODE_ENV: "production"
          }
        },
        {
          name: "worker",
          script: "dist/worker.js",
          env: {
            NODE_ENV: "production",
            WORKER_CONCURRENCY: 5
          }
        }
      ]),

      // Optional: Pre and post deployment hooks
      hooks: {
        beforeDeploy: [
          // Commands to run before deployment
        ],
        afterDeploy: [
          "pm2 save", // Save PM2 configuration
          "sudo nginx -s reload" // Reload nginx if needed
        ]
      }
    },

    // Staging environment example
    staging: {
      ssh: {
        host: "staging-server.com",
        username: "deploy",
        keyFile: "~/.ssh/id_rsa"
      },
      paths: PathPresets.standard("staging-app"),
      services: defineServices([
        {
          name: "staging-api",
          script: "dist/main.js",
          port: 3001,
          env: {
            PORT: 3001,
            NODE_ENV: "staging"
          }
        }
      ])
    }
  },

  // Multi-server deployment (for scaling)
  clusters: {
    // Example cluster configuration
    "production-cluster": {
      servers: [
        {
          host: "web1.example.com",
          username: "deploy",
          keyFile: "~/.ssh/id_rsa",
          role: "web" // Optional role identifier
        },
        {
          host: "web2.example.com", 
          username: "deploy",
          keyFile: "~/.ssh/id_rsa",
          role: "web"
        },
        {
          host: "worker1.example.com",
          username: "deploy", 
          keyFile: "~/.ssh/id_rsa",
          role: "worker"
        }
      ],
      // Override services per role
      servicesByRole: {
        web: ["api"],
        worker: ["worker"]
      }
    }
  }
});
`;

  try {
    await fs.writeFile(configPath, defaultConfig, "utf8");
    // eslint-disable-next-line no-console
    console.log(`${c.green("✓ Created type-safe deployment configuration:")} ${configPath}`);
    // eslint-disable-next-line no-console
    console.log("\nNext steps:");
    // eslint-disable-next-line no-console
    console.log(`1. Edit ${c.bold(configPath)} with your server details`);
    // eslint-disable-next-line no-console
    console.log(`2. Run ${c.cmd("runner-dev deploy run production")} to deploy`);
    // eslint-disable-next-line no-console
    console.log(`\n${c.cyan("💡 Benefits of TypeScript configuration:")}`);
    // eslint-disable-next-line no-console
    console.log("   • Full IntelliSense and autocompletion in your IDE");
    // eslint-disable-next-line no-console
    console.log("   • Type checking to catch configuration errors early");
    // eslint-disable-next-line no-console
    console.log("   • Helper functions and presets for common configurations");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`${c.magenta("Failed to create config:")} ${error}`);
    process.exit(1);
  }
}

async function runDeployment(): Promise<void> {
  const environmentOrCluster = process.argv[4];
  
  if (!environmentOrCluster) {
    // eslint-disable-next-line no-console
    console.error(`${c.magenta("Error:")} Please specify an environment or cluster name`);
    // eslint-disable-next-line no-console
    console.log(`Example: ${c.cmd("runner-dev deploy run production")}`);
    process.exit(1);
  }

  try {
    // Load deployment configuration
    const config = await loadDeploymentConfig();
    const deploymentManager = new DeploymentManager(config);

    // Check if it's an environment or cluster
    if (config.environments[environmentOrCluster]) {
      // eslint-disable-next-line no-console
      console.log(`${c.cyan("🚀 Starting deployment to environment:")} ${c.bold(environmentOrCluster)}`);
      await deploymentManager.deployToEnvironment(environmentOrCluster);
    } else if (config.clusters?.[environmentOrCluster]) {
      // eslint-disable-next-line no-console
      console.log(`${c.cyan("🚀 Starting deployment to cluster:")} ${c.bold(environmentOrCluster)}`);
      await deploymentManager.deployToCluster(environmentOrCluster);
    } else {
      // eslint-disable-next-line no-console
      console.error(`${c.magenta("Error:")} Environment or cluster '${environmentOrCluster}' not found in configuration`);
      
      // Show available options
      const environments = Object.keys(config.environments);
      const clusters = Object.keys(config.clusters || {});
      
      if (environments.length > 0) {
        // eslint-disable-next-line no-console
        console.log(`\n${c.bold("Available environments:")}`);
        environments.forEach(env => {
          // eslint-disable-next-line no-console
          console.log(`  - ${env}`);
        });
      }
      
      if (clusters.length > 0) {
        // eslint-disable-next-line no-console
        console.log(`\n${c.bold("Available clusters:")}`);
        clusters.forEach(cluster => {
          // eslint-disable-next-line no-console
          console.log(`  - ${cluster}`);
        });
      }
      
      process.exit(1);
    }

    // eslint-disable-next-line no-console
    console.log(`\n${c.green("🎉 Deployment completed successfully!")}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`\n${c.magenta("❌ Deployment failed:")}`);
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}