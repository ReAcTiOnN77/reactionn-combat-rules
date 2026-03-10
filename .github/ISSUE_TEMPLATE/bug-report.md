---
name: Bug Report
about: Report a Bug
title: "[BUG]"
labels: bug
assignees: ''

---

## Describe the Bug
A clear description of what's going wrong.

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior
*What you expected to happen.*

## Actual Behavior
*What actually happened.*

## Environment
- **Foundry VTT version:** 
- **System & version:** 
- **Module version:** 
- **Hosting:** (self-hosted / Forge / Foundry Cloud / other)
- **Browser:** 
- **OS:** 

## Module Settings
*List any relevant module settings and their values.*

## Active Modules
Paste your active module list from the browser console (F12):
```js
game.modules.filter(m => m.active).map(m => `${m.title} (${m.version})`).join('\n')
```

<details>
<summary>Module List</summary>
*```(paste here)```*

</details>

## Console Errors
Open the browser console (F12 → Console), reproduce the bug, and paste any errors:

<details>
<summary>Console Output</summary>
*```(paste here)```*

</details>

## Screenshots / Recordings
*If applicable, add screenshots or a short recording showing the issue.*

## Additional Context
*Anything else that might help — specific actors, token setups, macros, etc.*
