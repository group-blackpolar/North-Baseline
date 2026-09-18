import {
  MOCK_ACTIVITY,
  MOCK_FILES,
  MOCK_NOTIFICATIONS,
  MOCK_SESSIONS,
  MOCK_USAGE,
  MOCK_USAGE_TREND,
} from './mocks';

/** Única puerta de datos del Personal Workspace.
 *  TODO: CoreCrow — Activity, Files, Sessions, User Preferences. */
export const personalService = {
  activity: () => MOCK_ACTIVITY,
  files: () => MOCK_FILES,
  sessions: () => MOCK_SESSIONS,
  notifications: () => MOCK_NOTIFICATIONS,
  usage: () => MOCK_USAGE,
  usageTrend: () => MOCK_USAGE_TREND,
};