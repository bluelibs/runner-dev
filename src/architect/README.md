## Architect within Runner

The architect can do two things:

a) Deep Research an implementation plan

- Scans the current archi, overviews, explores relations, understands the system, gathers context, may read additional file which some of the resources/tasks may import
- Based on this data, useful data and prompts required. Agent separation as brainstormed?
- This should be capped at a certain amount of tokens of research, maybe deepResearch: { with a self adjusting queue, where every inference can modify the queue }

b) Based on Deep Research it proposes an action plan in which either it modifies intelligently
replace, or replace_string, or delete_and_replace_lines(100, 200, 'new content') so it consumes minimal output context

Only works for tasks within workspace

c) It gives you full plan for review easy directly in chat.

- "Beam me up scotty"
- Includes tests, commit to disk the new changes.
