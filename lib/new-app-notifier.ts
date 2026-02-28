// https://deanhume.com/displaying-a-new-version-available-progressive-web-app/
let refreshing = false
// The event listener that is fired when the service worker updates
// Here we reload the page
navigator.serviceWorker.addEventListener('controllerchange', function () {
  if (refreshing) return
  refreshing = true
  window.location.reload()
})

/// Checks if there is a new version of the app available
/// @param fn - Callback function to be called when a new version is available
/// @returns void
/// @example
/// notifier((state, worker) => {
///   if (state !== "waiting") {
///     // Show notification
///   }
///   if (/* user confirms update */) {
///     worker.postMessage("skipWaiting")
///   }
/// })
function notifier(fn: (state: "" | "waiting", worker: ServiceWorker) => void) {
  let newWorker: ServiceWorker | undefined | null

  if ('serviceWorker' in navigator) {
    // Register the service worker
    navigator.serviceWorker.register('/web/sw.js').then(reg => {
      if ((newWorker = reg.waiting)?.state === 'installed') {
        // @ts-ignore
        fn("waiting", newWorker)
        return
      }
      reg.addEventListener('updatefound', () => {
        // An updated service worker has appeared in reg.installing!
        newWorker = reg.installing

        newWorker?.addEventListener('statechange', () => {

          // There is a new service worker available, show the notification
          if (newWorker?.state === "installed" && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage("installed")
            fn("", newWorker)
          }

        })
      })
    })
  }
}

notifier(notifyUserAboutNewVersion)

function skipWaiting(id: string) {
  let el = document.getElementById(id)
  el?.addEventListener("click", (e: MouseEvent) => {
    e.preventDefault()
    // @ts-ignore
    window.app.sw.postMessage({ action: 'skipWaiting' })
  })
}

function notifyUserAboutNewVersion(state = "", worker: ServiceWorker) {
  let nav = document.getElementById("sw-message")
  nav?.insertAdjacentHTML("afterbegin", `<div class=inline><a id=skipWaiting href="#">Click here to update your app.</a></div>`)
  // @ts-ignore
  skipWaiting("skipWaiting")
  // @ts-ignore
  window.app = window.app || {}
  // @ts-ignore
  window.app.sw = worker
  if (state === "waiting") return
  // Publish custom event for "user-messages" to display a toast.
  document.dispatchEvent(new CustomEvent("user-messages", {
    detail: { html: `A new version of the app is available. <a id=skipWaiting1 href="#">Click to update the app.</a>` }
  }))
  // @ts-ignore
  skipWaiting("skipWaiting1")
}