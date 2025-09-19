import * as path from "node:path";
import * as fs from "node:fs/promises";
import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface SSHConfig {
  host: string;
  username: string;
  keyFile?: string;
  password?: string;
  port?: number;
}

export interface DeploymentPaths {
  deployTo: string;
  current: string;
  releases: string;
  shared: string;
}

export interface ServiceConfig {
  name: string;
  script: string;
  port?: number;
  instances?: number;
  env?: Record<string, string | number>;
}

export interface PM2Config {
  instances: number;
  maxMemoryRestart: string;
  env: Record<string, string | number>;
}

export interface EnvironmentConfig {
  ssh: SSHConfig;
  paths: DeploymentPaths;
  services: ServiceConfig[];
  hooks?: {
    beforeDeploy?: string[];
    afterDeploy?: string[];
  };
}

export interface DeploymentConfig {
  defaults: {
    nodeVersion: string;
    buildCommand: string;
    installCommand: string;
    pm2Config: PM2Config;
  };
  environments: Record<string, EnvironmentConfig>;
  clusters?: Record<string, {
    servers: Array<SSHConfig & { role?: string }>;
    servicesByRole?: Record<string, string[]>;
  }>;
}

export class DeploymentManager {
  private config: DeploymentConfig;

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  async deployToEnvironment(environmentName: string): Promise<void> {
    const environment = this.config.environments[environmentName];
    if (!environment) {
      throw new Error(`Environment '${environmentName}' not found in configuration`);
    }

    console.log(`🚀 Deploying to ${environmentName}...`);

    // Create a new release directory
    const releaseId = new Date().toISOString().replace(/[:.]/g, "-");
    const releasePath = path.join(environment.paths.releases, releaseId);

    try {
      // 1. Prepare release directory
      await this.createReleaseDirectory(environment.ssh, releasePath);

      // 2. Upload code
      await this.uploadCode(environment.ssh, releasePath);

      // 3. Setup Node.js environment
      await this.setupNodeEnvironment(environment.ssh, releasePath);

      // 4. Install dependencies
      await this.installDependencies(environment.ssh, releasePath);

      // 5. Build application
      await this.buildApplication(environment.ssh, releasePath);

      // 6. Run pre-deployment hooks
      if (environment.hooks?.beforeDeploy) {
        await this.runHooks(environment.ssh, releasePath, environment.hooks.beforeDeploy);
      }

      // 7. Update symlink to current release
      await this.updateCurrentSymlink(environment.ssh, releasePath, environment.paths.current);

      // 8. Start/restart services with PM2
      await this.manageServices(environment.ssh, environment.paths.current, environment.services);

      // 9. Run post-deployment hooks
      if (environment.hooks?.afterDeploy) {
        await this.runHooks(environment.ssh, environment.paths.current, environment.hooks.afterDeploy);
      }

      // 10. Cleanup old releases (keep last 5)
      await this.cleanupOldReleases(environment.ssh, environment.paths.releases);

      console.log(`✅ Successfully deployed to ${environmentName}`);
    } catch (error) {
      console.error(`❌ Deployment failed: ${error}`);
      throw error;
    }
  }

  async deployToCluster(clusterName: string): Promise<void> {
    const cluster = this.config.clusters?.[clusterName];
    if (!cluster) {
      throw new Error(`Cluster '${clusterName}' not found in configuration`);
    }

    console.log(`🚀 Deploying to cluster ${clusterName}...`);

    // Deploy to each server in parallel
    const deploymentPromises = cluster.servers.map(async (server) => {
      const serverConfig: EnvironmentConfig = {
        ssh: server,
        paths: {
          deployTo: `/var/www/${clusterName}`,
          current: `/var/www/${clusterName}/current`,
          releases: `/var/www/${clusterName}/releases`,
          shared: `/var/www/${clusterName}/shared`
        },
        services: this.getServicesForRole(cluster, server.role)
      };

      console.log(`📦 Deploying to ${server.host} (role: ${server.role || 'default'})...`);
      await this.deployToServer(serverConfig);
    });

    await Promise.all(deploymentPromises);
    console.log(`✅ Successfully deployed to cluster ${clusterName}`);
  }

  private getServicesForRole(cluster: { servicesByRole?: Record<string, string[]> }, role?: string): ServiceConfig[] {
    if (!cluster.servicesByRole || !role) {
      // Return all services if no role-based configuration
      return Object.values(this.config.environments)[0]?.services || [];
    }

    const serviceNames = cluster.servicesByRole[role] || [];
    const allServices = Object.values(this.config.environments)[0]?.services || [];
    
    return allServices.filter(service => serviceNames.includes(service.name));
  }

