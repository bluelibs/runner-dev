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
      :root {
        --bg-primary: #0d1117;
        --bg-secondary: #161b22;
        --bg-tertiary: #21262d;
        --bg-hover: #30363d;
        --bg-gradient: linear-gradient(135deg, #0d1117 0%, #1c1f26 25%, #2d1b69 75%, #1e3a8a 100%);
        
        --text-primary: #f0f6fc;
        --text-secondary: #b3b9c4;
        --text-muted: #7d8590;
        
        --accent-purple: #8b5cf6;
        --accent-purple-hover: #a78bfa;
        --accent-blue: #3b82f6;
        --accent-blue-hover: #60a5fa;
        --accent-deep-blue: #1e3a8a;
        
        --border-primary: #30363d;
        --border-secondary: #21262d;
        --border-accent: var(--accent-purple);
        
        --shadow-purple: 0 0 20px rgba(139, 92, 246, 0.3);
        --shadow-blue: 0 0 15px rgba(59, 130, 246, 0.2);
      }
      
      html, body, #voyager { 
        height: 100%; 
        width: 100%; 
        margin: 0; 
        padding: 0; 
      }


      
      body { 
        background: var(--bg-gradient);
        color: var(--text-primary);
      }
      
      /* Panel Styles */
      .doc-panel { 
        background: var(--bg-primary); 
        color: var(--text-primary);
        border-right: 1px solid var(--border-primary);
        font-family: "JetBrains Mono", "SF Mono", Consolas, "Liberation Mono", monospace;
      }
      .doc-panel > .header { 
        color: var(--text-secondary);
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border-primary);
      }
      
      /* Content Styles */
      .contents { 
        background: var(--bg-primary); 
        color: var(--text-primary); 
      }
      .contents > p { 
        background: var(--bg-primary); 
        color: var(--text-primary); 
        font-family: "JetBrains Mono", "SF Mono", Consolas, "Liberation Mono", monospace;
      }
      .contents .search-box-wrapper input { 
        color: var(--text-primary);
        background: var(--bg-secondary);
        border-radius: 6px;
        padding: 8px;
      }
      .contents .search-box-wrapper input:focus {
        border-color: var(--accent-purple);
        box-shadow: var(--shadow-purple);
      }
      
      /* Type Documentation */
      .type-doc { 
        background: var(--bg-primary); 
        color: var(--text-primary); 
        margin-top: 0; 
        padding-top: 15px; 
      }

      .graphql-voyager > .menu-content > .setting-other-options {
        padding: 10px 32px 0px 10px;
      }

      .type-doc.-scalar, .type-name.-built-in {
        color: var(--accent-purple);
      }
      .type-doc > .doc-navigation { 
        background: var(--bg-secondary); 
        color: var(--text-primary);
        border-bottom: 1px solid var(--border-primary);
      }
      .type-doc > div { 
        background: var(--bg-primary); 
        color: var(--text-primary); 
      }
      
      /* List Items */
      .typelist-item { 
        background: var(--bg-secondary); 
        color: var(--text-primary);
        border: 1px solid var(--border-secondary);
        border-radius: 4px;
        margin: 4px 0;
        transition: all 0.2s ease;
      }
      .typelist-item:hover {
        background: var(--bg-hover);
        border-color: var(--accent-purple);
        box-shadow: var(--shadow-purple);
      }
      
      /* Search */
      .search-box-wrapper { 
        background: var(--bg-secondary); 
        color: var(--text-primary);
        border-radius: 8px;
        padding: 8px;
      }
      
      /* Field Names */
      .field-name { 
        color: var(--accent-purple);
        font-weight: 600;
      }
      

      .field-name.edge-source:hover,
      g.field.edge-source:hover .type-link,
      #graph0 g.field.edge-source:hover text.type-link {
        fill: var(--accent-blue-hover) !important;
        color: var(--accent-blue-hover) !important;
        text-decoration-color: var(--accent-blue-hover);
        filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.5));
      }
      
      /* Category Items */
      .doc-category > .item:hover { 
        background: var(--bg-hover);
        border-left: 3px solid var(--accent-purple);
        transition: all 0.2s ease;
      }
      
      /* Voyager Menu */
      .graphql-voyager .menu-content { 
        background: var(--bg-primary); 
        color: var(--text-primary);
        border: 1px solid var(--border-primary);
        border-radius: 8px;
        box-shadow: var(--shadow-blue);
      }
      .menu-content .setting-change-root { 
        display: none; 
      }
      
      /* Graph Nodes */
      #graph0 g.node polygon { 
        fill: var(--accent-blue);
        stroke: var(--border-primary);
        stroke-width: 1;
        transition: all 0.3s ease;
      }
      #graph0 g.node:hover polygon { 
        fill: var(--accent-blue-hover);
        stroke: var(--accent-purple);
        stroke-width: 2;
      }
      #graph0 g.node.selected polygon { 
        fill: var(--bg-secondary) !important;
        stroke: var(--accent-purple) !important; 
        stroke-width: 3 !important;
        filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.4)) !important;
      }
      #graph0 g.node.selected text { 
        fill: var(--text-primary) !important;
        stroke: none !important;
        font-weight: 700 !important;
      }
      #graph0 g.node.selected-reachable polygon {
        fill: var(--bg-tertiary) !important;
        stroke: var(--accent-blue) !important;
        stroke-width: 2 !important;
      }
      #graph0 g.node.selected-reachable text { 
        fill: var(--accent-purple) !important;
        stroke: none !important;
        font-weight: 600 !important;
      }
      #graph0 text { 
        fill: var(--text-primary); 
        font-weight: 600; 
        stroke: none;
      }

      /* Specific Node Types */
      #graph0 g#TYPE\:\:Query polygon { 
        fill: var(--accent-deep-blue);
        stroke: var(--accent-purple);
        stroke-width: 2;
      }
      #graph0 g#FIELD\:\:Query\:\:tags polygon { 
        fill: var(--bg-tertiary);
        stroke: var(--accent-blue);
      }
      
      /* Modern Scrollbar */
      ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      ::-webkit-scrollbar-track {
        background: var(--bg-secondary);
        border-radius: 6px;
      }
      ::-webkit-scrollbar-thumb {
        background: linear-gradient(45deg, var(--accent-purple), var(--accent-blue));
        border-radius: 6px;
        border: 1px solid var(--border-primary);
      }
      ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(45deg, var(--accent-purple-hover), var(--accent-blue-hover));
        box-shadow: var(--shadow-purple);
      }
      ::-webkit-scrollbar-corner {
        background: var(--bg-secondary);
      }
      
      /* Firefox Scrollbar */
      * {
        scrollbar-width: thin;
        scrollbar-color: var(--accent-purple) var(--bg-secondary);
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
