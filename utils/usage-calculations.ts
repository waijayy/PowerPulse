export type UsageBreakdown = {
    dailyUsage: number
    peakUsage: number
    offPeakUsage: number
}

/**
 * Calculates daily usage breakdown into peak and off-peak hours.
 * Peak Hours: 14:00 (2:00 PM) to 22:00 (10:00 PM)
 * Off-Peak Hours: 22:00 (10:00 PM) to 14:00 (2:00 PM)
 * 
 * @param startTimeStr - Start time in "HH:MM" format (24-hour)
 * @param endTimeStr - End time in "HH:MM" format (24-hour)
 * @returns UsageBreakdown object with hours
 */
export function calculateUsageBreakdown(startTimeStr: string, endTimeStr: string): UsageBreakdown {
    if (!startTimeStr || !endTimeStr) {
        return { dailyUsage: 0, peakUsage: 0, offPeakUsage: 0 }
    }

    // Check if it's effectively 24 hours (Always On: 00:00 to 23:59)
    if (startTimeStr === "00:00" && endTimeStr === "23:59") {
        return {
            dailyUsage: 24,
            peakUsage: 14,  // 14:00 to 22:00 = 8 hours peak
            offPeakUsage: 10  // Remaining 16 hours off-peak
        }
    }

    const parseMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number)
        return hours * 60 + minutes
    }

    let start = parseMinutes(startTimeStr)
    let end = parseMinutes(endTimeStr)

    // Handle crossing midnight (e.g., 22:00 to 02:00)
    if (end < start) {
        end += 24 * 60 // Add 24 hours
    }

    const totalDurationMinutes = end - start
    const dailyUsage = totalDurationMinutes / 60

    // Peak window in minutes from midnight
    const peakStart = 14 * 60 // 14:00
    const peakEnd = 22 * 60   // 22:00

    let peakMinutes = 0

    // We need to check overlap with the peak window for the current day and potentially the next day
    // The usage interval is [start, end]

    // Helper to calculate overlap between two intervals [a, b] and [c, d]
    const getOverlap = (a: number, b: number, c: number, d: number) => {
        const start = Math.max(a, c)
        const end = Math.min(b, d)
        return Math.max(0, end - start)
    }

    // Check overlap with today's peak window
    peakMinutes += getOverlap(start, end, peakStart, peakEnd)

    // Check overlap with tomorrow's peak window (if usage extends to next day)
    // Tomorrow's peak window relative to today's start is [peakStart + 1440, peakEnd + 1440]
    peakMinutes += getOverlap(start, end, peakStart + 1440, peakEnd + 1440)

    // Also check overlap with yesterday's peak window (if start is effectively "late" in the previous day cycle? 
    // No, start is always >= 0 relative to the day we are considering)

    // Wait, what if the usage is "Start 01:00, End 03:00"?
    // start=60, end=180. Peak=[840, 1320]. Overlap=0. Correct.

    // What if usage is "Start 13:00, End 15:00"?
    // start=780, end=900. Peak=[840, 1320]. Overlap=[840, 900] = 60. Correct.

    // What if usage is "Start 23:00, End 01:00"?
    // start=1380, end=1500. Peak=[840, 1320]. Overlap=0.
    // Next day Peak=[2280, 2760]. Overlap=0. Correct.

    const peakUsage = peakMinutes / 60
    const offPeakUsage = dailyUsage - peakUsage

    return {
        dailyUsage: Number(dailyUsage.toFixed(2)),
        peakUsage: Number(peakUsage.toFixed(2)),
        offPeakUsage: Number(offPeakUsage.toFixed(2))
    }
}