  private async deployToServer(environment: EnvironmentConfig): Promise<void> {
    // Same logic as deployToEnvironment but for a single server
    const releaseId = new Date().toISOString().replace(/[:.]/g, "-");
    const releasePath = path.join(environment.paths.releases, releaseId);

    await this.createReleaseDirectory(environment.ssh, releasePath);
    await this.uploadCode(environment.ssh, releasePath);
    await this.setupNodeEnvironment(environment.ssh, releasePath);
    await this.installDependencies(environment.ssh, releasePath);
    await this.buildApplication(environment.ssh, releasePath);
    
    if (environment.hooks?.beforeDeploy) {
      await this.runHooks(environment.ssh, releasePath, environment.hooks.beforeDeploy);
    }

    await this.updateCurrentSymlink(environment.ssh, releasePath, environment.paths.current);
    await this.manageServices(environment.ssh, environment.paths.current, environment.services);

    if (environment.hooks?.afterDeploy) {
      await this.runHooks(environment.ssh, environment.paths.current, environment.hooks.afterDeploy);
    }

    await this.cleanupOldReleases(environment.ssh, environment.paths.releases);
  }

  private async executeSSHCommand(ssh: SSHConfig, command: string): Promise<string> {
    const sshCommand = this.buildSSHCommand(ssh, command);
    
    try {
      const { stdout, stderr } = await execAsync(sshCommand);
      if (stderr) {
        console.warn(`SSH Warning: ${stderr}`);
      }
      return stdout;
    } catch (error) {
      throw new Error(`SSH command failed: ${error}`);
    }
  }

  private buildSSHCommand(ssh: SSHConfig, command: string): string {
    let sshCmd = `ssh -o StrictHostKeyChecking=no`;
    
    if (ssh.port && ssh.port !== 22) {
      sshCmd += ` -p ${ssh.port}`;
    }
    
    if (ssh.keyFile) {
      sshCmd += ` -i ${ssh.keyFile}`;
    }
    
    sshCmd += ` ${ssh.username}@${ssh.host} "${command}"`;
    return sshCmd;
  }

  private async createReleaseDirectory(ssh: SSHConfig, releasePath: string): Promise<void> {
    console.log(`📁 Creating release directory: ${releasePath}`);
    await this.executeSSHCommand(ssh, `mkdir -p ${releasePath}`);
  }

  private async uploadCode(ssh: SSHConfig, releasePath: string): Promise<void> {
    console.log(`📤 Uploading code to ${releasePath}...`);
    
    // Use rsync for efficient file transfer
    const rsyncCommand = this.buildRsyncCommand(ssh, releasePath);
    
    try {
      await execAsync(rsyncCommand);
      console.log(`✅ Code uploaded successfully`);
    } catch (error) {
      throw new Error(`Code upload failed: ${error}`);
    }
  }

  private buildRsyncCommand(ssh: SSHConfig, releasePath: string): string {
    let rsyncCmd = `rsync -avz --delete`;
    
    if (ssh.keyFile) {
      rsyncCmd += ` -e "ssh -i ${ssh.keyFile}"`;
    }
    
    if (ssh.port && ssh.port !== 22) {
      rsyncCmd += ` -e "ssh -p ${ssh.port}"`;
    }
    
    // Exclude common development files
    rsyncCmd += ` --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='*.log'`;
    rsyncCmd += ` ./ ${ssh.username}@${ssh.host}:${releasePath}/`;
    
    return rsyncCmd;
  }

  private async setupNodeEnvironment(ssh: SSHConfig, releasePath: string): Promise<void> {
    console.log(`🔧 Setting up Node.js environment (version ${this.config.defaults.nodeVersion})...`);
    
    const commands = [
      `cd ${releasePath}`,
      `source ~/.nvm/nvm.sh`,
      `nvm install ${this.config.defaults.nodeVersion}`,
      `nvm use ${this.config.defaults.nodeVersion}`,
      `node --version`,
      `npm --version`
    ];

    await this.executeSSHCommand(ssh, commands.join(" && "));
    console.log(`✅ Node.js environment ready`);
  }

