Implement a solution which allows you to do the following:

a) Describe flows in agentic properties

```ts
const contexBox = createAgenticContext(contentElements)
contextBox.add({
    id: "general",
    description: "what it contains, when to ask it",
    content: "......"
})

const modelBox = createModelBox({

})

class AgentSpace {
    contenbox,
    models: {
        default: "xxx",
        smart: "xxx", // default if not exists

    }
}


class AgentA extends Agent {
    constructor(
        agentSpace,
        agentSettings,
    ) {}

    ask() {
        // by default
    }

    askJSON() {
        // by default.
    }

    readSomething() {
        const { normal } = this.agentSpace.agents;

        normal.ask("xxxx xxkalsfkalksf laksfkl")
    }

    fork() {
        // returns new instance of this basic agent
    }
}



const agent a = new agent({
    docs: {
        "xxx": "content"
    },
    actions: {
        'do_this': {
            responseSchema: zod,
            requiresDocs: ["xxx", "yyy"],
        }
    }
})
```
