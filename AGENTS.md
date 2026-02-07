<general>
- Be passionate about what you do, be precise, thoughtful and clear.
- The code should be designed as re-usable without being over-engineered.
- The code should be human-friendly (descriptive variables, function names, comments that describe the 'why'), code readability are a big plus.
- Keep functions small, decouple early on. Make code be read like a story.
- When doing a tasks, first think about the contracts and interfaces, then think about the acceptance criteria, and only then think about implementation.
- Type-strictness is a must, avoid type casting unless forced to
- Use `npm run qa` to test the full suite, linting, etc and see coverage in a token-friendly way.
- You can speed up process by running individual/focused tests instead of the full suite. For those (`npm run test -- searchKey`) is fine
- If there's global under 100% coverage on files/concerns you didn't work on, ignore those files.
- Always run the tests, don't assume that you're fixed work.
- When running commands, don't run them with bash -lc, or zsh -lc, run the commands directly.
- Use only relative imports
- Be truthful and avoid ignoring files in test configs as a way to achieve 100%.
- Work with agent-enabled TODO lists! TODO lists help you remain on-track.
- All imports should be put on top, unless an optimization or something specific, default to top imports as preference instead of inline.
- Do not ask the user if you should do something that is likely the user would wants you to do
</general>

<specifics>
- AI.md contains AI-token-friendly documentation about Runner. Read it if the task implies that you know Runner.
</specifics>

<new_feature>

- When building new features/enhancements/changes
- Must be implemented with care without affecting the system and not over-polute files.
- Ensure AI.md (minimal version of README) and README.md is properly updated
  </new_feature>
