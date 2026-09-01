function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function enableNotifications(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Berechtigung für Benachrichtigungen wurde nicht erteilt");
  }

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await fetch("/api/push/public-key").then((r) => r.json());

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!res.ok) throw new Error("Subscription konnte nicht gespeichert werden");
}

export async function sendTestNotification(): Promise<{ sent: number; failed: number }> {
  const res = await fetch("/api/push/test", { method: "POST" });
  if (!res.ok) throw new Error("Testbenachrichtigung fehlgeschlagen");
  return res.json();
}
