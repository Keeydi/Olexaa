import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions() {
  if (Platform.OS === 'web') {
    return { granted: false };
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return { granted: false };
    }

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('expiry-alerts', {
        name: 'Expiry Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3fb11b',
      });
    }

    return { granted: true };
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return { granted: false };
  }
}

/**
 * Calculate expiry status based on expiry date
 */
export function calculateExpiryStatus(expiryDateStr) {
  if (!expiryDateStr) {
    return 'fresh';
  }

  try {
    // Try parsing various date formats
    let expiryDate = null;

    // Try ISO format first
    try {
      expiryDate = new Date(expiryDateStr);
    } catch {
      // Try common formats like "Nov 30, 2025" or "30/11/2025"
      const parts = expiryDateStr.split(/[\/\-]/);
      if (parts.length === 3) {
        const [d, m, y] = parts.map((p) => parseInt(p, 10));
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          expiryDate = new Date(y, m - 1, d);
        }
      }
    }

    if (!expiryDate || isNaN(expiryDate.getTime())) {
      return 'fresh';
    }

    // Normalize to date only (remove time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    // Calculate days until expiry
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return 'expired';
    } else if (daysUntilExpiry <= 3) {
      // Expiring within 3 days
      return 'expiring';
    } else {
      return 'fresh';
    }
  } catch (error) {
    console.error('Error calculating expiry status:', error);
    return 'fresh';
  }
}

/**
 * Schedule notifications for expiring items
 * Sends reminders: 3 days before, 1 day before, and on expiry day
 */
export async function scheduleExpiryNotifications(items) {
  if (Platform.OS === 'web') {
    return; // Notifications not supported on web
  }

  try {
    // Cancel all existing notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    const { granted } = await requestNotificationPermissions();
    if (!granted) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const item of items) {
      if (!item.expiry_date) continue;

      try {
        let expiryDate = new Date(item.expiry_date);
        
        // Try parsing alternative formats
        if (isNaN(expiryDate.getTime())) {
          const parts = item.expiry_date.split(/[\/\-]/);
          if (parts.length === 3) {
            const [d, m, y] = parts.map((p) => parseInt(p, 10));
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              expiryDate = new Date(y, m - 1, d);
            }
          }
        }

        if (isNaN(expiryDate.getTime())) continue;

        expiryDate.setHours(0, 0, 0, 0);
        const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

        // Schedule notification for expiry day (if not already expired)
        if (daysUntilExpiry >= 0) {
          const expiryDay = new Date(expiryDate);
          expiryDay.setHours(9, 0, 0, 0); // 9 AM

          await Notifications.scheduleNotificationAsync({
            content: {
              title: `⚠️ ${item.emoji || '🍎'} ${item.name} expires today!`,
              body: `Your ${item.name} expires today. Use it now to avoid waste!`,
              data: { itemId: item.id, itemName: item.name, type: 'expiry' },
              sound: true,
              priority: 'high',
            },
            trigger: expiryDay,
          });
        }

        // Schedule notification 1 day before expiry
        if (daysUntilExpiry >= 1) {
          const oneDayBefore = new Date(expiryDate);
          oneDayBefore.setDate(oneDayBefore.getDate() - 1);
          oneDayBefore.setHours(9, 0, 0, 0); // 9 AM

          await Notifications.scheduleNotificationAsync({
            content: {
              title: `⏰ ${item.emoji || '🍎'} ${item.name} expires tomorrow!`,
              body: `Your ${item.name} expires tomorrow. Plan to use it soon!`,
              data: { itemId: item.id, itemName: item.name, type: 'expiry' },
              sound: true,
              priority: 'high',
            },
            trigger: oneDayBefore,
          });
        }

        // Schedule notification 3 days before expiry (early warning)
        if (daysUntilExpiry >= 3) {
          const threeDaysBefore = new Date(expiryDate);
          threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
          threeDaysBefore.setHours(9, 0, 0, 0); // 9 AM

          await Notifications.scheduleNotificationAsync({
            content: {
              title: `📅 ${item.emoji || '🍎'} ${item.name} expiring soon!`,
              body: `Your ${item.name} expires in 3 days. Consider using it soon!`,
              data: { itemId: item.id, itemName: item.name, type: 'expiry' },
              sound: true,
            },
            trigger: threeDaysBefore,
          });
        }

        // Also send notification for already expired items (if expired today or recently)
        if (daysUntilExpiry < 0 && daysUntilExpiry >= -1) {
          // Item expired today or yesterday - send immediate notification
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `❌ ${item.emoji || '🍎'} ${item.name} has expired!`,
              body: `Your ${item.name} has expired. Please check if it's still safe to consume.`,
              data: { itemId: item.id, itemName: item.name, type: 'expired' },
              sound: true,
              priority: 'high',
            },
            trigger: null, // Send immediately
          });
        }
      } catch (error) {
        console.error(`Error scheduling notification for ${item.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error scheduling expiry notifications:', error);
  }
}

/**
 * Check for expiring items and update their status
 */
export function checkAndUpdateExpiryStatus(items) {
  return items.map((item) => {
    const calculatedStatus = calculateExpiryStatus(item.expiry_date);
    return {
      ...item,
      status: calculatedStatus,
    };
  });
}

