#!/usr/bin/env ts-node

/**
 * Demo script showing how to use runner-dev with SQLite database persistence.
 * 
 * This script demonstrates:
 * 1. Setting up runner-dev with database persistence
 * 2. Capturing telemetry data in SQLite
 * 3. Persisting schema information
 * 4. Reading persisted data from the database
 */

import { dev } from '../../resources/dev.resource';
import { task, resource, run } from '@bluelibs/runner';
import path from 'path';
import fs from 'fs';

// Demo task and resource
const demoTask = task({
  id: 'demo.task',
  meta: {
    title: 'Demo Task',
    description: 'A simple task for demonstrating database persistence',
  },
  async run() {
    console.log('Demo task executed!');
    return { message: 'Hello from demo task!', timestamp: Date.now() };
  },
});

const demoResource = resource({
  id: 'demo.resource',
  meta: {
    title: 'Demo Resource',
    description: 'A simple resource for the demo',
  },
  register: [demoTask],
  async init() {
    console.log('Demo resource initialized');
    return { ready: true };
  },
});

const app = resource({
  id: 'demo.app',
  register: [
    demoResource,
    dev.with({
      port: 31341,
      maxEntries: 1000,
      database: {
        driver: 'sqlite',
        options: {
          filePath: path.join(__dirname, '../../demo-telemetry.db'),
        },
      },
    }),
  ],
});

async function main() {
  console.log('🚀 Starting Runner Dev with SQLite database persistence...\n');
  
  const dbPath = path.join(__dirname, '../../demo-telemetry.db');
  
  // Clean up any existing demo database
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🧹 Cleaned up existing demo database');
  }

  try {
    const runner = await run(app);
    console.log('✅ App started successfully!');
    console.log(`📊 Telemetry database created at: ${dbPath}`);
    console.log('🌐 GraphQL endpoint available at: http://localhost:31341/graphql');
    console.log('📱 Web UI available at: http://localhost:31341/ui');
    
    // Execute the demo task to generate some telemetry data
    console.log('\n🔄 Executing demo task to generate telemetry data...');
    const taskResult = await runner.runTask(demoTask.id);
    console.log('✅ Demo task completed:', taskResult);
    
    // Wait a bit to let telemetry data be written
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n📋 Database file exists:', fs.existsSync(dbPath));
    console.log('📏 Database file size:', fs.existsSync(dbPath) ? fs.statSync(dbPath).size + ' bytes' : 'N/A');
    
    console.log('\n🎉 Demo completed! You can now:');
    console.log('   1. Visit http://localhost:31341/ui to see the web interface');
    console.log('   2. Query telemetry data via GraphQL at http://localhost:31341/graphql');
    console.log('   3. Inspect the SQLite database file at:', dbPath);
    console.log('\n   Example GraphQL query to see logs:');
    console.log('   {');
    console.log('     live {');
    console.log('       logs(last: 10) {');
    console.log('         timestampMs');
    console.log('         level');
    console.log('         message');
    console.log('         sourceId');
    console.log('       }');
    console.log('     }');
    console.log('   }');
    
    console.log('\n📁 Database Schema Tables Created:');
    console.log('   - log_entry_entity (telemetry logs)');
    console.log('   - emission_entry_entity (event emissions)');
    console.log('   - error_entry_entity (error records)');
    console.log('   - run_record_entity (task/hook execution records)');
    console.log('   - schema_entity (introspector schema persistence)');
    
    console.log('\n⏱️  Keeping server running for 30 seconds...');
    setTimeout(async () => {
      console.log('\n🛑 Shutting down demo...');
      process.exit(0);
    }, 30000);
    
  } catch (error) {
    console.error('❌ Error running demo:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}