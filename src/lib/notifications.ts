export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function scheduleLocalNotification(title: string, body: string, delayMs: number) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  setTimeout(() => {
    new Notification(title, { body, icon: '/icon.png' });
  }, delayMs);
}

export function scheduleDailyReminders() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const now = new Date();

  // Meal reminder: 12:30 PM if before that
  const lunchTime = new Date();
  lunchTime.setHours(12, 30, 0, 0);
  if (now < lunchTime) {
    scheduleLocalNotification(
      'Log your lunch',
      'Keep your nutrition on track — tap to log your meal.',
      lunchTime.getTime() - now.getTime()
    );
  }

  // Workout reminder: 6 PM if before that
  const workoutTime = new Date();
  workoutTime.setHours(18, 0, 0, 0);
  if (now < workoutTime) {
    scheduleLocalNotification(
      'Time to train',
      "Your workout is ready. Let's get it done.",
      workoutTime.getTime() - now.getTime()
    );
  }

  // Weekly check-in reminder: Sunday 8 PM
  const dayOfWeek = now.getDay();
  if (dayOfWeek <= 0) { // Sunday
    const sundayEvening = new Date();
    sundayEvening.setHours(20, 0, 0, 0);
    if (now < sundayEvening) {
      scheduleLocalNotification(
        'Weekly body check-in',
        'Upload your progress photos before the week ends.',
        sundayEvening.getTime() - now.getTime()
      );
    }
  }
}
