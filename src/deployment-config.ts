/**
 * Type-safe deployment configuration for runner-dev
 * 
 * Use this module to create type-safe deployment configurations with full TypeScript support.
 * 
 * @example
 * ```typescript
 * import { defineDeploymentConfig } from '@bluelibs/runner-dev/deployment-config';
 * 
 * export default defineDeploymentConfig({
 *   defaults: {
 *     nodeVersion: "20",
 *     buildCommand: "npm run build",
 *     installCommand: "npm ci --production",
 *     pm2Config: {
 *       instances: 1,
 *       maxMemoryRestart: "500M",
 *       env: { NODE_ENV: "production" }
 *     }
 *   },
 *   environments: {
 *     production: {
 *       ssh: { host: "server.com", username: "deploy", keyFile: "~/.ssh/id_rsa" },
 *       paths: {
 *         deployTo: "/var/www/app",
 *         current: "/var/www/app/current",
 *         releases: "/var/www/app/releases", 
 *         shared: "/var/www/app/shared"
 *       },
 *       services: [
 *         { name: "api", script: "dist/main.js", port: 3000 }
 *       ]
 *     }
 *   }
 * });
 * ```
 */

// Re-export all types from deployment-utils for convenience
export type {
  SSHConfig,
  DeploymentPaths,
  ServiceConfig,
  PM2Config,
  EnvironmentConfig,
  DeploymentConfig
} from './cli/deployment-utils';

import type {
  SSHConfig,
  DeploymentPaths,
  ServiceConfig,
  PM2Config,
  EnvironmentConfig,
  DeploymentConfig
} from './cli/deployment-utils';

/**
 * Factory function to create a type-safe deployment configuration
 * 
 * This function provides full TypeScript intellisense and validation for deployment configurations.
 * It ensures that your configuration matches the expected schema at compile time.
 * 
 * @param config - The deployment configuration object
 * @returns The same configuration object with full type safety
 */
export function defineDeploymentConfig(config: DeploymentConfig): DeploymentConfig {
  return config;
}

/**
 * Helper function to create an SSH configuration with type safety
 */
export function defineSSHConfig(config: SSHConfig): SSHConfig {
  return config;
}

/**
 * Helper function to create deployment paths with type safety
 */
export function defineDeploymentPaths(paths: DeploymentPaths): DeploymentPaths {
  return paths;
}

/**
 * Helper function to create a service configuration with type safety
 */
export function defineServiceConfig(service: ServiceConfig): ServiceConfig {
  return service;
}

/**
 * Helper function to create multiple service configurations with type safety
 */
export function defineServices(services: ServiceConfig[]): ServiceConfig[] {
  return services;
}

/**
 * Helper function to create an environment configuration with type safety
 */
export function defineEnvironmentConfig(env: EnvironmentConfig): EnvironmentConfig {
  return env;
}

/**
 * Helper function to create PM2 configuration with type safety
 */
export function definePM2Config(config: PM2Config): PM2Config {
  return config;
}

/**
 * Predefined common PM2 configurations for different scenarios
 */
export const PM2Presets = {
  /**
   * Single instance configuration for simple applications
   */
  single: (): PM2Config => ({
    instances: 1,
    maxMemoryRestart: "500M",
    env: {
      NODE_ENV: "production"
    }
  }),

  /**
   * Cluster configuration for CPU-intensive applications
   */
  cluster: (instances = 0): PM2Config => ({
    instances: instances || 0, // 0 = use all CPU cores
    maxMemoryRestart: "1G",
    env: {
      NODE_ENV: "production"
    }
  }),

  /**
   * Memory-optimized configuration for memory-intensive applications
   */
  memoryOptimized: (): PM2Config => ({
    instances: 1,
    maxMemoryRestart: "2G",
    env: {
      NODE_ENV: "production",
      NODE_OPTIONS: "--max-old-space-size=2048"
    }
  })
};

/**
 * Common deployment path patterns
 */
export const PathPresets = {
  /**
   * Standard deployment paths for a given app name
   */
  standard: (appName: string): DeploymentPaths => ({
    deployTo: `/var/www/${appName}`,
    current: `/var/www/${appName}/current`,
    releases: `/var/www/${appName}/releases`,
    shared: `/var/www/${appName}/shared`
  }),

  /**
   * Home directory deployment paths (for user-based deployments)
   */
  home: (appName: string, username = "deploy"): DeploymentPaths => ({
    deployTo: `/home/${username}/${appName}`,
    current: `/home/${username}/${appName}/current`,
    releases: `/home/${username}/${appName}/releases`,
    shared: `/home/${username}/${appName}/shared`
  }),

  /**
   * Opt directory deployment paths
   */
  opt: (appName: string): DeploymentPaths => ({
    deployTo: `/opt/${appName}`,
    current: `/opt/${appName}/current`,
    releases: `/opt/${appName}/releases`,
    shared: `/opt/${appName}/shared`
  })
};