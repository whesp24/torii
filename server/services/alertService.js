import Alert from '../models/Alert.js';
import Stock from '../models/Stock.js';
import { sendPushToAll } from '../routes/push.js';

// Get all alerts
export async function getAllAlerts() {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });
    return alerts;
  } catch (error) {
    console.error('Error fetching alerts:', error);
    throw error;
  }
}

// Get active alerts (enabled only)
export async function getActiveAlerts() {
  try {
    const alerts = await Alert.find({ enabled: true }).sort({ createdAt: -1 });
    return alerts;
  } catch (error) {
    console.error('Error fetching active alerts:', error);
    throw error;
  }
}

// Get alerts by symbol
export async function getAlertsBySymbol(symbol) {
  try {
    const alerts = await Alert.find({ symbol: symbol.toUpperCase() }).sort({ createdAt: -1 });
    return alerts;
  } catch (error) {
    console.error('Error fetching alerts by symbol:', error);
    throw error;
  }
}

// Create alert
export async function createAlert(alertData) {
  try {
    const alert = new Alert({
      symbol: alertData.symbol.toUpperCase(),
      alertType: alertData.alertType,
      targetPrice: alertData.targetPrice || null,
      changePercent: alertData.changePercent || null,
      enabled: true
    });

    await alert.save();
    return alert;
  } catch (error) {
    console.error('Error creating alert:', error);
    throw error;
  }
}

// Update alert
export async function updateAlert(alertId, updates) {
  try {
    const alert = await Alert.findByIdAndUpdate(alertId, updates, { new: true });
    return alert;
  } catch (error) {
    console.error('Error updating alert:', error);
    throw error;
  }
}

// Delete alert
export async function deleteAlert(alertId) {
  try {
    const alert = await Alert.findByIdAndDelete(alertId);
    return alert;
  } catch (error) {
    console.error('Error deleting alert:', error);
    throw error;
  }
}

// Toggle alert enabled/disabled
export async function toggleAlert(alertId) {
  try {
    const alert = await Alert.findById(alertId);
    if (!alert) return null;

    const updated = await Alert.findByIdAndUpdate(
      alertId,
      { enabled: !alert.enabled },
      { new: true }
    );
    return updated;
  } catch (error) {
    console.error('Error toggling alert:', error);
    throw error;
  }
}

// Check if alert should trigger
export async function checkAlertCondition(alert, currentPrice) {
  if (!alert.enabled) return false;

  if (alert.alertType === 'above') {
    return currentPrice >= alert.targetPrice;
  } else if (alert.alertType === 'below') {
    return currentPrice <= alert.targetPrice;
  } else if (alert.alertType === 'change_percent') {
    // This would need previous price data
    return false;
  }

  return false;
}

// Check all active alerts against current prices
export async function checkAllAlerts() {
  try {
    const alerts = await getActiveAlerts();
    const triggered = [];

    for (const alert of alerts) {
      try {
        const stock = await Stock.findOne({ symbol: alert.symbol });

        if (stock && stock.price) {
          const shouldTrigger = await checkAlertCondition(alert, stock.price);

          if (shouldTrigger && !alert.triggered) {
            // Mark as triggered
            const updated = await updateAlert(alert._id, {
              triggered: true,
              triggeredAt: new Date(),
              lastCheckedAt: new Date()
            });
            triggered.push(updated);
            sendPushToAll(
              `🚨 ${alert.symbol} Alert Triggered`,
              `${alert.symbol} hit your ${alert.alertType} target at $${stock.price.toFixed(2)}`,
              '/?page=alerts'
            ).catch(() => {});
          } else if (!shouldTrigger && alert.triggered) {
            // Reset if condition no longer met
            await updateAlert(alert._id, { triggered: false });
          } else {
            // Just update checked time
            await updateAlert(alert._id, { lastCheckedAt: new Date() });
          }
        }
      } catch (error) {
        console.error(`Error checking alert ${alert._id}:`, error);
      }
    }

    return triggered;
  } catch (error) {
    console.error('Error checking alerts:', error);
    throw error;
  }
}
