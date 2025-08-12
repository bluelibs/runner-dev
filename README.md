This project is a set of tools that enable better development in Runner framework apps.

Kickstart:

```bash
npm install @bluelibs/runner-dev
```

```ts
import * as dev from "@bluelibs/runner-dev";

const app = resource({
  id: "root",
  register: [
    dev.resources.introspection.with({
      port: 2000, // Exposes GraphQL server to introspect running application
    }),
  ],
});
```

## Tools

### Introspection library via GraphQL

query {
root {
registers
}
resources {
...
tasks
}
tasks {

    }
    middleware {
        ...
    }
    events {

    }
    listener {

    }

    live {
        emissions(after: timestamp) {

        }
        logs(after: timestamp) {

        }
    }

}

Subscription {
emissions {}
logs {}
}
