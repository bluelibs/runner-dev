# TODOs

## Durable Workflow Visualization

Visual representation of durable workflow structure using `describeFlow()` API.

### Backend
- [ ] Add `isDurableTask()` helper to Introspector
- [ ] Create GraphQL `DurableFlowShape` types (step, sleep, signal, emit, switch, note)
- [ ] Add `flowShape` field to TaskType
- [ ] Integrate `describeFlow()` in live service

### UI
- [ ] Create `WorkflowDiagram` component with Mermaid CDN rendering
- [ ] Mermaid code generator from `DurableFlowShape`
- [ ] Dark theme styling with node-type icons (⏱📨📤🔀📝)
- [ ] Integrate into TaskCard/TaskDetail for durable tasks
- [ ] Lazy-load Mermaid.js only on workflow pages