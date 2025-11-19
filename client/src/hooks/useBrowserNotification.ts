import { useEffect, useState } from "react";

export function useBrowserNotification() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if browser supports notifications
    if ("Notification" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!isSupported) {
      console.warn("[Notification] Browser does not support notifications");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("[Notification] Failed to request permission:", error);
      return false;
    }
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (!isSupported) {
      console.warn("[Notification] Browser does not support notifications");
      return null;
    }

    if (permission !== "granted") {
      console.warn("[Notification] Permission not granted");
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });

      // Auto close after 10 seconds
      setTimeout(() => {
        notification.close();
      }, 10000);

      return notification;
    } catch (error) {
      console.error("[Notification] Failed to show notification:", error);
      return null;
    }
  };

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
  };
}
