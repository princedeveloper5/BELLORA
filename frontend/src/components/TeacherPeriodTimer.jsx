import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, CalendarDays, Navigation, X } from 'lucide-react'
import api from '@/stores/api'
import { useAuthStore } from '@/stores/authStore'
import { buildTimetableRowsFromSettings } from '@/utils/fixedTimetableStructure'
import { isAcademicWeekend } from '@/utils/dayHelpers'
import './TeacherPeriodTimer.css'

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const alarmTones = [
  {
    label: 'School bell',
    shortLabel: 'BELL',
    type: 'square',
    pulses: [
      { at: 0, from: 880, to: 1175, duration: 0.34 },
      { at: 0.42, from: 880, to: 1175, duration: 0.34 },
      { at: 0.84, from: 880, to: 1175, duration: 0.34 }
    ]
  },
  {
    label: 'Soft chime',
    shortLabel: 'CHIME',
    type: 'sine',
    pulses: [
      { at: 0, from: 660, to: 880, duration: 0.5 },
      { at: 0.56, from: 880, to: 1320, duration: 0.56 }
    ]
  },
  {
    label: 'Urgent beep',
    shortLabel: 'BEEP',
    type: 'triangle',
    pulses: [
      { at: 0, from: 1040, to: 1040, duration: 0.18 },
      { at: 0.26, from: 1040, to: 1040, duration: 0.18 },
      { at: 0.52, from: 1040, to: 1040, duration: 0.18 },
      { at: 0.78, from: 1040, to: 1040, duration: 0.18 }
    ]
  },
  {
    label: 'Digital alarm',
    shortLabel: 'ALARM',
    type: 'sawtooth',
    pulses: [
      { at: 0, from: 760, to: 980, duration: 0.24 },
      { at: 0.3, from: 980, to: 760, duration: 0.24 },
      { at: 0.6, from: 760, to: 980, duration: 0.24 },
      { at: 0.9, from: 980, to: 760, duration: 0.24 }
    ]
  },
  {
    label: 'Double ding',
    shortLabel: 'DING',
    type: 'sine',
    pulses: [
      { at: 0, from: 988, to: 988, duration: 0.42 },
      { at: 0.5, from: 1318, to: 1318, duration: 0.5 }
    ]
  },
  {
    label: 'Low buzzer',
    shortLabel: 'BUZZ',
    type: 'square',
    pulses: [
      { at: 0, from: 220, to: 260, duration: 0.42 },
      { at: 0.5, from: 220, to: 260, duration: 0.42 },
      { at: 1, from: 220, to: 260, duration: 0.42 }
    ]
  }
]

