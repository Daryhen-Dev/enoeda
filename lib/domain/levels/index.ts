export {
  getLevels,
  createLevel,
  updateLevel,
  setInitialLevel,
  listBranchLevelRequirements,
  setBranchLevelRequirement,
  clearBranchLevelRequirement,
} from "./actions";
export type {
  LevelRecord,
  ActionResult,
  BranchLevelRequirementView,
  DisciplineBranchLevelRequirements,
} from "./actions";
export {
  resolveRequiredSessions,
  buildBranchRequirementMap,
  type BranchLevelRequirementRow,
} from "./branch-requirements";
export type {
  LevelCreateInput,
  LevelUpdateInput,
  LevelsQueryInput,
  SetInitialLevelInput,
  BranchLevelRequirementsQueryInput,
  SetBranchLevelRequirementInput,
  ClearBranchLevelRequirementInput,
} from "./schema";
export { LEVEL_MESSAGES, BRANCH_LEVEL_MESSAGES } from "@/lib/localization/es-ec";
