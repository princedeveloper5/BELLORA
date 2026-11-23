const ROUTE_META = [
  ['/login', 'Sign In', 'BELLORA · Authentication'],
  ['/choose-role', 'Choose Your Role', 'BELLORA · Authentication'],
  ['/register', 'Choose Account Type', 'BELLORA · Registration'],
  ['/register/teacher', 'Teacher Registration', 'BELLORA · Registration'],
  ['/dos/register', 'Director Registration', 'BELLORA · Registration'],
  ['/forgot-password', 'Reset Access', 'BELLORA · Authentication'],
  ['/reset-password', 'Set New Password', 'BELLORA · Authentication'],
  ['/account-status', 'Account Status', 'BELLORA · Authentication'],

  ['/super-admin/dashboard', 'Dashboard', 'Super Admin · Dashboard'],
  ['/super-admin/schools/', 'School Profile', 'Super Admin · Schools · Details'],
  ['/super-admin/schools', 'School Management', 'Super Admin · Schools'],
  ['/super-admin/approvals', 'Approval Center', 'Super Admin · Approvals'],
  ['/super-admin/users', 'User Management', 'Super Admin · Users'],
  ['/super-admin/reports', 'Reports', 'Super Admin · Reports'],
  ['/super-admin/notifications', 'Notifications', 'Super Admin · Notifications'],
  ['/super-admin/activity', 'Activity Logs', 'Super Admin · Audit Trail'],
  ['/super-admin/settings', 'Settings', 'Super Admin · Settings'],
  ['/super-admin/profile', 'My Profile', 'Super Admin · Profile'],

  ['/dos/timetables/conflicts', 'Timetable Conflicts', 'DOS · Timetable'],
  ['/dos/timetables/', 'Timetable Grid', 'DOS · Timetable'],
  ['/dos/timetables', 'Timetable Management', 'DOS · Timetable'],
  ['/dos/dashboard', 'Dashboard', 'DOS · Dashboard'],
  ['/dos/teachers', 'Teachers', 'DOS · Teachers'],
  ['/dos/classes', 'Classes', 'DOS · Classes'],
  ['/dos/subjects', 'Subjects', 'DOS · Subjects'],
  ['/dos/rooms', 'Rooms', 'DOS · Rooms'],
  ['/dos/reports', 'Academic Reports', 'DOS · Reports'],
  ['/dos/activity', 'Activity Log', 'DOS · Activity'],
  ['/dos/settings', 'Settings', 'DOS · Settings'],

  ['/teacher/dashboard', 'Teacher Dashboard', 'Teacher · Dashboard'],
  ['/teacher/timetable', 'My Timetable', 'Teacher · Timetable'],
  ['/teacher/attendance', 'Attendance', 'Teacher · Attendance'],
  ['/teacher/results', 'Results', 'Teacher · Results'],
  ['/teacher/notifications', 'Notifications', 'Teacher · Notifications'],
  ['/teacher/current-counter', 'Current Counter', 'Teacher · Lesson Counter'],
  ['/teacher/profile', 'My Profile', 'Teacher · Profile'],
  ['/teacher/settings', 'Settings', 'Teacher · Settings'],

  ['/student/dashboard', 'Student Dashboard', 'Student · Dashboard'],
  ['/student/timetable', 'My Timetable', 'Student · Timetable'],
  ['/student/subjects', 'My Subjects', 'Student · Subjects'],
  ['/student/attendance', 'Attendance', 'Student · Attendance'],
  ['/student/results', 'Results', 'Student · Results'],
  ['/student/profile', 'My Profile', 'Student · Profile'],

  ['/settings', 'Settings', 'Shared · Settings'],
  ['/teachers', 'Teachers', 'Shared · Teachers'],
  ['/modules', 'Subjects', 'Shared · Subjects'],
  ['/classes', 'Classes', 'Shared · Classes'],
  ['/students', 'Students', 'Shared · Students'],
  ['/sections', 'Sections', 'Shared · Sections'],
  ['/shifts', 'Shifts', 'Shared · Shifts'],
  ['/rooms', 'Rooms', 'Shared · Rooms'],
  ['/assignments', 'Assignments', 'Shared · Assignments'],
  ['/notifications', 'Notifications', 'Shared · Notifications'],
  ['/announcements', 'Announcements', 'Shared · Announcements'],
  ['/teacher-portal', 'Teacher Assignments', 'Shared · Teacher Portal']
]

export function routeMeta(pathname) {
  for (const [prefix, title, crumb] of ROUTE_META) {
    if (pathname === prefix || pathname.startsWith(prefix)) return { title, crumb }
  }
  return { title: 'Dashboard', crumb: '' }
}