const parseTimeToMinutes = (time) => {
  const [hours, minutes] = String(time || '').slice(0, 5).split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

const minutesSinceMidnight = (date) => date.getHours() * 60 + date.getMinutes() + (date.getSeconds() / 60)

const normalizeTime = (time) => String(time || '').slice(0, 5)

const formatDuration = (totalSeconds) => {
  const total = Math.max(0, Number(totalSeconds) || 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const readCachedTeacher = () => {
  try {
    return JSON.parse(localStorage.getItem('teacher') || 'null')
  } catch (error) {
    return null
  }
}

export default function TeacherPeriodTimer() {
  const authStore = useAuthStore()
  const navigate = useNavigate()

  const [now, setNow] = useState(() => new Date())
  const [lessons, setLessons] = useState([])
  const [timetableSettings, setTimetableSettings] = useState(null)
  const [alarmEnabled, setAlarmEnabled] = useState(true)
  const [alarmToneIndex, setAlarmToneIndex] = useState(0)
  const [showToneMenu, setShowToneMenu] = useState(false)
  const [, setAudioReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [endAlert, setEndAlert] = useState({
    visible: false,
    ringing: false,
    title: 'Period ended',
    message: ''
  })

  const stateRef = useRef({
    now: new Date(),
    lessons: [],
    alarmEnabled: true,
    alarmToneIndex: 0,
    settings: null
  })
  const previousCurrentIdRef = useRef(null)
  const lastDayEndedStateRef = useRef(false)
  const audioContextRef = useRef(null)
  const alarmRepeatTimerRef = useRef(null)
  const clockTimerRef = useRef(null)
  const mountedRef = useRef(true)

  const currentAlarmTone = alarmTones[alarmToneIndex] || alarmTones[0]

  const cachedTeacher = authStore.currentUser || readCachedTeacher()
  const currentTeacherId = cachedTeacher?.teacher_id || cachedTeacher?.id || null

  const weekendMode = isAcademicWeekend(now)
  const todayName = weekendMode ? 'Weekend' : dayNames[now.getDay()]

  const todayKey = (() => {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })()

  const isBreakEntry = (entry) => {
    const label = String(entry?.module_name || '').toLowerCase()
    return entry?.entry_type === 'break' || label.includes('break') || label.includes('lunch')
  }

  const isTeacherLesson = (entry) => {
    return String(entry.teacher_id || '') === String(currentTeacherId || '') && !isBreakEntry(entry)
  }

  const dayOffsetFromToday = (targetDay) => {
    const targetIndex = dayNames.indexOf(targetDay)
    const currentIndex = now.getDay()
    if (targetIndex === -1) return 99
    return (targetIndex - currentIndex + 7) % 7
  }

  const lessonStartDate = (lesson) => {
    const startMinutes = parseTimeToMinutes(lesson.start_time)
    const date = new Date(now)
    date.setDate(now.getDate() + dayOffsetFromToday(lesson.day_of_week))
    date.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    return date
  }

  const lessonEndDate = (lesson) => {
    const endMinutes = parseTimeToMinutes(lesson.end_time)
    const date = new Date(now)
    date.setDate(now.getDate() + dayOffsetFromToday(lesson.day_of_week))
    date.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
    return date
  }

  const sortedLessons = (() => {
    if (weekendMode) return []
    return lessons
      .filter((lesson) => lesson.start_time && lesson.end_time)
      .slice()
      .sort((a, b) => {
        const dayDiff = dayOffsetFromToday(a.day_of_week) - dayOffsetFromToday(b.day_of_week)
        return dayDiff || normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time))
      })
  })()

  const timetableDayRows = buildTimetableRowsFromSettings(timetableSettings)
    .filter((row) => row.start_time && row.end_time)
    .slice()
    .sort((a, b) => normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)))

  const timetablePeriodRows = timetableDayRows.filter((row) => row.type === 'period')

  const daySessionStartRow = timetablePeriodRows[0] || null

  const daySessionEndRow = timetablePeriodRows
    .slice()
    .sort((a, b) => normalizeTime(b.end_time).localeCompare(normalizeTime(a.end_time)))[0] || null

  const todayDateForTime = (time) => {
    const minutes = parseTimeToMinutes(time)
    if (minutes === null) return null
    const date = new Date(now)
    date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
    return date
  }

  const daySessionStartDate = todayDateForTime(daySessionStartRow?.start_time)
  const daySessionEndDate = todayDateForTime(daySessionEndRow?.end_time)
  const daySessionStartTime = normalizeTime(daySessionStartRow?.start_time)
  const daySessionEndTime = normalizeTime(daySessionEndRow?.end_time)

  const sessionStarted = (() => {
    if (weekendMode) return false
    if (!daySessionStartDate) return false
    return now.getTime() >= daySessionStartDate.getTime()
  })()

  const sessionInProgress = (() => {
    if (weekendMode) return false
    if (!daySessionStartDate || !daySessionEndDate) return false
    const currentTime = now.getTime()
    return currentTime >= daySessionStartDate.getTime() && currentTime < daySessionEndDate.getTime()
  })()

  const daySessionEnded = (() => {
    if (weekendMode) return false
    if (!daySessionEndDate) return false
    return now.getTime() >= daySessionEndDate.getTime()
  })()

  const currentSlotRow = (() => {
    const currentMinutes = minutesSinceMidnight(now)
    return timetableDayRows.find((row) => {
      const start = parseTimeToMinutes(row.start_time)
      const end = parseTimeToMinutes(row.end_time)
      return start !== null && end !== null && currentMinutes >= start && currentMinutes < end
    }) || null
  })()

  const currentLesson = (() => {
    const currentMinutes = minutesSinceMidnight(now)
    return sortedLessons.find((lesson) => {
      if (lesson.day_of_week !== todayName) return false
      const start = parseTimeToMinutes(lesson.start_time)
      const end = parseTimeToMinutes(lesson.end_time)
      return start !== null && end !== null && currentMinutes >= start && currentMinutes < end
    }) || null
  })()

  const currentSlotEndDate = currentSlotRow?.end_time ? todayDateForTime(currentSlotRow.end_time) : null
  const currentSlotStartDate = currentSlotRow?.start_time ? todayDateForTime(currentSlotRow.start_time) : null

  const nextLesson = (() => {
    const referenceTime = currentLesson ? lessonEndDate(currentLesson) : now
    return sortedLessons.find((lesson) => lessonStartDate(lesson).getTime() >= referenceTime.getTime()) || null
  })()

  const countdownSeconds = (() => {
    const target = currentLesson
      ? lessonEndDate(currentLesson)
      : nextLesson
        ? lessonStartDate(nextLesson)
        : null

    if (!target) return 0
    return Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000))
  })()

  const activeSlotRemainingSeconds = currentSlotEndDate
    ? Math.max(0, Math.floor((currentSlotEndDate.getTime() - now.getTime()) / 1000))
    : 0

  const sessionStartCountdownSeconds = daySessionStartDate
    ? Math.max(0, Math.floor((daySessionStartDate.getTime() - now.getTime()) / 1000))
    : 0

  const sessionDurationSeconds = (() => {
    if (!daySessionStartDate || !daySessionEndDate) return 0
    return Math.max(0, Math.floor((daySessionEndDate.getTime() - daySessionStartDate.getTime()) / 1000))
  })()

  const sessionElapsedSeconds = (() => {
    if (!daySessionStartDate) return 0
    if (daySessionEnded) return sessionDurationSeconds
    return Math.max(0, Math.floor((now.getTime() - daySessionStartDate.getTime()) / 1000))
  })()

  const sessionRemainingSeconds = (() => {
    if (!daySessionEndDate || !sessionInProgress) return 0
    return Math.max(0, Math.floor((daySessionEndDate.getTime() - now.getTime()) / 1000))
  })()

  const sessionRemainingTimerValue = formatDuration(sessionRemainingSeconds)

  const activeTimerLabel = (() => {
    if (currentSlotRow) return 'Time left'
    if (nextLesson) return 'Starts in'
    if (sessionStarted) return 'Elapsed time'
    return 'Starts in'
  })()

  const activeTimerValue = (() => {
    if (currentSlotRow) return formatDuration(activeSlotRemainingSeconds)
    if (nextLesson) return formatDuration(countdownSeconds)
    return sessionStarted
      ? formatDuration(sessionElapsedSeconds)
      : formatDuration(sessionStartCountdownSeconds)
  })()

  const currentBreakLabel = (() => {
    if (currentSlotRow?.type !== 'break') return ''
    return currentSlotRow.label || currentSlotRow.break_name || 'Break'
  })()

  const displayLesson = currentLesson || nextLesson || null

  const displayDayMetric = (() => {
    if (currentLesson || currentSlotRow) return todayName
    return nextLesson?.day_of_week || todayName
  })()

  const displayModeLabel = (() => {
    if (currentLesson) return 'Current period'
    if (currentBreakLabel) return 'Current break'
    if (sessionInProgress && currentSlotRow?.type === 'period') return 'Free period'
    if (nextLesson) return 'Next period'
    return daySessionEnded ? 'Finished' : 'No period'
  })()

  const displaySubjectMetric = (() => {
    if (currentLesson) return currentLesson.module_name || 'Lesson'
    if (currentBreakLabel) return currentBreakLabel
    if (sessionInProgress && currentSlotRow?.type === 'period') return 'Free'
    return nextLesson?.module_name || 'None'
  })()

  const displayClassMetric = (() => {
    if (currentLesson) return currentLesson.class_name || 'Class'
    if (currentBreakLabel) return 'Break'
    if (sessionInProgress && currentSlotRow?.type === 'period') return 'Free'
    return nextLesson?.class_name || 'None'
  })()

  const displayRoomMetric = (() => {
    const lesson = displayLesson
    if (currentBreakLabel) return '--'
    if (sessionInProgress && currentSlotRow?.type === 'period' && !currentLesson) return '--'
    return lesson?.room_name || lesson?.room || 'TBA'
  })()

  const displayStartMetric = (() => {
    if (currentSlotRow) return normalizeTime(currentSlotRow.start_time)
    return normalizeTime(nextLesson?.start_time) || daySessionStartTime || '--:--'
  })()

  const displayEndMetric = (() => {
    if (currentSlotRow) return normalizeTime(currentSlotRow.end_time)
    return normalizeTime(nextLesson?.end_time) || daySessionEndTime || '--:--'
  })()

  const displayStatusMetric = (() => {
    if (currentLesson) return 'ON'
    if (currentBreakLabel) return 'BREAK'
    if (sessionInProgress && currentSlotRow?.type === 'period') return 'FREE'
    if (daySessionEnded) return 'DONE'
    if (nextLesson) return 'NEXT'
    return 'NONE'
  })()

  const timerCaption = (() => {
    if (weekendMode) return 'Weekend break - next school week resumes Monday'
    if (currentLesson) {
      return `${activeTimerValue} left - ends at ${normalizeTime(currentLesson.end_time)}`
    }
    if (currentBreakLabel) {
      return `${activeTimerValue} left - ${currentBreakLabel} ends at ${displayEndMetric}`
    }
    if (sessionInProgress && currentSlotRow?.type === 'period') {
      return `${activeTimerValue} left - free period ends at ${displayEndMetric}`
    }
    if (nextLesson) {
      return `${nextLesson.class_name || 'Class'} starts at ${normalizeTime(nextLesson.start_time)}`
    }
    if (sessionInProgress) return `${sessionRemainingTimerValue} remaining - day ends at ${daySessionEndTime}`
    if (daySessionEnded) return `Day session ended at ${daySessionEndTime}`
    if (daySessionStartTime) return `First period starts at ${daySessionStartTime}`
    return 'No scheduled periods'
  })()

  const timerAriaLabel = `${activeTimerValue} ${timerCaption}`

  const gmtTime = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const gmtOffsetLabel = (() => {
    const offsetMinutes = -now.getTimezoneOffset()
    const sign = offsetMinutes >= 0 ? '+' : '-'
    const absoluteMinutes = Math.abs(offsetMinutes)
    const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0')
    const minutes = String(absoluteMinutes % 60).padStart(2, '0')
    return `GMT${sign}${hours}:${minutes}`
  })()

  const alarmStoragePrefix = `teacherPeriodAlarm:${currentTeacherId || 'unknown'}:${todayKey}`

  const alarmFired = (key) => localStorage.getItem(`${alarmStoragePrefix}:${key}`) === '1'

  const markAlarmFired = (key) => {
    localStorage.setItem(`${alarmStoragePrefix}:${key}`, '1')
  }

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
      } catch (error) {
        // Notification permission prompts can be blocked by browser policy.
      }
    }
  }

  const showBrowserNotification = (title, message) => {
    if (!stateRef.current.alarmEnabled || !('Notification' in window) || Notification.permission !== 'granted') return

    try {
      new Notification(title, {
        body: message,
        tag: 'teacher-period-alarm',
        renotify: true,
        requireInteraction: true
      })
    } catch (error) {
      // Some browsers block notifications outside secure contexts.
    }
  }

  const getAudioContext = async () => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) return null

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor()
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }

    return audioContextRef.current
  }

  const unlockAudio = async () => {
    const context = await getAudioContext()
    if (!context) return

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.03)
    setAudioReady(true)
  }

  const primeAudioFromUserGesture = () => {
    unlockAudio()
    requestNotificationPermission()
  }

  const playBell = async () => {
    if (!stateRef.current.alarmEnabled) return

    if ('vibrate' in navigator) {
      navigator.vibrate([300, 120, 300, 120, 500])
    }

    const context = await getAudioContext()
    if (!context) return

    try {
      const startTime = context.currentTime
      const tone = alarmTones[stateRef.current.alarmToneIndex] || alarmTones[0]

      tone.pulses.forEach((pulse) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const start = startTime + pulse.at

        oscillator.type = tone.type
        oscillator.frequency.setValueAtTime(pulse.from, start)
        oscillator.frequency.setValueAtTime(pulse.to, start + Math.min(0.18, pulse.duration / 2))
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(0.32, start + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + pulse.duration)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(start)
        oscillator.stop(start + pulse.duration + 0.02)
      })
    } catch (error) {
      // Some browsers block audio until the teacher interacts with the page.
    }
  }

  const stopAlarm = () => {
    setEndAlert((previous) => ({ ...previous, ringing: false }))

    if (alarmRepeatTimerRef.current) {
      window.clearInterval(alarmRepeatTimerRef.current)
      alarmRepeatTimerRef.current = null
    }

    if ('vibrate' in navigator) {
      navigator.vibrate(0)
    }
  }

  const startPersistentAlarm = () => {
    stopAlarm()

    if (!stateRef.current.alarmEnabled) return

    setEndAlert((previous) => ({ ...previous, ringing: true }))
    playBell()
    alarmRepeatTimerRef.current = window.setInterval(() => {
      playBell()
    }, 2600)
  }

  const showAlarmAlert = (title, message) => {
    setEndAlert({ visible: true, ringing: endAlert.ringing, title, message })
    showBrowserNotification(title, message)
    startPersistentAlarm()
  }

  const dismissEndAlert = () => {
    stopAlarm()
    setEndAlert((previous) => ({ ...previous, visible: false }))
  }

  const showPeriodEndAlert = (lesson) => {
    const alarmKey = `period-end:${lesson?.timetable_id || `${lesson?.day_of_week}-${lesson?.end_time}`}`
    if (alarmFired(alarmKey)) return
    markAlarmFired(alarmKey)

    const nextText = nextLesson
      ? `Next: ${nextLesson.class_name || 'Class'} in ${nextLesson.room_name || nextLesson.room || 'Room TBA'}.`
      : 'No next class is scheduled.'

    showAlarmAlert(
      'Period ended',
      `${lesson?.class_name || 'Your class'} period has ended. ${nextText} Press X to stop the alarm.`
    )
  }

  const showPeriodStartAlert = (lesson) => {
    const alarmKey = `period-start:${lesson?.timetable_id || `${lesson?.day_of_week}-${lesson?.start_time}`}`
    if (alarmFired(alarmKey)) return
    markAlarmFired(alarmKey)

    showAlarmAlert(
      'Period started',
      `${lesson?.class_name || 'Your class'} period has started. ${lesson?.room_name || lesson?.room ? `Room: ${lesson.room_name || lesson.room}. ` : ''}Press X to stop the alarm.`
    )
  }

  const showDayEndedAlert = () => {
    const endTime = normalizeTime(daySessionEndRow?.end_time)
    if (!endTime || alarmFired('day-ended')) return
    markAlarmFired('day-ended')

    showAlarmAlert(
      'Day ended',
      `The teaching day ended at ${endTime}. Press X to stop the alarm.`
    )
  }

  const toggleAlarm = () => {
    const nextValue = !stateRef.current.alarmEnabled
    stateRef.current.alarmEnabled = nextValue
    setAlarmEnabled(nextValue)
    localStorage.setItem('teacherPeriodAlarmEnabled', JSON.stringify(nextValue))
    if (!nextValue) stopAlarm()
    if (nextValue) {
      unlockAudio()
      requestNotificationPermission()
    }
  }

  const selectAlarmTone = (index) => {
    stateRef.current.alarmToneIndex = index
    setAlarmToneIndex(index)
    localStorage.setItem('teacherPeriodAlarmTone', String(index))
    setShowToneMenu(false)
    unlockAudio()
    requestNotificationPermission()
    playBell()
  }

  const goToTimetable = (focus = 'current') => {
    const lesson = focus === 'next' ? nextLesson : currentLesson
    const params = new URLSearchParams()
    params.set('focus', focus)
    if (lesson?.timetable_id) params.set('lesson', lesson.timetable_id)
    navigate(`/teacher/timetable?${params.toString()}`)
  }

  const minutesUntil = (date) => (date.getTime() - stateRef.current.now.getTime()) / 60000

  const checkMissedAlarms = () => {
    if (weekendMode) return
    if (!stateRef.current.alarmEnabled || !lessons.length) return

    if (daySessionEnded) {
      showDayEndedAlert()
      return
    }

    if (currentLesson) {
      const start = lessonStartDate(currentLesson)
      if (minutesUntil(start) <= 0 && minutesUntil(start) >= -10) {
        showPeriodStartAlert(currentLesson)
      }
      return
    }

    const endedLesson = sortedLessons
      .filter((lesson) => lesson.day_of_week === todayName)
      .filter((lesson) => {
        const end = lessonEndDate(lesson)
        return minutesUntil(end) <= 0 && minutesUntil(end) >= -10
      })
      .sort((a, b) => lessonEndDate(b).getTime() - lessonEndDate(a).getTime())[0]

    if (endedLesson) {
      showPeriodEndAlert(endedLesson)
    }
  }

  const tickClock = () => {
    const current = new Date()
    stateRef.current.now = current
    setNow(current)
    window.setTimeout(checkMissedAlarms, 0)
  }

  useEffect(() => {
    const lessonId = currentLesson?.timetable_id || null
    const previousId = previousCurrentIdRef.current

    if (previousId && previousId !== lessonId) {
      const previousLesson = stateRef.current.lessons.find((lesson) => lesson.timetable_id === previousId) || null
      if (previousLesson) showPeriodEndAlert(previousLesson)
    }

    if (currentLesson && previousId !== lessonId) {
      showPeriodStartAlert(currentLesson)
    }

    previousCurrentIdRef.current = lessonId
  }, [currentLesson?.timetable_id])

  useEffect(() => {
    if (daySessionEnded && !lastDayEndedStateRef.current) {
      showDayEndedAlert()
    }
    lastDayEndedStateRef.current = daySessionEnded
  }, [daySessionEnded])

  useEffect(() => {
    stateRef.current.lessons = lessons
  }, [lessons])

  useEffect(() => {
    stateRef.current.now = now
  }, [now])

  useEffect(() => {
    mountedRef.current = true

    const savedAlarm = localStorage.getItem('teacherPeriodAlarmEnabled')
    if (savedAlarm !== null) {
      try {
        const parsedAlarm = JSON.parse(savedAlarm)
        stateRef.current.alarmEnabled = parsedAlarm
        setAlarmEnabled(parsedAlarm)
      } catch (error) {
        stateRef.current.alarmEnabled = true
        setAlarmEnabled(true)
      }
    }

    const savedTone = Number(localStorage.getItem('teacherPeriodAlarmTone'))
    if (Number.isInteger(savedTone) && savedTone >= 0 && savedTone < alarmTones.length) {
      stateRef.current.alarmToneIndex = savedTone
      setAlarmToneIndex(savedTone)
    }

    const boot = async () => {
      await loadTeacherLessons()
    }
    boot()

    clockTimerRef.current = window.setInterval(tickClock, 1000)
    document.addEventListener('visibilitychange', tickClock)
    window.addEventListener('pointerdown', primeAudioFromUserGesture, { once: true })
    window.addEventListener('keydown', primeAudioFromUserGesture, { once: true })
    window.addEventListener('touchstart', primeAudioFromUserGesture, { once: true })

    return () => {
      mountedRef.current = false
      if (clockTimerRef.current) window.clearInterval(clockTimerRef.current)
      document.removeEventListener('visibilitychange', tickClock)
      window.removeEventListener('pointerdown', primeAudioFromUserGesture)
      window.removeEventListener('keydown', primeAudioFromUserGesture)
      window.removeEventListener('touchstart', primeAudioFromUserGesture)
      stopAlarm()
    }
  }, [])

  const loadTeacherLessons = async () => {
    setLoadError('')
    await authStore.checkAuth()
    const teacher = authStore.currentUser || readCachedTeacher()
    const teacherId = teacher?.teacher_id || teacher?.id || null
    if (!teacherId) {
      stateRef.current.lessons = []
      setLessons([])
      setLoadError('Teacher profile not loaded')
      return
    }

    try {
      const [settingsResponse, timetableResponse] = await Promise.all([
        api.get('/settings/timetable', { showGlobalLoader: false }).catch(() => ({ data: { settings: null } })),
        api.get(`/timetable/teacher/${teacherId}`, { showGlobalLoader: false })
      ])
      const nextSettings = settingsResponse.data.settings || null
      const nextLessons = (timetableResponse.data.timetables || []).filter((entry) => {
        const label = String(entry?.module_name || '').toLowerCase()
        const isBreak = entry?.entry_type === 'break' || label.includes('break') || label.includes('lunch')
        return String(entry.teacher_id || '') === String(teacherId || '') && !isBreak
      })
      stateRef.current.settings = nextSettings
      stateRef.current.lessons = nextLessons
      if (!mountedRef.current) return
      setTimetableSettings(nextSettings)
      setLessons(nextLessons)
    } catch (error) {
      stateRef.current.lessons = []
      if (!mountedRef.current) return
      setLessons([])
      setLoadError('Timer could not load timetable')
    }
  }

  return (
    <section className={`period-timer${sessionInProgress ? ' active' : ''}${endAlert.ringing ? ' ringing' : ''}`}>
      {endAlert.visible && (
        <div className="period-alert" role="status">
          <strong>{endAlert.title}</strong>
          <span>{endAlert.message}</span>
          <button
            type="button"
            onClick={dismissEndAlert}
            title={endAlert.ringing ? 'Stop alarm' : 'Dismiss alert'}
          >
            <X size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="stopwatch">
        <div className="top-crown" aria-hidden="true"></div>

        <div className="watch-face">
          <div className="screen">
            <div className="screen-top">
              <strong>{currentLesson ? 'CURRENT' : sessionInProgress ? 'SESSION' : daySessionEnded ? 'DONE' : 'NEXT'}</strong>
              <button
                className={`alarm-toggle${alarmEnabled ? ' enabled' : ''}`}
                type="button"
                aria-pressed={alarmEnabled}
                title={alarmEnabled ? 'Turn alarm off' : 'Turn alarm on'}
                onClick={toggleAlarm}
              >
                {alarmEnabled
                  ? <Bell size={11} strokeWidth={2.4} aria-hidden="true" />
                  : <BellOff size={11} strokeWidth={2.4} aria-hidden="true" />}
                <span>{alarmEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <div className="period-summary">
              <span>{displayDayMetric}</span>
              <span>{displayStatusMetric}</span>
              <span>{displayModeLabel}</span>
              <strong>{displaySubjectMetric}</strong>
            </div>

            <div className="timer-display" aria-label={timerAriaLabel}>
              <span className="timer-zone">{activeTimerLabel}</span>
              <span className="timer-local-time">{activeTimerValue}</span>
            </div>

            <div className="timer-caption">{timerCaption}</div>

            <div className="timer-navigation" aria-label="Counter navigation">
              <button type="button" onClick={() => goToTimetable('current')}>
                <Navigation size={11} strokeWidth={2.4} aria-hidden="true" />
                Current
              </button>
              <button type="button" onClick={() => goToTimetable('next')}>
                <CalendarDays size={11} strokeWidth={2.4} aria-hidden="true" />
                Next
              </button>
            </div>

            <div className="watch-metrics">
              <div>
                <span>{sessionInProgress ? 'Day left' : gmtOffsetLabel}</span>
                <strong>{sessionInProgress ? sessionRemainingTimerValue : gmtTime}</strong>
              </div>
              <div>
                <span>Class</span>
                <strong>{displayClassMetric}</strong>
              </div>
              <div>
                <span>Room</span>
                <strong>{displayRoomMetric}</strong>
              </div>
              <div>
                <span>Start</span>
                <strong>{displayStartMetric}</strong>
              </div>
              <div>
                <span>End</span>
                <strong>{displayEndMetric}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{displayStatusMetric}</strong>
              </div>
            </div>

            {loadError && <div className="timer-error">{loadError}</div>}
          </div>
        </div>

        <button
          className="mode-button"
          type="button"
          aria-expanded={showToneMenu}
          onClick={() => setShowToneMenu((previous) => !previous)}
          title={`Alarm voice: ${currentAlarmTone.label}`}
        >
          MODE
        </button>

        {showToneMenu && (
          <div className="tone-menu">
            {alarmTones.map((tone, index) => (
              <button
                key={tone.label}
                type="button"
                className={index === alarmToneIndex ? 'active' : undefined}
                onClick={() => selectAlarmTone(index)}
              >
                {tone.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
