/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

interface PushData {
  title?: string;
  body?: string;
  taskId?: string;
}

self.addEventListener("push", (event) => {
  const data: PushData = event.data?.json() ?? {};
  const actions = data.taskId
    ? [
        { action: "done", title: "✓ Erledigt" },
        { action: "later", title: "⏰ Später" },
      ]
    : [];

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Plants vs. Mella", {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { taskId: data.taskId },
      actions,
    } as NotificationOptions),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const taskId = event.notification.data?.taskId as string | undefined;

  if (taskId && (event.action === "done" || event.action === "later")) {
    event.waitUntil(
      fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: event.action }),
      }).catch(() => {
        // Bei Fehlschlag (z.B. offline) bleibt die Aufgabe einfach offen —
        // der Nutzer kann sie in der App nachholen.
      }),
    );
    return;
  }

  event.waitUntil(self.clients.openWindow("/"));
});
