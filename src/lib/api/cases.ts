/**
 * CRM case API barrel (C0 split). Prefer importing from here for case workflows;
 * `../api` remains the implementation home during the incremental split.
 */
export {
  searchCases,
  getCase,
  createCase,
  updateCase,
  addCaseInteraction,
  escalateCase,
  listCaseAudit,
  getCaseTimeline,
  listCaseTasks,
  createCaseTask,
  updateCaseTask,
  listCaseAttachments,
  registerCaseAttachment,
  linkCase,
  mergeCase,
  getRunbook,
  listRunbooks,
  crmSearch,
  crmLookup,
  getCustomer360,
  CASES_PAGE_SIZE
} from '../api';

/** Prefer `./customers` for C3 identity/adapter clients. */
