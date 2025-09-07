export default `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GraphQL Voyager</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-voyager@1.3.0/dist/voyager.css" />
    <script crossorigin src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/graphql-voyager@1.3.0/dist/voyager.min.js"></script>
    <style>
      html, body, #voyager { height: 100%; width: 100%; margin: 0; padding: 0; }
      body { 
        background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%);
        font-family: "JetBrains Mono", "SF Mono", Consolas, "Liberation Mono", monospace;
      }
      
    </style>
  </head>

  <body>
    <div id="voyager">Loading...</div>
    <script>
      const GRAPHQL_ENDPOINT = window.location.origin + '/graphql';
      function introspectionProvider(query) {
        return fetch(GRAPHQL_ENDPOINT, {
          method: 'post',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        }).then(r => r.json());
      }
      // Render <Voyager />
      GraphQLVoyager.init(document.getElementById('voyager'), {
        introspection: introspectionProvider,
      });
    </script>
  </body>
 </html>`;