  private async installDependencies(ssh: SSHConfig, releasePath: string): Promise<void> {
    console.log(`📦 Installing dependencies...`);
    
    const commands = [
      `cd ${releasePath}`,
      `source ~/.nvm/nvm.sh`,
      `nvm use ${this.config.defaults.nodeVersion}`,
      this.config.defaults.installCommand
    ];

    await this.executeSSHCommand(ssh, commands.join(" && "));
    console.log(`✅ Dependencies installed`);
  }

  private async buildApplication(ssh: SSHConfig, releasePath: string): Promise<void> {
    console.log(`🏗️  Building application...`);
    
    const commands = [
      `cd ${releasePath}`,
      `source ~/.nvm/nvm.sh`,
      `nvm use ${this.config.defaults.nodeVersion}`,
      this.config.defaults.buildCommand
    ];

    await this.executeSSHCommand(ssh, commands.join(" && "));
    console.log(`✅ Application built successfully`);
  }

  private async updateCurrentSymlink(ssh: SSHConfig, releasePath: string, currentPath: string): Promise<void> {
    console.log(`🔗 Updating current symlink...`);
    
    const commands = [
      `rm -f ${currentPath}`,
      `ln -s ${releasePath} ${currentPath}`
    ];

    await this.executeSSHCommand(ssh, commands.join(" && "));
    console.log(`✅ Symlink updated`);
  }

  private async manageServices(ssh: SSHConfig, currentPath: string, services: ServiceConfig[]): Promise<void> {
    console.log(`🔄 Managing PM2 services...`);

    for (const service of services) {
      await this.manageService(ssh, currentPath, service);
    }

    console.log(`✅ All services managed successfully`);
  }

  private async manageService(ssh: SSHConfig, currentPath: string, service: ServiceConfig): Promise<void> {
    console.log(`⚙️  Managing service: ${service.name}`);

    const pm2Config = {
      name: service.name,
      script: path.join(currentPath, service.script),
      instances: service.instances || this.config.defaults.pm2Config.instances,
      max_memory_restart: this.config.defaults.pm2Config.maxMemoryRestart,
      env: {
        ...this.config.defaults.pm2Config.env,
        ...service.env
      }
    };

    // Create PM2 ecosystem file for this service
    const ecosystemPath = `/tmp/${service.name}-ecosystem.config.js`;
    const ecosystemContent = `module.exports = {
  apps: [${JSON.stringify(pm2Config, null, 2)}]
};`;

    // Upload ecosystem file and start/restart service
    const commands = [
      `echo '${ecosystemContent}' > ${ecosystemPath}`,
      `source ~/.nvm/nvm.sh`,
      `nvm use ${this.config.defaults.nodeVersion}`,
      `pm2 startOrReload ${ecosystemPath}`,
      `pm2 list`
    ];

    await this.executeSSHCommand(ssh, commands.join(" && "));
    console.log(`✅ Service ${service.name} is running`);
  }

  private async runHooks(ssh: SSHConfig, workingPath: string, hooks: string[]): Promise<void> {
    if (hooks.length === 0) return;

    console.log(`🪝 Running deployment hooks...`);
    
    for (const hook of hooks) {
      const commands = [
        `cd ${workingPath}`,
        `source ~/.nvm/nvm.sh`,
        `nvm use ${this.config.defaults.nodeVersion}`,
        hook
      ];

      await this.executeSSHCommand(ssh, commands.join(" && "));
    }

    console.log(`✅ Hooks completed`);
  }

  private async cleanupOldReleases(ssh: SSHConfig, releasesPath: string): Promise<void> {
    console.log(`🧹 Cleaning up old releases...`);
    
    const command = `cd ${releasesPath} && ls -t | tail -n +6 | xargs -r rm -rf`;
    await this.executeSSHCommand(ssh, command);
    
    console.log(`✅ Old releases cleaned up`);
  }
}

export async function loadDeploymentConfig(configPath?: string): Promise<DeploymentConfig> {
  const defaultConfigPath = path.join(process.cwd(), "runner-dev.deploy.mjs");
  const finalConfigPath = configPath || defaultConfigPath;

  try {
    // Check if file exists
    await fs.access(finalConfigPath);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Deployment configuration not found at ${finalConfigPath}. Run 'runner-dev deploy init' to create it.`);
    }
    throw new Error(`Failed to access deployment configuration: ${error}`);
  }

  try {
    // Import the configuration
    const configModule = await import(`file://${path.resolve(finalConfigPath)}`);
    return configModule.default;
  } catch (error) {
    throw new Error(`Failed to load deployment configuration: ${error}`);
  }
}