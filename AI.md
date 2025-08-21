# Runner-Dev AI Assistant Guide

This document provides AI assistants with comprehensive guidance on using Runner-Dev's introspection and development tools.

## What is Runner-Dev?

Runner-Dev is a powerful development toolkit for applications built with the **@bluelibs/runner** framework. It provides:

- **Live Introspection**: Query your running application's architecture
- **Hot-Swapping**: Modify tasks at runtime with TypeScript/JavaScript
- **Real-time Telemetry**: Monitor logs, events, errors, and performance
- **GraphQL API**: Comprehensive query interface for all system data
- **MCP Integration**: AI-native development environment
- **Tags (first-class)**: Discover Tag objects and reverse usage via GraphQL (`tags`, `tag(id)`).

## Available GraphQL Queries

### System Architecture Queries

```graphql
# Get all elements (tasks, resources, events, middleware, hooks)
query SystemOverview {
  all {
    id
    meta {
      title
      description
    }
    filePath
  }
}

# Get specific element types
query Architecture {
  tasks {
    id
    meta {
      title
      description
    }
    dependsOn
    emits
  }
  resources {
    id
    meta {
      title
      description
    }
    dependsOn
    registers
    overrides
    usedBy
  }
  events {
    id
    emittedBy
    listenedToBy
  }
  middlewares {
    id
    meta {
      title
      description
    }
    usedByTasks
  }
  hooks {
    id
    meta {
      title
      description
    }
    event
  }
}
```

### Live Telemetry Queries

```graphql
# Real-time system monitoring
query LiveTelemetry {
  live {
    memory {
      heapUsed
      heapTotal
      rss
    }
    cpu {
      usage
      loadAverage
    }
    eventLoop {
      lag
    }
    gc {
      collections
      duration
    }

    # Recent activity (use 'last' parameter to limit)
    logs(last: 10) {
      timestampMs
      level
      message
      correlationId
    }
    emissions(last: 10) {
      timestampMs
      eventId
      emitterId
      correlationId
    }
    errors(last: 10) {
      timestampMs
      sourceKind
      message
      correlationId
    }
    runs(last: 10) {
      timestampMs
      nodeId
      nodeKind
      durationMs
      ok
      correlationId
    }
  }
}
```

### Diagnostics & Health

```graphql
# System diagnostics and issues
query SystemHealth {
  diagnostics {
    severity
    code
    message
    nodeId
    nodeKind
  }
}
```

## Available GraphQL Mutations

### Hot-Swapping Tasks

```graphql
# Swap a task's implementation at runtime
mutation SwapTask($taskId: ID!, $runCode: String!) {
  swapTask(taskId: $taskId, runCode: $runCode) {
    success
    error
    taskId
  }
}

# Restore original implementation
mutation UnswapTask($taskId: ID!) {
  unswapTask(taskId: $taskId) {
    success
    error
    taskId
  }
}

# Restore all tasks
mutation UnswapAllTasks {
  unswapAllTasks {
    success
    error
    taskId
  }
}
```

### Task Invocation

```graphql
# Invoke a task remotely
mutation InvokeTask(
  $taskId: ID!
  $inputJson: String
  $pure: Boolean
  $evalInput: Boolean
) {
  invokeTask(
    taskId: $taskId
    inputJson: $inputJson
    pure: $pure # bypass middleware
    evalInput: $evalInput # evaluate input as JavaScript
  ) {
    success
    error
    result
    executionTimeMs
    invocationId
  }
}
```

### Code Evaluation

```graphql
# Execute arbitrary code on the server (DEV ONLY)
mutation EvalCode($code: String!, $inputJson: String, $evalInput: Boolean) {
  eval(code: $code, inputJson: $inputJson, evalInput: $evalInput) {
    success
    error
    result
    executionTimeMs
    invocationId
  }
}
```

## MCP Tools Available

### GraphQL Operations

- `graphql_query` - Execute read-only GraphQL queries
- `graphql_mutation` - Execute GraphQL mutations (if ALLOW_MUTATIONS=true)
- `graphql.introspect` - Get full schema introspection
- `graphql.schemaSdl` - Get schema as SDL string
- `graphql.ping` - Test connectivity

### Documentation

