## Version 1.3.0
- Verified compatible with Foundry VTT v14 and D&D 5e v5.3.2
  - Foundry v13 remains fully supported
- Flanking and surrounded now correctly account for vertical separation on multi-level scenes
- Wall collision checks for the surrounded rule now respect wall elevation ranges
- Fixed attack rolls occasionally failing to detect the attacker's token when no token was selected

## Version 1.2.1
- Fixed compatibility with Automated Conditions 5e
- Condition advantage/disadvantage now defers to external modules when detected

## Version 1.2.0
- Refactored settings UI to use a single data-driven Handlebars template
- Added Flanking Immunity flags - creatures can be marked immune to flanking or unable to provide flanking
- Roll notes now show "No Flanking" when flanking is blocked by a flag
- Added toggle macros for Flanking Immune and Cannot Flank (via Active Effects)

## Version 1.1.3
- Merged all settings HBS files into one file
- Updated elevation rules to now fire on any target regardless of disposition

## Version 1.1.2
- Added Hex Grid Support
- Added No Flanking Daisy Chains option (default off)

## Version 1.1.1
- Fixed issue with Recovery prompt not firing for players, and only for the GM

## Version 1.1.0
- Added Ammo Tracking Feature
- Added Low Ground Penalty Option
- Removed Redundant Code
- Cleaned Up Settings Menu

## Version 1.0.0
- Initial Release