- `help.read` - Read local docs (README.md, AI.md) or package docs
- `help.runner` - Read @bluelibs/runner framework documentation
- `help.runnerDev` - Read Runner-Dev application documentation (README + AI guide)
- `project.overview` - Generate dynamic project overview

**🎯 Pro Tip: Array-Based Heading Filtering**
All documentation tools support powerful array-based heading filtering:

```typescript
// Single heading (traditional)
headingIncludes: "installation";

// Multiple headings (NEW!) - Get comprehensive context in one call
headingIncludes: ["installation", "configuration", "troubleshooting"];
headingIncludes: ["tasks", "resources", "events", "middleware"];
headingIncludes: ["hot-swapping", "live telemetry", "debugging"];
```

This enables gathering related information efficiently instead of making multiple sequential requests. The output shows exactly what sections were found and combines them with clear separators.

**Example Usage:**

```typescript
// Get comprehensive Runner framework understanding
help.runner({
  headingIncludes: ["tasks", "resources", "events", "middleware"],
});

// Understand development workflow
help.runner_dev({
  headingIncludes: ["hot-swapping", "live telemetry", "debugging"],
});

// Compare installation methods
help.read({ headingIncludes: ["installation", "setup", "configuration"] });
```

## Common Use Cases

### 1. Understanding System Architecture

```graphql
query UnderstandSystem {
  tasks {
    id
    meta {
      title
      description
    }
    dependsOn
    emits
    filePath
  }
  resources {
    id
    meta {
      title
      description
    }
    registers
    filePath
  }
}
```

### 2. Debugging Issues

```graphql
query DebuggingInfo {
  diagnostics {
    severity
    code
    message
    nodeId
  }
  live {
    errors(last: 20) {
      timestampMs
      sourceKind
      message
      stack
      correlationId
    }
  }
}
```

### 3. Performance Monitoring

```graphql
query Performance {
  live {
    memory {
      heapUsed
      heapTotal
      rss
    }
    cpu {
      usage
      loadAverage
    }
    eventLoop {
      lag
    }
    runs(last: 50, filter: { ok: false }) {
      nodeId
      durationMs
      error
      timestampMs
    }
  }
}
```

### 4. Hot Development Workflow

```graphql
# 1. Check current swapped tasks
query CheckSwapped {
  swappedTasks {
    taskId
    swappedAt
  }
}

# 2. Swap a task
mutation DevSwap {
  swapTask(
    taskId: "my.task"
    runCode: "async function run(input, deps) { return { message: 'Updated!' }; }"
  ) {
    success
    error
  }
}

# 3. Test the task
mutation TestTask {
  invokeTask(taskId: "my.task", inputJson: "{\"test\": true}", pure: true) {
    success
    result
    executionTimeMs
  }
}
```

## Best Practices for AI Assistants

### Documentation & Information Gathering

1. **Use Array-Based Heading Filters**: Get comprehensive context efficiently with `headingIncludes: ["topic1", "topic2", "topic3"]`
2. **Start with TOC**: Use `toc: true` to understand document structure before diving deep
3. **Choose Right Documentation Tool**:
   - `help.runner` for framework concepts
   - `help.runner-dev` for application-specific features
   - `help.read` for custom package docs
4. **Combine Related Topics**: Instead of multiple calls, use arrays like `["tasks", "resources", "events"]`

### System Operations

5. **Start with Overview**: Use `project.overview` to understand the system
6. **Use Correlation IDs**: Track related operations across logs/runs/errors
7. **Limit Results**: Always use `last` parameter for live queries to avoid overwhelming responses
8. **Check Diagnostics**: Look for warnings/errors that might indicate issues
9. **Use Markdown Format**: Request `format: "markdown"` for better readability
10. **Hot-Swap Safely**: Test swapped code with `pure: true` before production use

## Environment Variables

- `ENDPOINT` - GraphQL endpoint (default: http://localhost:1337/graphql)
- `ALLOW_MUTATIONS` - Enable mutations in MCP (default: false)
- `RUNNER_DEV_EVAL` - Enable eval mutation (default: false, DEV ONLY)

## Security Notes

- Mutations are disabled by default in production
- Eval is extremely dangerous and should only be used in development
- Hot-swapping affects the running system - use with caution
- All operations are logged with correlation IDs for traceability
